import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { lookup as mimeTypeLookup } from 'mime-types';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ContentType } from '@/lib/types/enums';

// Set ffmpeg binary path
if (ffmpegInstaller?.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
const CDN_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN || process.env.AWS_S3_BUCKET_NAME;

// File upload configuration
const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024, // 10MB for images
  AUDIO: 100 * 1024 * 1024, // 100MB for audio
  VIDEO: 500 * 1024 * 1024, // 500MB for video
  DOCUMENT: 50 * 1024 * 1024, // 50MB for documents
};

const ALLOWED_EXTENSIONS = {
  IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  AUDIO: ['.mp3', '.wav', '.flac', '.m4a', '.ogg'],
  VIDEO: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  DOCUMENT: ['.pdf', '.doc', '.docx', '.txt'],
};

export interface FileUploadResult {
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  duration?: number;
  format: string;
  width?: number;
  height?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export class FileUploader {
  /**
   * Validate file before upload
   */
  static validateFile(file: File, contentType: ContentType): { isValid: boolean; error?: string } {
    const ext = path.extname(file.name).toLowerCase();
    const allowedExtensions = ALLOWED_EXTENSIONS[contentType];
    const maxSize = MAX_FILE_SIZES[contentType];

    if (!allowedExtensions.includes(ext)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`,
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get content type from file
   */
  static getContentType(file: File): ContentType {
    const ext = path.extname(file.name).toLowerCase();

    if (ALLOWED_EXTENSIONS.IMAGE.includes(ext)) return ContentType.IMAGE;
    if (ALLOWED_EXTENSIONS.AUDIO.includes(ext)) return ContentType.AUDIO;
    if (ALLOWED_EXTENSIONS.VIDEO.includes(ext)) return ContentType.VIDEO;
    if (ALLOWED_EXTENSIONS.DOCUMENT.includes(ext)) return ContentType.DOCUMENT;

    throw new Error('Unsupported file type');
  }

  /**
   * Generate unique file key for S3
   */
  static generateFileKey(userId: string, contentType: ContentType, fileName: string): string {
    const ext = path.extname(fileName);
    const uuid = uuidv4();
    const timestamp = Date.now();

    return `content/${userId}/${contentType.toLowerCase()}/${timestamp}-${uuid}${ext}`;
  }

  /**
   * Upload file to S3
   */
  static async uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'max-age=31536000', // 1 year cache
    });

    try {
      await s3Client.send(command);
      return `https://${CDN_DOMAIN}/${key}`;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  /**
   * Delete file from S3
   */
  static async deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    try {
      await s3Client.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error('Failed to delete file from storage');
    }
  }

  /**
   * Generate presigned URL for direct upload
   */
  static async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600 // 1 hour
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Process and upload image
   */
  static async processImage(
    buffer: Buffer,
    key: string
  ): Promise<{
    url: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    fileSize: number;
  }> {
    // Get image metadata
    const metadata = await sharp(buffer).metadata();

    // Optimize main image
    const optimizedBuffer = await sharp(buffer)
      .jpeg({ quality: 85, progressive: true })
      .png({ quality: 85, progressive: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate thumbnail
    const thumbnailBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload main image
    const url = await this.uploadToS3(optimizedBuffer, key, 'image/jpeg');

    // Upload thumbnail
    const thumbnailKey = key.replace(/\.[^/.]+$/, '-thumb.jpg');
    const thumbnailUrl = await this.uploadToS3(thumbnailBuffer, thumbnailKey, 'image/jpeg');

    return {
      url,
      thumbnailUrl,
      width: metadata.width || 0,
      height: metadata.height || 0,
      fileSize: optimizedBuffer.length,
    };
  }

  /**
   * Process and upload audio
   */
  static async processAudio(
    buffer: Buffer,
    key: string,
    fileName: string
  ): Promise<{
    url: string;
    thumbnailUrl?: string;
    duration: number;
    fileSize: number;
  }> {
    return new Promise((resolve, reject) => {
      // Create temporary file path for processing
      const tempPath = `/tmp/${uuidv4()}-${fileName}`;
      const outputPath = `/tmp/${uuidv4()}-processed.mp3`;

      // Write buffer to temp file
      require('fs').writeFileSync(tempPath, buffer);

      // Process audio with ffmpeg
      ffmpeg(tempPath)
        .audioCodec('mp3')
        .audioBitrate(128)
        .on('end', async () => {
          try {
            // Read processed file
            const processedBuffer = require('fs').readFileSync(outputPath);

            // Upload to S3
            const url = await this.uploadToS3(processedBuffer, key, 'audio/mpeg');

            // Get audio duration
            ffmpeg.ffprobe(tempPath, async (err, metadata) => {
              if (err) {
                reject(new Error('Failed to get audio metadata'));
                return;
              }

              const duration = metadata.format.duration || 0;

              // Cleanup temp files
              require('fs').unlinkSync(tempPath);
              require('fs').unlinkSync(outputPath);

              resolve({
                url,
                duration,
                fileSize: processedBuffer.length,
              });
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', err => {
          // Cleanup on error
          try {
            require('fs').unlinkSync(tempPath);
            if (require('fs').existsSync(outputPath)) {
              require('fs').unlinkSync(outputPath);
            }
          } catch {}
          reject(new Error(`Audio processing failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  /**
   * Process and upload video
   */
  static async processVideo(
    buffer: Buffer,
    key: string,
    fileName: string
  ): Promise<{
    url: string;
    thumbnailUrl: string;
    duration: number;
    fileSize: number;
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      const tempPath = `/tmp/${uuidv4()}-${fileName}`;
      const outputPath = `/tmp/${uuidv4()}-processed.mp4`;
      const thumbnailPath = `/tmp/${uuidv4()}-thumb.jpg`;

      // Write buffer to temp file
      require('fs').writeFileSync(tempPath, buffer);

      // Process video with ffmpeg
      ffmpeg(tempPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1280x720')
        .videoBitrate(2000)
        .audioBitrate(128)
        .on('end', async () => {
          try {
            // Read processed file
            const processedBuffer = require('fs').readFileSync(outputPath);
            const thumbnailBuffer = require('fs').readFileSync(thumbnailPath);

            // Upload video to S3
            const url = await this.uploadToS3(processedBuffer, key, 'video/mp4');

            // Upload thumbnail
            const thumbnailKey = key.replace(/\.[^/.]+$/, '-thumb.jpg');
            const thumbnailUrl = await this.uploadToS3(thumbnailBuffer, thumbnailKey, 'image/jpeg');

            // Get video metadata
            ffmpeg.ffprobe(tempPath, async (err, metadata) => {
              if (err) {
                reject(new Error('Failed to get video metadata'));
                return;
              }

              const videoStream = metadata.streams.find(s => s.codec_type === 'video');
              const duration = metadata.format.duration || 0;
              const width = videoStream?.width || 0;
              const height = videoStream?.height || 0;

              // Cleanup temp files
              [tempPath, outputPath, thumbnailPath].forEach(path => {
                try {
                  require('fs').unlinkSync(path);
                } catch {}
              });

              resolve({
                url,
                thumbnailUrl,
                duration,
                fileSize: processedBuffer.length,
                width,
                height,
              });
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', err => {
          // Cleanup on error
          [tempPath, outputPath, thumbnailPath].forEach(path => {
            try {
              if (require('fs').existsSync(path)) {
                require('fs').unlinkSync(path);
              }
            } catch {}
          });
          reject(new Error(`Video processing failed: ${err.message}`));
        })
        .screenshot({
          timestamps: ['10%'],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
        })
        .save(outputPath);
    });
  }

  /**
   * Main upload function
   */
  static async uploadFile(
    file: File,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<FileUploadResult> {
    // Get content type and validate
    const contentType = this.getContentType(file);
    const validation = this.validateFile(file, contentType);

    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Generate unique key
    const key = this.generateFileKey(userId, contentType, file.name);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process based on content type
    switch (contentType) {
      case ContentType.IMAGE:
        const imageResult = await this.processImage(buffer, key);
        return {
          fileUrl: imageResult.url,
          thumbnailUrl: imageResult.thumbnailUrl,
          fileSize: imageResult.fileSize,
          format: path.extname(file.name).substring(1),
          width: imageResult.width,
          height: imageResult.height,
        };

      case ContentType.AUDIO:
        const audioResult = await this.processAudio(buffer, key, file.name);
        return {
          fileUrl: audioResult.url,
          thumbnailUrl: audioResult.thumbnailUrl,
          fileSize: audioResult.fileSize,
          duration: audioResult.duration,
          format: path.extname(file.name).substring(1),
        };

      case ContentType.VIDEO:
        const videoResult = await this.processVideo(buffer, key, file.name);
        return {
          fileUrl: videoResult.url,
          thumbnailUrl: videoResult.thumbnailUrl,
          fileSize: videoResult.fileSize,
          duration: videoResult.duration,
          format: path.extname(file.name).substring(1),
          width: videoResult.width,
          height: videoResult.height,
        };

      case ContentType.DOCUMENT:
        const docUrl = await this.uploadToS3(
          buffer,
          key,
          mimeTypeLookup(file.name) || 'application/octet-stream'
        );
        return {
          fileUrl: docUrl,
          fileSize: buffer.length,
          format: path.extname(file.name).substring(1),
        };

      default:
        throw new Error('Unsupported content type');
    }
  }
}

export { ContentType, MAX_FILE_SIZES, ALLOWED_EXTENSIONS };
