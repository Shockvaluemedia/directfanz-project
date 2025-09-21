import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { lookup as mimeTypeLookup } from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { ContentType } from '@/lib/types/enums';

// Set ffmpeg binary path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Local storage configuration
const STORAGE_DIR = process.env.STORAGE_DIR || 'public/uploads';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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

export class LocalFileUploader {
  /**
   * Ensure storage directory exists
   */
  static async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(STORAGE_DIR);
    } catch {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      console.log(`Created storage directory: ${STORAGE_DIR}`);
    }
  }

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
   * Generate unique file path for local storage
   */
  static generateFilePath(userId: string, contentType: ContentType, fileName: string): string {
    const ext = path.extname(fileName);
    const uuid = uuidv4();
    const timestamp = Date.now();

    return `content/${userId}/${contentType.toLowerCase()}/${timestamp}-${uuid}${ext}`;
  }

  /**
   * Save file to local storage
   */
  static async saveToLocal(
    buffer: Buffer,
    filePath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    try {
      await this.ensureStorageDir();
      
      const fullPath = path.join(STORAGE_DIR, filePath);
      const directory = path.dirname(fullPath);
      
      // Ensure subdirectory exists
      await fs.mkdir(directory, { recursive: true });
      
      // Write file
      await fs.writeFile(fullPath, buffer);
      
      // Simulate progress if callback provided
      if (onProgress) {
        onProgress({
          loaded: buffer.length,
          total: buffer.length,
          percentage: 100,
        });
      }
      
      return `${BASE_URL}/uploads/${filePath}`;
    } catch (error) {
      console.error('Local storage error:', error);
      throw new Error('Failed to save file to local storage');
    }
  }

  /**
   * Delete file from local storage
   */
  static async deleteFromLocal(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(STORAGE_DIR, filePath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('Local delete error:', error);
      throw new Error('Failed to delete file from local storage');
    }
  }

  /**
   * Process and save image
   */
  static async processImage(
    buffer: Buffer,
    filePath: string
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

    // Save main image
    const url = await this.saveToLocal(optimizedBuffer, filePath);

    // Save thumbnail
    const thumbnailPath = filePath.replace(/\.[^/.]+$/, '-thumb.jpg');
    const thumbnailUrl = await this.saveToLocal(thumbnailBuffer, thumbnailPath);

    return {
      url,
      thumbnailUrl,
      width: metadata.width || 0,
      height: metadata.height || 0,
      fileSize: optimizedBuffer.length,
    };
  }

  /**
   * Process and save audio
   */
  static async processAudio(
    buffer: Buffer,
    filePath: string,
    fileName: string
  ): Promise<{
    url: string;
    thumbnailUrl?: string;
    duration: number;
    fileSize: number;
  }> {
    return new Promise(async (resolve, reject) => {
      // Create temporary file for processing
      const tempPath = `/tmp/${uuidv4()}-${fileName}`;
      const outputPath = `/tmp/${uuidv4()}-processed.mp3`;

      try {
        // Write buffer to temp file
        await fs.writeFile(tempPath, buffer);

        // Process audio with ffmpeg
        ffmpeg(tempPath)
          .audioCodec('mp3')
          .audioBitrate(128)
          .on('end', async () => {
            try {
              // Read processed file
              const processedBuffer = await fs.readFile(outputPath);

              // Save to local storage
              const url = await this.saveToLocal(processedBuffer, filePath);

              // Get audio duration
              ffmpeg.ffprobe(tempPath, async (err, metadata) => {
                if (err) {
                  reject(new Error('Failed to get audio metadata'));
                  return;
                }

                const duration = metadata.format.duration || 0;

                // Cleanup temp files
                await fs.unlink(tempPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});

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
          .on('error', async (err) => {
            // Cleanup on error
            await fs.unlink(tempPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            reject(new Error(`Audio processing failed: ${err.message}`));
          })
          .save(outputPath);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Process and save video
   */
  static async processVideo(
    buffer: Buffer,
    filePath: string,
    fileName: string
  ): Promise<{
    url: string;
    thumbnailUrl: string;
    duration: number;
    fileSize: number;
    width: number;
    height: number;
  }> {
    return new Promise(async (resolve, reject) => {
      const tempPath = `/tmp/${uuidv4()}-${fileName}`;
      const outputPath = `/tmp/${uuidv4()}-processed.mp4`;
      const thumbnailPath = `/tmp/${uuidv4()}-thumb.jpg`;

      try {
        // Write buffer to temp file
        await fs.writeFile(tempPath, buffer);

        // Process video with ffmpeg
        ffmpeg(tempPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .size('1280x720')
          .videoBitrate(2000)
          .audioBitrate(128)
          .on('end', async () => {
            try {
              // Read processed files
              const processedBuffer = await fs.readFile(outputPath);
              const thumbnailBuffer = await fs.readFile(thumbnailPath);

              // Save video to local storage
              const url = await this.saveToLocal(processedBuffer, filePath);

              // Save thumbnail
              const thumbnailFilePath = filePath.replace(/\.[^/.]+$/, '-thumb.jpg');
              const thumbnailUrl = await this.saveToLocal(thumbnailBuffer, thumbnailFilePath);

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
                await fs.unlink(tempPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});
                await fs.unlink(thumbnailPath).catch(() => {});

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
          .on('error', async (err) => {
            // Cleanup on error
            await fs.unlink(tempPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            await fs.unlink(thumbnailPath).catch(() => {});
            reject(new Error(`Video processing failed: ${err.message}`));
          })
          .screenshot({
            timestamps: ['10%'],
            filename: path.basename(thumbnailPath),
            folder: path.dirname(thumbnailPath),
          })
          .save(outputPath);
      } catch (error) {
        reject(error);
      }
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

    // Generate unique file path
    const filePath = this.generateFilePath(userId, contentType, file.name);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process based on content type
    switch (contentType) {
      case ContentType.IMAGE:
        const imageResult = await this.processImage(buffer, filePath);
        return {
          fileUrl: imageResult.url,
          thumbnailUrl: imageResult.thumbnailUrl,
          fileSize: imageResult.fileSize,
          format: path.extname(file.name).substring(1),
          width: imageResult.width,
          height: imageResult.height,
        };

      case ContentType.AUDIO:
        const audioResult = await this.processAudio(buffer, filePath, file.name);
        return {
          fileUrl: audioResult.url,
          thumbnailUrl: audioResult.thumbnailUrl,
          fileSize: audioResult.fileSize,
          duration: audioResult.duration,
          format: path.extname(file.name).substring(1),
        };

      case ContentType.VIDEO:
        const videoResult = await this.processVideo(buffer, filePath, file.name);
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
        const docUrl = await this.saveToLocal(
          buffer,
          filePath
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