import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MediaFile,
  ContentMetadata,
  UploadProgress,
  UploadSession,
  UploadStartRequest,
  UploadStartResponse,
  UploadChunkRequest,
  UploadCompleteRequest,
  UploadCompleteResponse,
  MediaProcessingOptions,
  UPLOAD_CONSTANTS,
} from '../types/upload';

// Mock crypto for hashing (in real app would use crypto-js or similar)
const mockHash = (data: string | ArrayBuffer): string => {
  return `hash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Upload service configuration
interface UploadServiceConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  chunkSize: number;
}

class UploadService {
  private config: UploadServiceConfig;
  private activeSessions: Map<string, UploadSession> = new Map();
  private uploadQueue: Map<string, UploadProgress> = new Map();

  constructor(config: Partial<UploadServiceConfig> = {}) {
    this.config = {
      baseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.nahveeeven.com',
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000,
      chunkSize: UPLOAD_CONSTANTS.CHUNK_SIZE,
      ...config,
    };
  }

  // Initialize upload session
  async startUpload(
    uploadId: string,
    mediaFile: MediaFile,
    metadata: ContentMetadata
  ): Promise<UploadSession | null> {
    try {
      // Create upload request
      const request: UploadStartRequest = {
        fileName: mediaFile.name,
        fileSize: mediaFile.size,
        mimeType: mediaFile.mimeType || mediaFile.type,
        metadata,
        chunkSize: this.config.chunkSize,
      };

      // Mock API call - in real app would be actual HTTP request
      const response = await this.mockApiCall<UploadStartResponse>('/uploads/start', {
        method: 'POST',
        body: request,
      });

      if (response) {
        // Create upload session
        const session: UploadSession = {
          sessionId: response.sessionId,
          uploadId,
          chunkSize: response.chunkSize,
          totalChunks: Math.ceil(mediaFile.size / response.chunkSize),
          uploadedChunks: [],
          serverUrl: response.uploadUrl,
          expiresAt: response.expiresAt,
        };

        // Store session
        this.activeSessions.set(uploadId, session);
        await AsyncStorage.setItem(`upload_session_${uploadId}`, JSON.stringify(session));

        return session;
      }
      return null;
    } catch (error) {
      console.error('Failed to start upload:', error);
      return null;
    }
  }

  // Upload file in chunks
  async uploadFile(
    uploadId: string,
    mediaFile: MediaFile,
    onProgress?: (progress: number, uploadedBytes: number, speed?: number) => void
  ): Promise<boolean> {
    try {
      const session = this.activeSessions.get(uploadId);
      if (!session) {
        throw new Error('Upload session not found');
      }

      // In a real app, you would read the file in chunks and upload each chunk
      // For now, we'll simulate chunked upload with progress updates
      let uploadedBytes = 0;
      const startTime = Date.now();

      for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex++) {
        // Skip if chunk already uploaded
        if (session.uploadedChunks.includes(chunkIndex)) {
          continue;
        }

        // Calculate chunk size (last chunk might be smaller)
        const chunkStart = chunkIndex * session.chunkSize;
        const chunkEnd = Math.min(chunkStart + session.chunkSize, mediaFile.size);
        const chunkSize = chunkEnd - chunkStart;

        // Simulate chunk upload
        const chunkUploaded = await this.uploadChunk(
          uploadId,
          chunkIndex,
          chunkSize,
          session
        );

        if (!chunkUploaded) {
          throw new Error(`Failed to upload chunk ${chunkIndex}`);
        }

        // Update progress
        uploadedBytes += chunkSize;
        const progress = (uploadedBytes / mediaFile.size) * 100;
        const elapsedTime = (Date.now() - startTime) / 1000;
        const speed = elapsedTime > 0 ? uploadedBytes / elapsedTime : 0;

        session.uploadedChunks.push(chunkIndex);
        onProgress?.(progress, uploadedBytes, speed);

        // Save session state
        await AsyncStorage.setItem(`upload_session_${uploadId}`, JSON.stringify(session));
      }

      return true;
    } catch (error) {
      console.error('Upload failed:', error);
      return false;
    }
  }

  // Upload individual chunk
  private async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkSize: number,
    session: UploadSession
  ): Promise<boolean> {
    try {
      // Mock chunk data - in real app would be actual file chunk
      const mockChunkData = new ArrayBuffer(chunkSize);
      const chunkHash = mockHash(mockChunkData);

      const request: UploadChunkRequest = {
        uploadId,
        chunkIndex,
        chunkData: mockChunkData,
        chunkHash,
      };

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      // Mock successful chunk upload
      return true;
    } catch (error) {
      console.error(`Failed to upload chunk ${chunkIndex}:`, error);
      return false;
    }
  }

  // Complete upload
  async completeUpload(
    uploadId: string,
    mediaFile: MediaFile,
    metadata: ContentMetadata
  ): Promise<UploadCompleteResponse | null> {
    try {
      const session = this.activeSessions.get(uploadId);
      if (!session) {
        throw new Error('Upload session not found');
      }

      // Verify all chunks uploaded
      if (session.uploadedChunks.length !== session.totalChunks) {
        throw new Error('Not all chunks uploaded');
      }

      // Create completion request
      const request: UploadCompleteRequest = {
        uploadId,
        totalChunks: session.totalChunks,
        finalHash: mockHash(mediaFile.uri),
        metadata,
      };

      // Mock API call
      const response = await this.mockApiCall<UploadCompleteResponse>('/uploads/complete', {
        method: 'POST',
        body: request,
      });

      if (response) {
        // Clean up session
        this.activeSessions.delete(uploadId);
        await AsyncStorage.removeItem(`upload_session_${uploadId}`);
        return response;
      }
      return null;
    } catch (error) {
      console.error('Failed to complete upload:', error);
      return null;
    }
  }

  // Cancel upload
  async cancelUpload(uploadId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(uploadId);
      if (session) {
        // Mock API call to cancel
        await this.mockApiCall('/uploads/cancel', {
          method: 'POST',
          body: { uploadId, sessionId: session.sessionId },
        });
      }

      // Clean up
      this.activeSessions.delete(uploadId);
      await AsyncStorage.removeItem(`upload_session_${uploadId}`);
      this.uploadQueue.delete(uploadId);

      return true;
    } catch (error) {
      console.error('Failed to cancel upload:', error);
      return false;
    }
  }

  // Resume upload from saved session
  async resumeUpload(uploadId: string): Promise<UploadSession | null> {
    try {
      const sessionData = await AsyncStorage.getItem(`upload_session_${uploadId}`);
      if (!sessionData) {
        return null;
      }

      const session: UploadSession = JSON.parse(sessionData);
      
      // Check if session is still valid
      if (new Date(session.expiresAt) < new Date()) {
        await AsyncStorage.removeItem(`upload_session_${uploadId}`);
        return null;
      }

      // Restore session
      this.activeSessions.set(uploadId, session);
      return session;
    } catch (error) {
      console.error('Failed to resume upload:', error);
      return null;
    }
  }

  // Generate thumbnail for media files
  async generateThumbnail(
    mediaFile: MediaFile,
    options?: { size?: { width: number; height: number }; timestamp?: number }
  ): Promise<string | null> {
    try {
      const { size = UPLOAD_CONSTANTS.THUMBNAIL_SIZE, timestamp = 1 } = options || {};

      // Mock thumbnail generation - in real app would use image processing library
      if (mediaFile.type.startsWith('image/')) {
        // For images, return resized version
        return `${mediaFile.uri}_thumb_${size.width}x${size.height}`;
      } else if (mediaFile.type.startsWith('video/')) {
        // For videos, extract frame at timestamp
        return `${mediaFile.uri}_thumb_${size.width}x${size.height}_${timestamp}s`;
      }

      // No thumbnail for other types
      return null;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return null;
    }
  }

  // Process media file (compression, format conversion, etc.)
  async processMedia(
    mediaFile: MediaFile,
    options: MediaProcessingOptions
  ): Promise<MediaFile | null> {
    try {
      let processedFile = { ...mediaFile };

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Apply compression
      if (options.compress && options.compressionQuality) {
        const compressionRatio = options.compressionQuality;
        processedFile.size = Math.round(mediaFile.size * compressionRatio);
        processedFile.uri = `${mediaFile.uri}_compressed_${compressionRatio}`;
      }

      // Resize images
      if (mediaFile.type.startsWith('image/') && options.resizeImages) {
        const { maxWidth, maxHeight } = options.resizeImages;
        if (mediaFile.width && mediaFile.height) {
          const aspectRatio = mediaFile.width / mediaFile.height;
          let newWidth = mediaFile.width;
          let newHeight = mediaFile.height;

          if (newWidth > maxWidth) {
            newWidth = maxWidth;
            newHeight = newWidth / aspectRatio;
          }
          if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
          }

          processedFile.width = Math.round(newWidth);
          processedFile.height = Math.round(newHeight);
        }
      }

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailUri = await this.generateThumbnail(processedFile);
        if (thumbnailUri) {
          processedFile.thumbnail = thumbnailUri;
        }
      }

      return processedFile;
    } catch (error) {
      console.error('Failed to process media:', error);
      return null;
    }
  }

  // Get upload statistics
  async getUploadStatistics(): Promise<{
    totalUploads: number;
    totalBytes: number;
    averageSpeed: number;
    successRate: number;
  }> {
    try {
      // Mock API call to get statistics
      const stats = await this.mockApiCall<any>('/uploads/statistics');
      return stats || {
        totalUploads: 0,
        totalBytes: 0,
        averageSpeed: 0,
        successRate: 0,
      };
    } catch (error) {
      console.error('Failed to get upload statistics:', error);
      return {
        totalUploads: 0,
        totalBytes: 0,
        averageSpeed: 0,
        successRate: 0,
      };
    }
  }

  // Validate file before upload
  validateFile(mediaFile: MediaFile): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size
    if (mediaFile.size > UPLOAD_CONSTANTS.MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum allowed size of ${Math.round(UPLOAD_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024))}MB`);
    }

    // Check file type
    const allowedTypes = [
      ...UPLOAD_CONSTANTS.SUPPORTED_IMAGE_TYPES,
      ...UPLOAD_CONSTANTS.SUPPORTED_VIDEO_TYPES,
      ...UPLOAD_CONSTANTS.SUPPORTED_AUDIO_TYPES,
      ...UPLOAD_CONSTANTS.SUPPORTED_DOCUMENT_TYPES,
    ];

    if (!allowedTypes.includes(mediaFile.mimeType || mediaFile.type)) {
      errors.push('File type not supported');
    }

    // Check file name
    if (!mediaFile.name || mediaFile.name.trim().length === 0) {
      errors.push('File name is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Mock API call helper
  private async mockApiCall<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T | null> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Simulate occasional failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Network error');
    }

    // Return mock responses based on endpoint
    if (endpoint === '/uploads/start') {
      return {
        uploadId: `upload_${Date.now()}`,
        sessionId: `session_${Date.now()}`,
        uploadUrl: `${this.config.baseUrl}/uploads/chunks`,
        chunkSize: this.config.chunkSize,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      } as T;
    }

    if (endpoint === '/uploads/complete') {
      return {
        success: true,
        contentId: `content_${Date.now()}`,
        processingStatus: 'completed',
        downloadUrl: `${this.config.baseUrl}/content/content_${Date.now()}`,
        thumbnailUrl: `${this.config.baseUrl}/thumbnails/thumb_${Date.now()}.jpg`,
      } as T;
    }

    if (endpoint === '/uploads/statistics') {
      return {
        totalUploads: Math.floor(Math.random() * 1000),
        totalBytes: Math.floor(Math.random() * 1000000000), // Up to 1GB
        averageSpeed: Math.floor(Math.random() * 5000000), // Up to 5MB/s
        successRate: 0.95 + Math.random() * 0.05, // 95-100%
      } as T;
    }

    return {} as T;
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith('upload_session_'));
      
      for (const key of sessionKeys) {
        const sessionData = await AsyncStorage.getItem(key);
        if (sessionData) {
          const session: UploadSession = JSON.parse(sessionData);
          if (new Date(session.expiresAt) < new Date()) {
            await AsyncStorage.removeItem(key);
            this.activeSessions.delete(session.uploadId);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }

  // Get active session count
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  // Get session details
  getSession(uploadId: string): UploadSession | undefined {
    return this.activeSessions.get(uploadId);
  }

  // Update service configuration
  updateConfig(newConfig: Partial<UploadServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
const uploadService = new UploadService();
export default uploadService;