/**
 * Advanced Media Processing Infrastructure
 *
 * This module provides comprehensive media processing capabilities including:
 * - Video transcoding with multiple quality levels
 * - Audio processing and optimization
 * - Thumbnail and preview generation
 * - Streaming format conversion (HLS/DASH)
 * - Progressive upload and processing
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { ContentType } from '../types/enums';

// Configure FFmpeg paths
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
const CDN_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN || process.env.AWS_S3_BUCKET_NAME;

// Processing Configuration
export const PROCESSING_CONFIG = {
  // Video quality presets
  VIDEO_QUALITIES: [
    { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', audioBitrate: '192k' },
    { name: '720p', width: 1280, height: 720, bitrate: '3000k', audioBitrate: '128k' },
    { name: '480p', width: 854, height: 480, bitrate: '1500k', audioBitrate: '128k' },
    { name: '360p', width: 640, height: 360, bitrate: '800k', audioBitrate: '96k' },
  ],

  // Audio quality presets
  AUDIO_QUALITIES: [
    { name: 'high', bitrate: '320k', sampleRate: 48000 },
    { name: 'medium', bitrate: '192k', sampleRate: 44100 },
    { name: 'low', bitrate: '128k', sampleRate: 44100 },
  ],

  // Thumbnail settings
  THUMBNAIL: {
    width: 1280,
    height: 720,
    count: 6,
    interval: 10, // seconds
  },

  // Preview clip settings
  PREVIEW: {
    duration: 30, // seconds
    startTime: 30, // seconds from beginning
  },

  // HLS settings
  HLS: {
    segmentDuration: 4,
    playlistType: 'vod',
    hlsFlags: 'delete_segments+temp_file',
  },
} as const;

// Interfaces
export interface MediaMetadata {
  duration: number;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  bitrate: number;
  frameRate: number;
  hasAudio: boolean;
  hasVideo: boolean;
  audioCodec?: string;
  videoCodec?: string;
  sampleRate?: number;
  channels?: number;
}

export interface ProcessingJob {
  id: string;
  contentId: string;
  userId: string;
  type: ContentType;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  originalFile: {
    key: string;
    url: string;
    metadata: MediaMetadata;
  };
  outputs: ProcessingOutput[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingOutput {
  quality: string;
  format: string;
  url: string;
  fileSize: number;
  key: string;
  duration?: number;
  width?: number;
  height?: number;
  bitrate?: number;
}

export interface ProcessingOptions {
  generateThumbnails?: boolean;
  generatePreview?: boolean;
  transcodeQualities?: string[];
  generateHLS?: boolean;
  generateDASH?: boolean;
  audioNormalization?: boolean;
  watermark?: {
    text?: string;
    image?: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  };
}

export class MediaProcessor {
  private tempDir: string;

  constructor() {
    this.tempDir = process.env.TEMP_DIR || '/tmp/media-processing';
  }

  /**
   * Initialize processor and create temp directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(path.join(this.tempDir, 'input'), { recursive: true });
      await fs.mkdir(path.join(this.tempDir, 'output'), { recursive: true });

      logger.info('Media processor initialized', { tempDir: this.tempDir });
    } catch (error) {
      logger.error('Failed to initialize media processor', {}, error as Error);
      throw error;
    }
  }

  /**
   * Extract comprehensive metadata from media file
   */
  async extractMetadata(inputPath: string): Promise<MediaMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          logger.error('Failed to extract metadata', { inputPath }, err);
          reject(new Error(`Failed to extract metadata: ${err.message}`));
          return;
        }

        try {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

          const result: MediaMetadata = {
            duration: metadata.format.duration || 0,
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            fileSize: parseInt(metadata.format.size || '0'),
            format: metadata.format.format_name || 'unknown',
            bitrate: parseInt(metadata.format.bit_rate || '0'),
            frameRate: videoStream ? this.parseFrameRate(videoStream.r_frame_rate) : 0,
            hasAudio: !!audioStream,
            hasVideo: !!videoStream,
            audioCodec: audioStream?.codec_name,
            videoCodec: videoStream?.codec_name,
            sampleRate: audioStream?.sample_rate,
            channels: audioStream?.channels,
          };

          logger.debug('Extracted metadata', { inputPath, metadata: result });
          resolve(result);
        } catch (parseError) {
          logger.error('Failed to parse metadata', { inputPath }, parseError as Error);
          reject(new Error('Failed to parse metadata'));
        }
      });
    });
  }

  /**
   * Process video file with multiple quality outputs
   */
  async processVideo(
    inputPath: string,
    outputPrefix: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingOutput[]> {
    const metadata = await this.extractMetadata(inputPath);
    const outputs: ProcessingOutput[] = [];

    // Determine which qualities to generate based on input resolution
    const qualitiesToGenerate = this.getOptimalQualities(metadata, options.transcodeQualities);

    // Process each quality level
    for (const quality of qualitiesToGenerate) {
      try {
        const outputKey = `${outputPrefix}-${quality.name}.mp4`;
        const outputPath = path.join(this.tempDir, 'output', `${uuidv4()}.mp4`);

        await this.transcodeVideo(inputPath, outputPath, quality, options);

        // Upload to S3
        const buffer = await fs.readFile(outputPath);
        const url = await this.uploadToS3(buffer, outputKey, 'video/mp4');

        // Get file size
        const stats = await fs.stat(outputPath);

        outputs.push({
          quality: quality.name,
          format: 'mp4',
          url,
          key: outputKey,
          fileSize: stats.size,
          duration: metadata.duration,
          width: quality.width,
          height: quality.height,
          bitrate: parseInt(quality.bitrate.replace('k', '000')),
        });

        // Cleanup temp file
        await fs.unlink(outputPath).catch(() => {});

        logger.info('Video quality processed', { quality: quality.name, url });
      } catch (error) {
        logger.error('Failed to process video quality', { quality: quality.name }, error as Error);
      }
    }

    // Generate HLS if requested
    if (options.generateHLS) {
      try {
        const hlsOutput = await this.generateHLS(inputPath, outputPrefix, options);
        outputs.push(hlsOutput);
      } catch (error) {
        logger.error('Failed to generate HLS', {}, error as Error);
      }
    }

    return outputs;
  }

  /**
   * Transcode video to specific quality
   */
  private async transcodeVideo(
    inputPath: string,
    outputPath: string,
    quality: (typeof PROCESSING_CONFIG.VIDEO_QUALITIES)[0],
    options: ProcessingOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate(quality.bitrate)
        .audioBitrate(quality.audioBitrate)
        .size(`${quality.width}x${quality.height}`)
        .aspect('16:9')
        .autopad()
        .format('mp4')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart', // Enable progressive download
          '-pix_fmt yuv420p', // Ensure compatibility
          '-g 50', // GOP size for better streaming
          '-sc_threshold 0', // Disable scene change detection
          '-force_key_frames expr:gte(t,n_forced*2)', // Force keyframes every 2 seconds
        ]);

      // Add watermark if specified
      if (options.watermark?.text) {
        command = command.outputOptions([
          `-vf drawtext=text='${options.watermark.text}':fontcolor=white:fontsize=24:x=10:y=10`,
        ]);
      }

      // Audio normalization
      if (options.audioNormalization) {
        command = command.outputOptions(['-af', 'loudnorm']);
      }

      command
        .on('start', cmdline => {
          logger.debug('FFmpeg transcoding started', { cmdline });
        })
        .on('progress', progress => {
          logger.debug('Transcoding progress', {
            percent: progress.percent,
            quality: quality.name,
          });
        })
        .on('end', () => {
          logger.info('Transcoding completed', { quality: quality.name });
          resolve();
        })
        .on('error', err => {
          logger.error('Transcoding failed', { quality: quality.name }, err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Generate HLS (HTTP Live Streaming) format
   */
  private async generateHLS(
    inputPath: string,
    outputPrefix: string,
    options: ProcessingOptions
  ): Promise<ProcessingOutput> {
    const hlsDir = path.join(this.tempDir, 'output', `hls-${uuidv4()}`);
    await fs.mkdir(hlsDir, { recursive: true });

    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    const segmentPath = path.join(hlsDir, 'segment%03d.ts');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-c:a aac',
          '-hls_time 4',
          '-hls_playlist_type vod',
          '-hls_flags delete_segments+temp_file',
          '-hls_segment_filename',
          segmentPath,
        ])
        .output(playlistPath)
        .on('end', async () => {
          try {
            // Upload all HLS files to S3
            const files = await fs.readdir(hlsDir);
            const uploadPromises = files.map(async file => {
              const filePath = path.join(hlsDir, file);
              const buffer = await fs.readFile(filePath);
              const key = `${outputPrefix}-hls/${file}`;
              const contentType = file.endsWith('.m3u8')
                ? 'application/vnd.apple.mpegurl'
                : 'video/MP2T';

              return this.uploadToS3(buffer, key, contentType);
            });

            await Promise.all(uploadPromises);

            const playlistUrl = `https://${CDN_DOMAIN}/${outputPrefix}-hls/playlist.m3u8`;

            // Get total size of HLS files
            const stats = await Promise.all(files.map(file => fs.stat(path.join(hlsDir, file))));
            const totalSize = stats.reduce((sum, stat) => sum + stat.size, 0);

            // Cleanup temp directory
            await fs.rmdir(hlsDir, { recursive: true }).catch(() => {});

            resolve({
              quality: 'hls',
              format: 'hls',
              url: playlistUrl,
              key: `${outputPrefix}-hls/playlist.m3u8`,
              fileSize: totalSize,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Process audio file
   */
  async processAudio(
    inputPath: string,
    outputPrefix: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingOutput[]> {
    const metadata = await this.extractMetadata(inputPath);
    const outputs: ProcessingOutput[] = [];

    // Process different audio qualities
    for (const quality of PROCESSING_CONFIG.AUDIO_QUALITIES) {
      try {
        const outputKey = `${outputPrefix}-${quality.name}.mp3`;
        const outputPath = path.join(this.tempDir, 'output', `${uuidv4()}.mp3`);

        await this.transcodeAudio(inputPath, outputPath, quality, options);

        const buffer = await fs.readFile(outputPath);
        const url = await this.uploadToS3(buffer, outputKey, 'audio/mpeg');

        const stats = await fs.stat(outputPath);

        outputs.push({
          quality: quality.name,
          format: 'mp3',
          url,
          key: outputKey,
          fileSize: stats.size,
          duration: metadata.duration,
          bitrate: parseInt(quality.bitrate.replace('k', '000')),
        });

        await fs.unlink(outputPath).catch(() => {});

        logger.info('Audio quality processed', { quality: quality.name, url });
      } catch (error) {
        logger.error('Failed to process audio quality', { quality: quality.name }, error as Error);
      }
    }

    // Generate waveform if requested
    if (options.generatePreview) {
      try {
        const waveformOutput = await this.generateWaveform(inputPath, outputPrefix);
        outputs.push(waveformOutput);
      } catch (error) {
        logger.error('Failed to generate waveform', {}, error as Error);
      }
    }

    return outputs;
  }

  /**
   * Transcode audio to specific quality
   */
  private async transcodeAudio(
    inputPath: string,
    outputPath: string,
    quality: (typeof PROCESSING_CONFIG.AUDIO_QUALITIES)[0],
    options: ProcessingOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(quality.bitrate)
        .audioFrequency(quality.sampleRate)
        .format('mp3');

      // Audio normalization
      if (options.audioNormalization) {
        command = command.audioFilters('loudnorm');
      }

      command.on('end', resolve).on('error', reject).save(outputPath);
    });
  }

  /**
   * Generate waveform visualization
   */
  private async generateWaveform(
    inputPath: string,
    outputPrefix: string
  ): Promise<ProcessingOutput> {
    const outputPath = path.join(this.tempDir, 'output', `${uuidv4()}.png`);
    const outputKey = `${outputPrefix}-waveform.png`;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-filter_complex',
          'showwavespic=s=1200x300:colors=0x3b82f6',
          '-frames:v 1',
        ])
        .output(outputPath)
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            const url = await this.uploadToS3(buffer, outputKey, 'image/png');
            const stats = await fs.stat(outputPath);

            await fs.unlink(outputPath).catch(() => {});

            resolve({
              quality: 'waveform',
              format: 'png',
              url,
              key: outputKey,
              fileSize: stats.size,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Generate video thumbnails
   */
  async generateThumbnails(
    inputPath: string,
    outputPrefix: string,
    count: number = PROCESSING_CONFIG.THUMBNAIL.count
  ): Promise<ProcessingOutput[]> {
    const metadata = await this.extractMetadata(inputPath);
    const duration = metadata.duration;
    const interval = duration / (count + 1); // Evenly distributed throughout video
    const outputs: ProcessingOutput[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const timestamp = interval * (i + 1);
        const outputPath = path.join(this.tempDir, 'output', `${uuidv4()}.jpg`);
        const outputKey = `${outputPrefix}-thumb-${i + 1}.jpg`;

        await this.extractThumbnail(inputPath, outputPath, timestamp);

        const buffer = await fs.readFile(outputPath);
        const url = await this.uploadToS3(buffer, outputKey, 'image/jpeg');
        const stats = await fs.stat(outputPath);

        outputs.push({
          quality: `thumbnail-${i + 1}`,
          format: 'jpg',
          url,
          key: outputKey,
          fileSize: stats.size,
        });

        await fs.unlink(outputPath).catch(() => {});
      } catch (error) {
        logger.error('Failed to generate thumbnail', { index: i }, error as Error);
      }
    }

    return outputs;
  }

  /**
   * Extract single thumbnail at specific timestamp
   */
  private async extractThumbnail(
    inputPath: string,
    outputPath: string,
    timestamp: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: `${PROCESSING_CONFIG.THUMBNAIL.width}x${PROCESSING_CONFIG.THUMBNAIL.height}`,
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  /**
   * Generate preview clip
   */
  async generatePreview(inputPath: string, outputPrefix: string): Promise<ProcessingOutput> {
    const outputPath = path.join(this.tempDir, 'output', `${uuidv4()}.mp4`);
    const outputKey = `${outputPrefix}-preview.mp4`;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(PROCESSING_CONFIG.PREVIEW.startTime)
        .duration(PROCESSING_CONFIG.PREVIEW.duration)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('854x480') // 480p for preview
        .videoBitrate('1000k')
        .audioBitrate('96k')
        .format('mp4')
        .outputOptions(['-movflags +faststart'])
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            const url = await this.uploadToS3(buffer, outputKey, 'video/mp4');
            const stats = await fs.stat(outputPath);

            await fs.unlink(outputPath).catch(() => {});

            resolve({
              quality: 'preview',
              format: 'mp4',
              url,
              key: outputKey,
              fileSize: stats.size,
              duration: PROCESSING_CONFIG.PREVIEW.duration,
              width: 854,
              height: 480,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .save(outputPath);
    });
  }

  /**
   * Upload buffer to S3
   */
  private async uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'max-age=31536000', // 1 year cache
      },
    });

    try {
      await upload.done();
      return `https://${CDN_DOMAIN}/${key}`;
    } catch (error) {
      logger.error('S3 upload failed', { key }, error as Error);
      throw new Error(`Failed to upload ${key} to S3`);
    }
  }

  /**
   * Determine optimal video qualities based on input resolution
   */
  private getOptimalQualities(
    metadata: MediaMetadata,
    requestedQualities?: string[]
  ): typeof PROCESSING_CONFIG.VIDEO_QUALITIES {
    const inputHeight = metadata.height;
    let availableQualities = [...PROCESSING_CONFIG.VIDEO_QUALITIES];

    // Filter out qualities higher than input resolution
    availableQualities = availableQualities.filter(q => q.height <= inputHeight);

    // If specific qualities requested, filter to those
    if (requestedQualities && requestedQualities.length > 0) {
      availableQualities = availableQualities.filter(q => requestedQualities.includes(q.name));
    }

    // Always ensure at least one quality is available
    if (availableQualities.length === 0) {
      availableQualities = [PROCESSING_CONFIG.VIDEO_QUALITIES.find(q => q.name === '360p')!];
    }

    return availableQualities;
  }

  /**
   * Parse frame rate string (e.g., "30/1" -> 30)
   */
  private parseFrameRate(frameRateStr?: string): number {
    if (!frameRateStr) return 0;

    const parts = frameRateStr.split('/');
    if (parts.length === 2) {
      const numerator = parseInt(parts[0]);
      const denominator = parseInt(parts[1]);
      return denominator > 0 ? numerator / denominator : 0;
    }

    return parseFloat(frameRateStr) || 0;
  }

  /**
   * Cleanup temp files older than specified age
   */
  async cleanup(maxAgeHours: number = 24): Promise<void> {
    try {
      const maxAge = Date.now() - maxAgeHours * 60 * 60 * 1000;
      const files = await fs.readdir(this.tempDir, { withFileTypes: true });

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(this.tempDir, file.name);
          const stats = await fs.stat(filePath);

          if (stats.mtime.getTime() < maxAge) {
            await fs.unlink(filePath);
            logger.debug('Cleaned up temp file', { filePath });
          }
        }
      }
    } catch (error) {
      logger.error('Cleanup failed', {}, error as Error);
    }
  }
}

// Export singleton instance
export const mediaProcessor = new MediaProcessor();
