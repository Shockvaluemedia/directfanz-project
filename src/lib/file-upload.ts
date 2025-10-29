import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

export interface UploadConfig {
  maxFileSize: number;
  allowedTypes: string[];
  destination: string;
  generateThumbnails: boolean;
}

export interface ProcessedFile {
  originalName: string;
  filename: string;
  path: string;
  processedPath?: string;
  size: number;
  mimetype: string;
  thumbnailPath?: string;
  duration?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  metadata?: any;
}

export interface FileProcessOptions {
  generateThumbnail?: boolean;
  optimizeImage?: boolean;
  extractMetadata?: boolean;
}

// Default configurations for different content types
export const uploadConfigs = {
  image: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    destination: 'uploads/images',
    generateThumbnails: true,
  },
  video: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    destination: 'uploads/videos',
    generateThumbnails: true,
  },
  audio: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a'],
    destination: 'uploads/audio',
    generateThumbnails: false,
  },
  document: {
    maxFileSize: 25 * 1024 * 1024, // 25MB
    allowedTypes: ['application/pdf', 'text/plain'],
    destination: 'uploads/documents',
    generateThumbnails: false,
  },
};

export class FileProcessor {
  private baseDir: string;

  constructor(baseDir: string = './public') {
    this.baseDir = baseDir;
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, dirPath);
    try {
      await fs.access(fullPath);
    } catch {
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  generateFilename(originalName: string, extension?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = extension || path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '_');
    return `${baseName}_${timestamp}_${random}${ext}`;
  }

  async processImage(file: Buffer, originalName: string, config: UploadConfig): Promise<ProcessedFile> {
    await this.ensureDirectory(config.destination);
    
    const filename = this.generateFilename(originalName);
    const filePath = path.join(config.destination, filename);
    const fullPath = path.join(this.baseDir, filePath);

    // Process image with Sharp
    const image = sharp(file);
    const metadata = await image.metadata();
    
    // Optimize and save the image
    await image
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(fullPath);

    const stats = await fs.stat(fullPath);
    
    const processedFile: ProcessedFile = {
      originalName,
      filename,
      path: filePath,
      size: stats.size,
      mimetype: 'image/jpeg',
      dimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
    };

    // Generate thumbnail if required
    if (config.generateThumbnails) {
      const thumbnailFilename = this.generateFilename(originalName, '_thumb.jpg');
      const thumbnailPath = path.join(config.destination, thumbnailFilename);
      const thumbnailFullPath = path.join(this.baseDir, thumbnailPath);

      await image
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbnailFullPath);

      processedFile.thumbnailPath = thumbnailPath;
    }

    return processedFile;
  }

  async processVideo(file: Buffer, originalName: string, config: UploadConfig): Promise<ProcessedFile> {
    await this.ensureDirectory(config.destination);
    
    const filename = this.generateFilename(originalName);
    const filePath = path.join(config.destination, filename);
    const fullPath = path.join(this.baseDir, filePath);

    // Save the original file
    await fs.writeFile(fullPath, file);
    const stats = await fs.stat(fullPath);

    const processedFile: ProcessedFile = {
      originalName,
      filename,
      path: filePath,
      size: stats.size,
      mimetype: this.getMimetypeFromExtension(originalName),
    };

    // Generate video thumbnail using FFmpeg (simplified for demo)
    if (config.generateThumbnails) {
      const thumbnailFilename = this.generateFilename(originalName, '_thumb.jpg');
      const thumbnailPath = path.join(config.destination, thumbnailFilename);
      
      // In a real implementation, you'd use FFmpeg to generate thumbnails
      // For now, we'll create a placeholder
      processedFile.thumbnailPath = thumbnailPath;
    }

    return processedFile;
  }

  async processAudio(file: Buffer, originalName: string, config: UploadConfig): Promise<ProcessedFile> {
    await this.ensureDirectory(config.destination);
    
    const filename = this.generateFilename(originalName);
    const filePath = path.join(config.destination, filename);
    const fullPath = path.join(this.baseDir, filePath);

    await fs.writeFile(fullPath, file);
    const stats = await fs.stat(fullPath);

    return {
      originalName,
      filename,
      path: filePath,
      size: stats.size,
      mimetype: this.getMimetypeFromExtension(originalName),
    };
  }

  async processDocument(file: Buffer, originalName: string, config: UploadConfig): Promise<ProcessedFile> {
    await this.ensureDirectory(config.destination);
    
    const filename = this.generateFilename(originalName);
    const filePath = path.join(config.destination, filename);
    const fullPath = path.join(this.baseDir, filePath);

    await fs.writeFile(fullPath, file);
    const stats = await fs.stat(fullPath);

    return {
      originalName,
      filename,
      path: filePath,
      size: stats.size,
      mimetype: this.getMimetypeFromExtension(originalName),
    };
  }

  private getMimetypeFromExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimetypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/m4a',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
    };
    return mimetypes[ext] || 'application/octet-stream';
  }

  validateFile(file: { size: number; mimetype: string }, config: UploadConfig): { valid: boolean; error?: string } {
    if (file.size > config.maxFileSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${config.maxFileSize / (1024 * 1024)}MB`,
      };
    }

    if (!config.allowedTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: ${config.allowedTypes.join(', ')}`,
      };
    }

    return { valid: true };
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async deleteFiles(filePaths: string[]): Promise<boolean[]> {
    return Promise.all(filePaths.map(filePath => this.deleteFile(filePath)));
  }
}

// Main function to process files based on their type
export async function processFile(filePath: string, options: FileProcessOptions = {}): Promise<ProcessedFile> {
  const processor = new FileProcessor();
  const stats = await fs.stat(filePath);
  const filename = path.basename(filePath);
  const mimetype = processor['getMimetypeFromExtension'](filename);

  // Determine file type and appropriate config
  let config: UploadConfig;
  if (mimetype.startsWith('image/')) {
    config = uploadConfigs.image;
  } else if (mimetype.startsWith('video/')) {
    config = uploadConfigs.video;
  } else if (mimetype.startsWith('audio/')) {
    config = uploadConfigs.audio;
  } else {
    config = uploadConfigs.document;
  }

  // Override config with options
  config.generateThumbnails = options.generateThumbnail ?? config.generateThumbnails;

  // Read the file
  const fileBuffer = await fs.readFile(filePath);

  try {
    let processedFile: ProcessedFile;

    if (mimetype.startsWith('image/')) {
      processedFile = await processor.processImage(fileBuffer, filename, config);
    } else if (mimetype.startsWith('video/')) {
      processedFile = await processor.processVideo(fileBuffer, filename, config);
    } else if (mimetype.startsWith('audio/')) {
      processedFile = await processor.processAudio(fileBuffer, filename, config);
    } else {
      processedFile = await processor.processDocument(fileBuffer, filename, config);
    }

    // Add metadata if requested
    if (options.extractMetadata && mimetype.startsWith('image/')) {
      try {
        const image = sharp(fileBuffer);
        const metadata = await image.metadata();
        processedFile.metadata = {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          space: metadata.space,
          channels: metadata.channels,
          depth: metadata.depth,
          hasProfile: metadata.hasProfile,
          hasAlpha: metadata.hasAlpha
        };
      } catch (error) {
        console.warn('Failed to extract image metadata:', error);
      }
    }

    return processedFile;
  } catch (error) {
    console.error('File processing failed:', error);
    throw error;
  }
}
