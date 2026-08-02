/**
 * Video on Demand (VOD) Service
 * 
 * Manages stream recordings, VOD processing pipeline,
 * and playback endpoints for recorded content.
 * Requirements: 7.5
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Types
export interface VODRecording {
  id: string;
  streamId: string;
  artistId: string;
  title: string;
  description?: string;
  duration: number;
  fileSize: number;
  s3Key: string;
  thumbnailKey?: string;
  status: 'processing' | 'ready' | 'failed' | 'archived';
  quality: string;
  recordedAt: Date;
  processedAt?: Date;
  viewCount: number;
  isPublic: boolean;
  metadata?: Record<string, any>;
}

export interface VODPlaybackOptions {
  quality?: string;
  startTime?: number;
  userId?: string;
  accessToken?: string;
}

export interface ProcessingJob {
  id: string;
  recordingId: string;
  type: 'transcode' | 'thumbnail' | 'metadata';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// Constants
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || 'directfanz-recordings';
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

class VODService {
  private s3Client: S3Client;
  private recordings = new Map<string, VODRecording>();
  private processingJobs = new Map<string, ProcessingJob>();

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  // Recording management
  async createRecording(data: {
    streamId: string;
    artistId: string;
    title: string;
    description?: string;
    s3Key: string;
    duration: number;
    fileSize: number;
  }): Promise<VODRecording> {
    const recording: VODRecording = {
      id: this.generateId(),
      ...data,
      status: 'processing',
      quality: 'original',
      recordedAt: new Date(),
      viewCount: 0,
      isPublic: false,
    };

    this.recordings.set(recording.id, recording);

    // Start processing pipeline
    await this.startProcessingPipeline(recording.id);

    return recording;
  }

  async getRecording(id: string): Promise<VODRecording | null> {
    return this.recordings.get(id) || null;
  }

  async getRecordingsByArtist(artistId: string): Promise<VODRecording[]> {
    return Array.from(this.recordings.values())
      .filter(r => r.artistId === artistId)
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
  }

  async getPublicRecordings(limit: number = 20, offset: number = 0): Promise<VODRecording[]> {
    return Array.from(this.recordings.values())
      .filter(r => r.isPublic && r.status === 'ready')
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
      .slice(offset, offset + limit);
  }

  async updateRecording(id: string, updates: Partial<VODRecording>): Promise<VODRecording | null> {
    const recording = this.recordings.get(id);
    if (!recording) return null;

    const updated = { ...recording, ...updates };
    this.recordings.set(id, updated);
    return updated;
  }

  async deleteRecording(id: string): Promise<boolean> {
    const recording = this.recordings.get(id);
    if (!recording) return false;

    try {
      // Delete from S3
      await this.deleteFromS3(recording.s3Key);
      if (recording.thumbnailKey) {
        await this.deleteFromS3(recording.thumbnailKey);
      }

      // Remove from memory
      this.recordings.delete(id);
      return true;
    } catch (error) {
      console.error('Failed to delete recording:', error);
      return false;
    }
  }

  // Playback URL generation
  async generatePlaybackUrl(recordingId: string, options: VODPlaybackOptions = {}): Promise<string | null> {
    const recording = this.recordings.get(recordingId);
    if (!recording || recording.status !== 'ready') {
      return null;
    }

    try {
      // Generate presigned URL for S3 object
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: recording.s3Key,
        ResponseContentDisposition: `inline; filename="${recording.title}.mp4"`,
        ...(options.startTime && {
          Range: `bytes=${this.calculateByteRange(options.startTime, recording.duration)}`,
        }),
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRY,
      });

      // Increment view count
      recording.viewCount++;

      return url;
    } catch (error) {
      console.error('Failed to generate playback URL:', error);
      return null;
    }
  }

  private calculateByteRange(startTime: number, duration: number): string {
    // Simplified byte range calculation
    const percentage = startTime / duration;
    const startByte = Math.floor(percentage * 1000000); // Approximate
    return `${startByte}-`;
  }

  // Thumbnail generation
  async generateThumbnail(recordingId: string): Promise<string | null> {
    const recording = this.recordings.get(recordingId);
    if (!recording) return null;

    const thumbnailKey = `thumbnails/${recordingId}.jpg`;
    
    try {
      // Create processing job for thumbnail generation
      const job = await this.createProcessingJob(recordingId, 'thumbnail');
      
      // Simulate thumbnail generation (in real implementation, this would use AWS MediaConvert or similar)
      await this.simulateProcessing(job.id, 2000);
      
      // Update recording with thumbnail key
      recording.thumbnailKey = thumbnailKey;
      
      return thumbnailKey;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return null;
    }
  }

  async getThumbnailUrl(recordingId: string): Promise<string | null> {
    const recording = this.recordings.get(recordingId);
    if (!recording?.thumbnailKey) return null;

    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: recording.thumbnailKey,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRY,
      });
    } catch (error) {
      console.error('Failed to get thumbnail URL:', error);
      return null;
    }
  }

  // Processing pipeline
  private async startProcessingPipeline(recordingId: string): Promise<void> {
    const recording = this.recordings.get(recordingId);
    if (!recording) return;

    try {
      // Create processing jobs
      const metadataJob = await this.createProcessingJob(recordingId, 'metadata');
      const thumbnailJob = await this.createProcessingJob(recordingId, 'thumbnail');

      // Process metadata
      await this.processMetadata(metadataJob.id);
      
      // Generate thumbnail
      await this.processThumbnail(thumbnailJob.id);

      // Mark recording as ready
      recording.status = 'ready';
      recording.processedAt = new Date();
    } catch (error) {
      console.error('Processing pipeline failed:', error);
      recording.status = 'failed';
    }
  }

  private async createProcessingJob(recordingId: string, type: ProcessingJob['type']): Promise<ProcessingJob> {
    const job: ProcessingJob = {
      id: this.generateId(),
      recordingId,
      type,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };

    this.processingJobs.set(job.id, job);
    return job;
  }

  private async processMetadata(jobId: string): Promise<void> {
    const job = this.processingJobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    
    try {
      // Simulate metadata extraction
      await this.simulateProcessing(jobId, 1000);
      
      const recording = this.recordings.get(job.recordingId);
      if (recording) {
        recording.metadata = {
          codec: 'h264',
          resolution: '1920x1080',
          framerate: 30,
          bitrate: 5000000,
          extractedAt: new Date().toISOString(),
        };
      }

      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private async processThumbnail(jobId: string): Promise<void> {
    const job = this.processingJobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    
    try {
      // Simulate thumbnail generation
      await this.simulateProcessing(jobId, 2000);
      
      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private async simulateProcessing(jobId: string, duration: number): Promise<void> {
    const job = this.processingJobs.get(jobId);
    if (!job) return;

    const steps = 10;
    const stepDuration = duration / steps;

    for (let i = 0; i <= steps; i++) {
      job.progress = (i / steps) * 100;
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
  }

  // S3 operations
  private async deleteFromS3(key: string): Promise<void> {
    // In a real implementation, this would delete the S3 object
    console.log(`Would delete S3 object: ${key}`);
  }

  // Search and filtering
  async searchRecordings(query: string, filters?: {
    artistId?: string;
    isPublic?: boolean;
    status?: VODRecording['status'];
  }): Promise<VODRecording[]> {
    let results = Array.from(this.recordings.values());

    // Apply filters
    if (filters?.artistId) {
      results = results.filter(r => r.artistId === filters.artistId);
    }
    if (filters?.isPublic !== undefined) {
      results = results.filter(r => r.isPublic === filters.isPublic);
    }
    if (filters?.status) {
      results = results.filter(r => r.status === filters.status);
    }

    // Apply text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(r => 
        r.title.toLowerCase().includes(lowerQuery) ||
        r.description?.toLowerCase().includes(lowerQuery)
      );
    }

    return results.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
  }

  // Analytics
  getRecordingStats(recordingId: string): {
    viewCount: number;
    duration: number;
    fileSize: number;
    status: string;
  } | null {
    const recording = this.recordings.get(recordingId);
    if (!recording) return null;

    return {
      viewCount: recording.viewCount,
      duration: recording.duration,
      fileSize: recording.fileSize,
      status: recording.status,
    };
  }

  getArtistStats(artistId: string): {
    totalRecordings: number;
    totalViews: number;
    totalDuration: number;
    publicRecordings: number;
  } {
    const recordings = this.getRecordingsByArtist(artistId);
    
    return {
      totalRecordings: recordings.length,
      totalViews: recordings.reduce((sum, r) => sum + r.viewCount, 0),
      totalDuration: recordings.reduce((sum, r) => sum + r.duration, 0),
      publicRecordings: recordings.filter(r => r.isPublic).length,
    };
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Remove completed processing jobs older than 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [jobId, job] of this.processingJobs) {
      if (job.status === 'completed' && job.completedAt && job.completedAt.getTime() < oneDayAgo) {
        this.processingJobs.delete(jobId);
      }
    }
  }

  // Public API for getting processing status
  getProcessingStatus(recordingId: string): ProcessingJob[] {
    return Array.from(this.processingJobs.values())
      .filter(job => job.recordingId === recordingId);
  }
}

// Export singleton instance
export const vodService = new VODService();
export default vodService;