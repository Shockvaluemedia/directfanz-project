/**
 * Audio Processing Pipeline
 *
 * This module provides comprehensive audio processing capabilities:
 * - Multi-format audio transcoding and optimization
 * - Waveform visualization generation
 * - Audio quality enhancement and normalization
 * - Preview clip generation for streaming
 * - Audio effects and filtering
 * - Spectrum analysis and metadata extraction
 * - Batch processing and queue management
 * - Quality-aware adaptive encoding
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../logger';
import { uploadToS3 } from './core';
import { ProcessingJob } from './transcoding-pipeline';

// Audio Processing Configuration
export const AUDIO_CONFIG = {
  // Quality Presets
  QUALITY_PRESETS: {
    // Lossless/High Quality
    lossless: {
      codec: 'flac',
      bitrate: null,
      sampleRate: 48000,
      channels: 2,
      quality: 8,
    },
    high: {
      codec: 'libmp3lame',
      bitrate: 320,
      sampleRate: 44100,
      channels: 2,
      quality: 0,
    },

    // Standard Quality
    standard: {
      codec: 'libmp3lame',
      bitrate: 192,
      sampleRate: 44100,
      channels: 2,
      quality: 2,
    },
    medium: {
      codec: 'libmp3lame',
      bitrate: 128,
      sampleRate: 44100,
      channels: 2,
      quality: 4,
    },

    // Low Quality/Mobile
    low: {
      codec: 'libmp3lame',
      bitrate: 96,
      sampleRate: 22050,
      channels: 2,
      quality: 6,
    },
    mobile: {
      codec: 'aac',
      bitrate: 64,
      sampleRate: 22050,
      channels: 2,
      quality: null,
    },

    // Streaming Optimized
    stream_high: {
      codec: 'aac',
      bitrate: 256,
      sampleRate: 44100,
      channels: 2,
      quality: null,
    },
    stream_standard: {
      codec: 'aac',
      bitrate: 128,
      sampleRate: 44100,
      channels: 2,
      quality: null,
    },
  },

  // Format Settings
  FORMATS: {
    mp3: { extension: 'mp3', mimeType: 'audio/mpeg' },
    aac: { extension: 'm4a', mimeType: 'audio/mp4' },
    flac: { extension: 'flac', mimeType: 'audio/flac' },
    wav: { extension: 'wav', mimeType: 'audio/wav' },
    ogg: { extension: 'ogg', mimeType: 'audio/ogg' },
    opus: { extension: 'opus', mimeType: 'audio/opus' },
  },

  // Processing Settings
  PROCESSING: {
    maxConcurrentJobs: 4,
    chunkSize: 30, // 30 seconds for processing chunks
    waveformWidth: 1200,
    waveformHeight: 200,
    spectrumSize: 2048,
    previewDuration: 30, // 30 seconds preview
    fadeInOut: 2, // 2 seconds fade in/out
  },

  // Audio Effects
  EFFECTS: {
    normalization: {
      enabled: true,
      level: -16, // LUFS target level
    },
    compressor: {
      threshold: -20,
      ratio: 4,
      attack: 5,
      release: 50,
    },
    limiter: {
      enabled: true,
      level: -1, // dB
    },
    highpass: {
      frequency: 40, // Hz
    },
    lowpass: {
      frequency: 20000, // Hz
    },
  },

  // File Size Limits
  LIMITS: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    maxDuration: 3600, // 1 hour
    minDuration: 5, // 5 seconds
  },
} as const;

// Interfaces
export interface AudioProcessingOptions {
  quality?: keyof typeof AUDIO_CONFIG.QUALITY_PRESETS;
  formats?: string[];
  generateWaveform?: boolean;
  generatePreview?: boolean;
  applyEffects?: boolean;
  normalizeAudio?: boolean;
  extractMetadata?: boolean;
  outputDir?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate?: number;
  codec: string;
  format: string;
  size: number;

  // Audio Analysis
  loudnessLUFS?: number;
  dynamicRange?: number;
  peakLevel?: number;
  spectralCentroid?: number;
  tempo?: number;
  key?: string;

  // Technical Metadata
  encodingDetails: {
    encoder: string;
    profile?: string;
    level?: string;
  };

  // Quality Metrics
  qualityScore: number; // 0-100
  noiseLevel?: number;
  clippingDetected: boolean;
}

export interface WaveformData {
  peaks: number[];
  length: number;
  sampleRate: number;
  channels: number;
  duration: number;

  // Visual properties
  width: number;
  height: number;

  // Peak data for different zoom levels
  zoomLevels: {
    [level: number]: number[];
  };
}

export interface AudioProcessingResult {
  jobId: string;
  inputFile: string;
  outputs: Array<{
    format: string;
    quality: string;
    file: string;
    url: string;
    size: number;
    metadata: AudioMetadata;
  }>;

  waveform?: {
    data: WaveformData;
    imageUrl?: string;
    svgData?: string;
  };

  preview?: {
    file: string;
    url: string;
    startTime: number;
    duration: number;
  };

  processingTime: number;
  success: boolean;
  error?: string;
}

export class AudioProcessor {
  private activeJobs = new Map<string, ProcessingJob>();
  private jobQueue: Array<{ jobId: string; inputFile: string; options: AudioProcessingOptions }> =
    [];
  private isProcessing = false;

  constructor() {
    // Start processing queue
    setInterval(() => this.processQueue(), 1000);
  }

  /**
   * Process audio file with specified options
   */
  async processAudio(
    inputFile: string,
    options: AudioProcessingOptions = {}
  ): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    const jobId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Starting audio processing', {
      jobId,
      inputFile: path.basename(inputFile),
      options,
    });

    try {
      // Validate input file
      await this.validateInput(inputFile);

      // Extract basic metadata
      const inputMetadata = await this.extractMetadata(inputFile);

      // Determine output formats and qualities
      const formats = options.formats || ['mp3'];
      const quality = options.quality || 'standard';

      // Create processing job
      const job: ProcessingJob = {
        id: jobId,
        type: 'audio',
        status: 'processing',
        input: inputFile,
        outputs: [],
        startTime,
        progress: 0,
        metadata: {
          inputSize: (await fs.stat(inputFile)).size,
          duration: inputMetadata.duration,
          formats,
          quality,
        },
      };

      this.activeJobs.set(jobId, job);

      const outputs: AudioProcessingResult['outputs'] = [];

      // Process each format
      for (const format of formats) {
        const output = await this.transcodeAudio(inputFile, format, quality, options);
        outputs.push(output);

        // Update progress
        job.progress = (outputs.length / formats.length) * 0.8; // 80% for transcoding
      }

      // Generate waveform if requested
      let waveform: AudioProcessingResult['waveform'];
      if (options.generateWaveform !== false) {
        waveform = await this.generateWaveform(inputFile, options);
        job.progress = 0.9; // 90% complete
      }

      // Generate preview if requested
      let preview: AudioProcessingResult['preview'];
      if (options.generatePreview) {
        preview = await this.generatePreview(inputFile, inputMetadata, options);
        job.progress = 0.95; // 95% complete
      }

      // Mark job as complete
      job.status = 'completed';
      job.endTime = Date.now();
      job.progress = 1.0;

      const result: AudioProcessingResult = {
        jobId,
        inputFile,
        outputs,
        waveform,
        preview,
        processingTime: Date.now() - startTime,
        success: true,
      };

      logger.info('Audio processing completed', {
        jobId,
        processingTime: result.processingTime,
        outputCount: outputs.length,
      });

      return result;
    } catch (error) {
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.endTime = Date.now();
      }

      logger.error('Audio processing failed', { jobId, error });

      return {
        jobId,
        inputFile,
        outputs: [],
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Transcode audio to specific format and quality
   */
  private async transcodeAudio(
    inputFile: string,
    format: string,
    quality: string,
    options: AudioProcessingOptions
  ): Promise<AudioProcessingResult['outputs'][0]> {
    const preset =
      AUDIO_CONFIG.QUALITY_PRESETS[quality as keyof typeof AUDIO_CONFIG.QUALITY_PRESETS];
    const formatConfig = AUDIO_CONFIG.FORMATS[format as keyof typeof AUDIO_CONFIG.FORMATS];

    if (!preset || !formatConfig) {
      throw new Error(`Invalid format (${format}) or quality (${quality})`);
    }

    const outputDir = options.outputDir || path.dirname(inputFile);
    const baseName = path.parse(inputFile).name;
    const outputFile = path.join(outputDir, `${baseName}_${quality}.${formatConfig.extension}`);

    // Build FFmpeg command
    const command = await this.buildTranscodeCommand(
      inputFile,
      outputFile,
      preset,
      format,
      options
    );

    // Execute transcoding
    await this.executeFFmpeg(command);

    // Extract metadata from output
    const outputMetadata = await this.extractMetadata(outputFile);

    // Upload to S3
    const s3Key = `audio/processed/${baseName}_${quality}.${formatConfig.extension}`;
    const url = await uploadToS3(outputFile, s3Key);

    // Clean up local file
    await fs.unlink(outputFile);

    return {
      format,
      quality,
      file: outputFile,
      url,
      size: (await fs.stat(outputFile)).size,
      metadata: outputMetadata,
    };
  }

  /**
   * Build FFmpeg command for audio transcoding
   */
  private async buildTranscodeCommand(
    inputFile: string,
    outputFile: string,
    preset: typeof AUDIO_CONFIG.QUALITY_PRESETS.standard,
    format: string,
    options: AudioProcessingOptions
  ): Promise<string[]> {
    const args = [
      '-i',
      inputFile,
      '-y', // Overwrite output file
    ];

    // Audio codec
    if (preset.codec) {
      args.push('-c:a', preset.codec);
    }

    // Bitrate
    if (preset.bitrate) {
      args.push('-b:a', `${preset.bitrate}k`);
    }

    // Sample rate
    if (preset.sampleRate) {
      args.push('-ar', preset.sampleRate.toString());
    }

    // Channels
    if (preset.channels) {
      args.push('-ac', preset.channels.toString());
    }

    // Quality (for VBR encoders)
    if (preset.quality !== null && (preset.codec === 'libmp3lame' || preset.codec === 'flac')) {
      args.push('-q:a', preset.quality.toString());
    }

    // Apply audio effects if requested
    if (options.applyEffects) {
      const filters = this.buildAudioFilters(options);
      if (filters.length > 0) {
        args.push('-af', filters.join(','));
      }
    }

    // Normalization
    if (options.normalizeAudio) {
      args.push('-filter:a', `loudnorm=I=${AUDIO_CONFIG.EFFECTS.normalization.level}`);
    }

    // Metadata
    args.push('-metadata', 'encoder=DirectFanz Audio Processor');

    // Output file
    args.push(outputFile);

    return args;
  }

  /**
   * Build audio filter chain
   */
  private buildAudioFilters(options: AudioProcessingOptions): string[] {
    const filters: string[] = [];

    // High-pass filter (remove low-frequency noise)
    filters.push(`highpass=f=${AUDIO_CONFIG.EFFECTS.highpass.frequency}`);

    // Low-pass filter (anti-aliasing)
    filters.push(`lowpass=f=${AUDIO_CONFIG.EFFECTS.lowpass.frequency}`);

    // Dynamic range compression
    const comp = AUDIO_CONFIG.EFFECTS.compressor;
    filters.push(
      `compand=attacks=${comp.attack / 1000}:decays=${comp.release / 1000}:` +
        `points=-90/-90|-${comp.threshold}/-${comp.threshold}|` +
        `-${comp.threshold}/0:soft-knee=0.01:gain=0:volume=0:delay=0.02`
    );

    // Limiter (prevent clipping)
    if (AUDIO_CONFIG.EFFECTS.limiter.enabled) {
      filters.push(`alimiter=limit=${AUDIO_CONFIG.EFFECTS.limiter.level}dB:attack=5:release=50`);
    }

    return filters;
  }

  /**
   * Execute FFmpeg command
   */
  private async executeFFmpeg(command: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', command);

      let stderr = '';

      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });

      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', error => {
        reject(new Error(`Failed to start FFmpeg: ${error.message}`));
      });
    });
  }

  /**
   * Extract audio metadata using FFprobe
   */
  async extractMetadata(filePath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', data => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', data => {
        stderr += data.toString();
      });

      ffprobe.on('close', code => {
        if (code !== 0) {
          reject(new Error(`FFprobe failed: ${stderr}`));
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');

          if (!audioStream) {
            reject(new Error('No audio stream found'));
            return;
          }

          const metadata: AudioMetadata = {
            duration: parseFloat(data.format.duration),
            sampleRate: parseInt(audioStream.sample_rate),
            channels: audioStream.channels,
            bitrate: parseInt(data.format.bit_rate) || undefined,
            codec: audioStream.codec_name,
            format: data.format.format_name,
            size: parseInt(data.format.size),

            encodingDetails: {
              encoder: audioStream.codec_long_name || audioStream.codec_name,
              profile: audioStream.profile,
              level: audioStream.level?.toString(),
            },

            qualityScore: this.calculateQualityScore(audioStream, data.format),
            clippingDetected: false, // Would need additional analysis
          };

          resolve(metadata);
        } catch (error) {
          reject(new Error(`Failed to parse metadata: ${error}`));
        }
      });
    });
  }

  /**
   * Calculate quality score based on technical parameters
   */
  private calculateQualityScore(stream: any, format: any): number {
    let score = 50; // Base score

    // Sample rate scoring
    const sampleRate = parseInt(stream.sample_rate);
    if (sampleRate >= 44100) score += 15;
    else if (sampleRate >= 22050) score += 10;
    else if (sampleRate >= 16000) score += 5;

    // Bitrate scoring
    const bitrate = parseInt(format.bit_rate) || 0;
    if (bitrate >= 320000) score += 20;
    else if (bitrate >= 192000) score += 15;
    else if (bitrate >= 128000) score += 10;
    else if (bitrate >= 96000) score += 5;

    // Channel scoring
    if (stream.channels >= 2) score += 10;
    else if (stream.channels === 1) score += 5;

    // Codec quality
    if (stream.codec_name === 'flac') score += 5;
    else if (stream.codec_name === 'aac') score += 3;
    else if (stream.codec_name === 'mp3') score += 2;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate waveform visualization
   */
  private async generateWaveform(
    inputFile: string,
    options: AudioProcessingOptions
  ): Promise<AudioProcessingResult['waveform']> {
    const tempDir = path.join(path.dirname(inputFile), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const waveformFile = path.join(tempDir, `waveform_${Date.now()}.json`);
    const imageFile = path.join(tempDir, `waveform_${Date.now()}.png`);

    try {
      // Extract waveform data using FFmpeg
      const waveformData = await this.extractWaveformData(inputFile, waveformFile);

      // Generate waveform image
      await this.generateWaveformImage(waveformData, imageFile);

      // Upload image to S3
      const baseName = path.parse(inputFile).name;
      const s3Key = `audio/waveforms/${baseName}_waveform.png`;
      const imageUrl = await uploadToS3(imageFile, s3Key);

      // Generate SVG data for web use
      const svgData = this.generateWaveformSVG(waveformData);

      return {
        data: waveformData,
        imageUrl,
        svgData,
      };
    } finally {
      // Clean up temp files
      try {
        await fs.unlink(waveformFile);
        await fs.unlink(imageFile);
        await fs.rmdir(tempDir);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Extract waveform data using FFmpeg
   */
  private async extractWaveformData(inputFile: string, outputFile: string): Promise<WaveformData> {
    const width = AUDIO_CONFIG.PROCESSING.waveformWidth;

    // Extract audio peaks
    const command = [
      '-i',
      inputFile,
      '-filter:a',
      `aresample=8000,asetnsamples=${width}`,
      '-map',
      '0:a',
      '-c:a',
      'pcm_s16le',
      '-f',
      'wav',
      'pipe:1',
    ];

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', command);

      const chunks: Buffer[] = [];
      let stderr = '';

      ffmpeg.stdout.on('data', chunk => {
        chunks.push(chunk);
      });

      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });

      ffmpeg.on('close', async code => {
        if (code !== 0) {
          reject(new Error(`FFmpeg failed: ${stderr}`));
          return;
        }

        try {
          const buffer = Buffer.concat(chunks);
          const peaks = this.extractPeaksFromBuffer(buffer, width);

          // Get metadata for the waveform
          const metadata = await this.extractMetadata(inputFile);

          const waveformData: WaveformData = {
            peaks,
            length: peaks.length,
            sampleRate: 8000, // Resampled rate
            channels: 1, // Mono for waveform
            duration: metadata.duration,
            width,
            height: AUDIO_CONFIG.PROCESSING.waveformHeight,
            zoomLevels: {
              1: peaks,
              2: this.decimateArray(peaks, 2),
              4: this.decimateArray(peaks, 4),
              8: this.decimateArray(peaks, 8),
            },
          };

          resolve(waveformData);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Extract peak values from audio buffer
   */
  private extractPeaksFromBuffer(buffer: Buffer, targetLength: number): number[] {
    const samples: number[] = [];

    // Skip WAV header (44 bytes)
    const dataStart = 44;
    const bytesPerSample = 2; // 16-bit PCM

    for (let i = dataStart; i < buffer.length; i += bytesPerSample) {
      if (i + bytesPerSample > buffer.length) break;

      // Read 16-bit little-endian sample
      const sample = buffer.readInt16LE(i);
      samples.push(Math.abs(sample) / 32768); // Normalize to 0-1
    }

    // Group samples into peaks
    const peaks: number[] = [];
    const samplesPerPeak = Math.floor(samples.length / targetLength);

    for (let i = 0; i < targetLength; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, samples.length);

      let max = 0;
      for (let j = start; j < end; j++) {
        max = Math.max(max, samples[j]);
      }

      peaks.push(max);
    }

    return peaks;
  }

  /**
   * Generate waveform image using canvas
   */
  private async generateWaveformImage(
    waveformData: WaveformData,
    outputFile: string
  ): Promise<void> {
    // This would typically use a canvas library like node-canvas
    // For now, we'll create a simple PNG using ImageMagick or similar

    const { width, height, peaks } = waveformData;
    const barWidth = width / peaks.length;

    // Build ImageMagick command to draw waveform
    const drawCommands = peaks
      .map((peak, i) => {
        const barHeight = peak * height;
        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        return `rectangle ${x},${y} ${x + barWidth},${y + barHeight}`;
      })
      .join(' ');

    const command = [
      '-size',
      `${width}x${height}`,
      'canvas:black',
      '-fill',
      'white',
      '-draw',
      drawCommands,
      outputFile,
    ];

    return new Promise((resolve, reject) => {
      const convert = spawn('convert', command);

      convert.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ImageMagick failed with code ${code}`));
        }
      });

      convert.on('error', error => {
        reject(new Error(`Failed to start ImageMagick: ${error.message}`));
      });
    });
  }

  /**
   * Generate SVG waveform data
   */
  private generateWaveformSVG(waveformData: WaveformData): string {
    const { width, height, peaks } = waveformData;
    const barWidth = width / peaks.length;

    const bars = peaks
      .map((peak, i) => {
        const barHeight = peak * height;
        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="currentColor"/>`;
      })
      .join('');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        ${bars}
      </svg>
    `;
  }

  /**
   * Generate audio preview clip
   */
  private async generatePreview(
    inputFile: string,
    metadata: AudioMetadata,
    options: AudioProcessingOptions
  ): Promise<AudioProcessingResult['preview']> {
    const duration = AUDIO_CONFIG.PROCESSING.previewDuration;
    const fadeTime = AUDIO_CONFIG.PROCESSING.fadeInOut;

    // Choose the best preview start time (skip silence, find interesting part)
    const startTime = await this.findOptimalPreviewStart(inputFile, metadata, duration);

    const outputDir = options.outputDir || path.dirname(inputFile);
    const baseName = path.parse(inputFile).name;
    const previewFile = path.join(outputDir, `${baseName}_preview.mp3`);

    // Build FFmpeg command for preview
    const command = [
      '-i',
      inputFile,
      '-ss',
      startTime.toString(),
      '-t',
      duration.toString(),
      '-af',
      `afade=t=in:ss=0:d=${fadeTime},afade=t=out:st=${duration - fadeTime}:d=${fadeTime}`,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      '-y',
      previewFile,
    ];

    await this.executeFFmpeg(command);

    // Upload to S3
    const s3Key = `audio/previews/${baseName}_preview.mp3`;
    const url = await uploadToS3(previewFile, s3Key);

    // Clean up local file
    await fs.unlink(previewFile);

    return {
      file: previewFile,
      url,
      startTime,
      duration,
    };
  }

  /**
   * Find optimal preview start time
   */
  private async findOptimalPreviewStart(
    inputFile: string,
    metadata: AudioMetadata,
    previewDuration: number
  ): Promise<number> {
    // Simple heuristic: start at 25% of the track length
    // In a production system, you'd analyze the audio to find the most interesting part
    const trackLength = metadata.duration;

    // Don't start too early or too late
    const minStart = 5; // 5 seconds minimum
    const maxStart = Math.max(minStart, trackLength - previewDuration - 5);

    const start = Math.min(maxStart, trackLength * 0.25);

    return Math.max(minStart, start);
  }

  /**
   * Validate input audio file
   */
  private async validateInput(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        throw new Error('Input is not a file');
      }

      if (stats.size > AUDIO_CONFIG.LIMITS.maxFileSize) {
        throw new Error(
          `File too large: ${stats.size} bytes (max: ${AUDIO_CONFIG.LIMITS.maxFileSize})`
        );
      }

      // Check if file is accessible
      await fs.access(filePath, fs.constants.R_OK);

      // Basic format validation using FFprobe
      const metadata = await this.extractMetadata(filePath);

      if (metadata.duration < AUDIO_CONFIG.LIMITS.minDuration) {
        throw new Error(
          `Audio too short: ${metadata.duration}s (min: ${AUDIO_CONFIG.LIMITS.minDuration}s)`
        );
      }

      if (metadata.duration > AUDIO_CONFIG.LIMITS.maxDuration) {
        throw new Error(
          `Audio too long: ${metadata.duration}s (max: ${AUDIO_CONFIG.LIMITS.maxDuration}s)`
        );
      }
    } catch (error) {
      throw new Error(`Input validation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Utility function to decimate array (reduce size by factor)
   */
  private decimateArray(array: number[], factor: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < array.length; i += factor) {
      // Take max value in the group
      let max = 0;
      for (let j = 0; j < factor && i + j < array.length; j++) {
        max = Math.max(max, array[i + j]);
      }
      result.push(max);
    }

    return result;
  }

  /**
   * Process job queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) {
      return;
    }

    if (this.activeJobs.size >= AUDIO_CONFIG.PROCESSING.maxConcurrentJobs) {
      return;
    }

    this.isProcessing = true;

    try {
      const job = this.jobQueue.shift();
      if (job) {
        // Process in background
        this.processAudio(job.inputFile, job.options).catch(error => {
          logger.error('Background audio processing failed', { jobId: job.jobId, error });
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Add job to processing queue
   */
  queueAudioProcessing(inputFile: string, options: AudioProcessingOptions = {}): string {
    const jobId = `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.jobQueue.push({
      jobId,
      inputFile,
      options,
    });

    logger.info('Audio processing job queued', {
      jobId,
      inputFile: path.basename(inputFile),
      queueLength: this.jobQueue.length,
    });

    return jobId;
  }

  /**
   * Get processing job status
   */
  getJobStatus(jobId: string): ProcessingJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Cancel processing job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'cancelled';
      this.activeJobs.delete(jobId);
      return true;
    }

    // Remove from queue if not started yet
    const queueIndex = this.jobQueue.findIndex(j => j.jobId === jobId);
    if (queueIndex !== -1) {
      this.jobQueue.splice(queueIndex, 1);
      return true;
    }

    return false;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    active: number;
    pending: number;
    maxConcurrent: number;
  } {
    return {
      active: this.activeJobs.size,
      pending: this.jobQueue.length,
      maxConcurrent: AUDIO_CONFIG.PROCESSING.maxConcurrentJobs,
    };
  }
}

// Export singleton instance
export const audioProcessor = new AudioProcessor();
