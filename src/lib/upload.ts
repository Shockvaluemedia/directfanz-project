import { put, del } from '@vercel/blob';
import sharp from 'sharp';
import { lookup as mimeTypeLookup } from 'mime-types';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ContentType } from '@/lib/types/enums';

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
   * Generate unique file key
   */
  static generateFileKey(userId: string, contentType: ContentType, fileName: string): string {
    const ext = path.extname(fileName);
    const uuid = uuidv4();
    const timestamp = Date.now();

    return `content/${userId}/${contentType.toLowerCase()}/${timestamp}-${uuid}${ext}`;
  }

  /**
   * Upload buffer to Vercel Blob
   */
  static async uploadToBlob(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    try {
      const blob = await put(key, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      });
      return blob.url;
    } catch (error) {
      console.error('Blob upload error:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  /**
   * Delete file from Vercel Blob
   */
  static async deleteFromBlob(url: string): Promise<void> {
    try {
      await del(url);
    } catch (error) {
      console.error('Blob delete error:', error);
      throw new Error('Failed to delete file from storage');
    }
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
    const metadata = await sharp(buffer).metadata();

    // Optimize main image
    const optimizedBuffer = await sharp(buffer)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    // Generate thumbnail
    const thumbnailBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const url = await this.uploadToBlob(optimizedBuffer, key, 'image/jpeg');

    const thumbnailKey = key.replace(/\.[^/.]+$/, '-thumb.jpg');
    const thumbnailUrl = await this.uploadToBlob(thumbnailBuffer, thumbnailKey, 'image/jpeg');

    return {
      url,
      thumbnailUrl,
      width: metadata.width || 0,
      height: metadata.height || 0,
      fileSize: optimizedBuffer.length,
    };
  }

  /**
   * Upload audio file (no server-side transcoding — Vercel serverless has no ffmpeg)
   */
  static async processAudio(
    buffer: Buffer,
    key: string,
  ): Promise<{
    url: string;
    fileSize: number;
  }> {
    const url = await this.uploadToBlob(buffer, key, 'audio/mpeg');
    return { url, fileSize: buffer.length };
  }

  /**
   * Upload video file (no server-side transcoding — Vercel serverless has no ffmpeg)
   */
  static async processVideo(
    buffer: Buffer,
    key: string,
  ): Promise<{
    url: string;
    fileSize: number;
  }> {
    const url = await this.uploadToBlob(buffer, key, 'video/mp4');
    return { url, fileSize: buffer.length };
  }

  /**
   * Main upload function
   */
  static async uploadFile(
    file: File,
    userId: string,
  ): Promise<FileUploadResult> {
    const contentType = this.getContentType(file);
    const validation = this.validateFile(file, contentType);

    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const key = this.generateFileKey(userId, contentType, file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    switch (contentType) {
      case ContentType.IMAGE: {
        const imageResult = await this.processImage(buffer, key);
        return {
          fileUrl: imageResult.url,
          thumbnailUrl: imageResult.thumbnailUrl,
          fileSize: imageResult.fileSize,
          format: path.extname(file.name).substring(1),
          width: imageResult.width,
          height: imageResult.height,
        };
      }

      case ContentType.AUDIO: {
        const audioResult = await this.processAudio(buffer, key);
        return {
          fileUrl: audioResult.url,
          fileSize: audioResult.fileSize,
          format: path.extname(file.name).substring(1),
        };
      }

      case ContentType.VIDEO: {
        const videoResult = await this.processVideo(buffer, key);
        return {
          fileUrl: videoResult.url,
          fileSize: videoResult.fileSize,
          format: path.extname(file.name).substring(1),
        };
      }

      case ContentType.DOCUMENT: {
        const docUrl = await this.uploadToBlob(
          buffer,
          key,
          mimeTypeLookup(file.name) || 'application/octet-stream'
        );
        return {
          fileUrl: docUrl,
          fileSize: buffer.length,
          format: path.extname(file.name).substring(1),
        };
      }

      default:
        throw new Error('Unsupported content type');
    }
  }
}

export { ContentType, MAX_FILE_SIZES, ALLOWED_EXTENSIONS };
