/**
 * Video Transcoding Pipeline
 *
 * This module provides a comprehensive video transcoding pipeline with:
 * - Queue management for processing jobs
 * - Multi-quality transcoding (1080p, 720p, 480p, 360p)
 * - Adaptive bitrate streaming (HLS/DASH)
 * - Progress tracking and job status updates
 * - Error handling and retry logic
 * - Resource management and optimization
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { prisma } from '../prisma';
import {
  mediaProcessor,
  ProcessingJob,
  ProcessingOutput,
  ProcessingOptions,
  MediaMetadata,
  PROCESSING_CONFIG,
} from './core';
import { ContentType } from '../types/enums';

// Job Queue Configuration
const QUEUE_CONFIG = {
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_TRANSCODING_JOBS || '3'),
  retryAttempts: 3,
  retryDelayMs: 30000, // 30 seconds
  jobTimeoutMs: 30 * 60 * 1000, // 30 minutes
  cleanupIntervalMs: 60 * 60 * 1000, // 1 hour
  maxQueueSize: 100,
} as const;

// Job Status Updates
export interface JobProgress {
  jobId: string;
  contentId: string;
  status: ProcessingJob['status'];
  progress: number;
  currentStep: string;
  eta?: number;
  error?: string;
}

// Queue Events
export interface TranscodingEvents {
  'job:queued': (job: ProcessingJob) => void;
  'job:started': (job: ProcessingJob) => void;
  'job:progress': (progress: JobProgress) => void;
  'job:completed': (job: ProcessingJob) => void;
  'job:failed': (job: ProcessingJob, error: Error) => void;
  'queue:empty': () => void;
  'queue:full': () => void;
}

export class TranscodingPipeline extends EventEmitter {
  private processingQueue: Map<string, ProcessingJob> = new Map();
  private activeJobs: Map<string, ProcessingJob> = new Map();
  private jobTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  /**
   * Initialize the transcoding pipeline
   */
  async initialize(): Promise<void> {
    try {
      await mediaProcessor.initialize();

      // Resume any incomplete jobs from database
      await this.resumeIncompleteJobs();

      logger.info('Transcoding pipeline initialized', {
        maxConcurrentJobs: QUEUE_CONFIG.maxConcurrentJobs,
        maxQueueSize: QUEUE_CONFIG.maxQueueSize,
      });
    } catch (error) {
      logger.error('Failed to initialize transcoding pipeline', {}, error as Error);
      throw error;
    }
  }

  /**
   * Add a video processing job to the queue
   */
  async queueVideoJob(
    contentId: string,
    userId: string,
    inputFileUrl: string,
    options: ProcessingOptions = {}
  ): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Pipeline is shutting down, cannot accept new jobs');
    }

    if (this.processingQueue.size >= QUEUE_CONFIG.maxQueueSize) {
      this.emit('queue:full');
      throw new Error('Processing queue is full, please try again later');
    }

    const jobId = uuidv4();
    const now = new Date();

    // Download and analyze input file
    const tempInputPath = await this.downloadInputFile(inputFileUrl);
    const metadata = await mediaProcessor.extractMetadata(tempInputPath);

    const job: ProcessingJob = {
      id: jobId,
      contentId,
      userId,
      type: ContentType.VIDEO,
      status: 'queued',
      progress: 0,
      originalFile: {
        key: this.extractS3KeyFromUrl(inputFileUrl),
        url: inputFileUrl,
        metadata,
      },
      outputs: [],
      createdAt: now,
      updatedAt: now,
    };

    // Store job in database
    await this.saveJobToDatabase(job);

    // Add to queue
    this.processingQueue.set(jobId, job);

    logger.info('Video job queued', {
      jobId,
      contentId,
      userId,
      duration: metadata.duration,
      resolution: `${metadata.width}x${metadata.height}`,
    });

    this.emit('job:queued', job);

    // Start processing if slots available
    this.processNextJob();

    return jobId;
  }

  /**
   * Add an audio processing job to the queue
   */
  async queueAudioJob(
    contentId: string,
    userId: string,
    inputFileUrl: string,
    options: ProcessingOptions = {}
  ): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Pipeline is shutting down, cannot accept new jobs');
    }

    if (this.processingQueue.size >= QUEUE_CONFIG.maxQueueSize) {
      this.emit('queue:full');
      throw new Error('Processing queue is full, please try again later');
    }

    const jobId = uuidv4();
    const now = new Date();

    const tempInputPath = await this.downloadInputFile(inputFileUrl);
    const metadata = await mediaProcessor.extractMetadata(tempInputPath);

    const job: ProcessingJob = {
      id: jobId,
      contentId,
      userId,
      type: ContentType.AUDIO,
      status: 'queued',
      progress: 0,
      originalFile: {
        key: this.extractS3KeyFromUrl(inputFileUrl),
        url: inputFileUrl,
        metadata,
      },
      outputs: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.saveJobToDatabase(job);
    this.processingQueue.set(jobId, job);

    logger.info('Audio job queued', {
      jobId,
      contentId,
      userId,
      duration: metadata.duration,
    });

    this.emit('job:queued', job);
    this.processNextJob();

    return jobId;
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<ProcessingJob | null> {
    // Check active jobs first
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return activeJob;
    }

    // Check queued jobs
    const queuedJob = this.processingQueue.get(jobId);
    if (queuedJob) {
      return queuedJob;
    }

    // Check database for completed/failed jobs
    return await this.getJobFromDatabase(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.processingQueue.get(jobId) || this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    // Remove from queue if not started
    if (job.status === 'queued') {
      this.processingQueue.delete(jobId);
      job.status = 'failed';
      job.error = 'Job cancelled by user';
      await this.saveJobToDatabase(job);
      return true;
    }

    // Mark active job for cancellation
    if (job.status === 'processing') {
      job.status = 'failed';
      job.error = 'Job cancelled by user';
      await this.saveJobToDatabase(job);

      // Clean up timeout
      const timeout = this.jobTimeouts.get(jobId);
      if (timeout) {
        clearTimeout(timeout);
        this.jobTimeouts.delete(jobId);
      }

      return true;
    }

    return false;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queued: number;
    processing: number;
    maxConcurrent: number;
    totalCapacity: number;
  } {
    return {
      queued: this.processingQueue.size,
      processing: this.activeJobs.size,
      maxConcurrent: QUEUE_CONFIG.maxConcurrentJobs,
      totalCapacity: QUEUE_CONFIG.maxQueueSize,
    };
  }

  /**
   * Process next job in queue
   */
  private async processNextJob(): Promise<void> {
    if (this.activeJobs.size >= QUEUE_CONFIG.maxConcurrentJobs) {
      return; // All slots occupied
    }

    if (this.processingQueue.size === 0) {
      this.emit('queue:empty');
      return; // No jobs to process
    }

    // Get oldest job from queue
    const [jobId, job] = Array.from(this.processingQueue.entries())[0];
    this.processingQueue.delete(jobId);
    this.activeJobs.set(jobId, job);

    // Set job timeout
    const timeout = setTimeout(() => {
      this.handleJobTimeout(jobId);
    }, QUEUE_CONFIG.jobTimeoutMs);
    this.jobTimeouts.set(jobId, timeout);

    // Update job status
    job.status = 'processing';
    job.updatedAt = new Date();
    await this.saveJobToDatabase(job);

    logger.info('Starting job processing', { jobId, type: job.type });
    this.emit('job:started', job);

    try {
      if (job.type === ContentType.VIDEO) {
        await this.processVideoJob(job);
      } else if (job.type === ContentType.AUDIO) {
        await this.processAudioJob(job);
      }

      // Job completed successfully
      job.status = 'completed';
      job.progress = 100;
      job.updatedAt = new Date();
      await this.saveJobToDatabase(job);

      logger.info('Job completed successfully', { jobId });
      this.emit('job:completed', job);
    } catch (error) {
      await this.handleJobError(job, error as Error);
    } finally {
      // Cleanup
      this.activeJobs.delete(jobId);
      const timeout = this.jobTimeouts.get(jobId);
      if (timeout) {
        clearTimeout(timeout);
        this.jobTimeouts.delete(jobId);
      }

      // Process next job
      setImmediate(() => this.processNextJob());
    }
  }

  /**
   * Process video transcoding job
   */
  private async processVideoJob(job: ProcessingJob): Promise<void> {
    const tempInputPath = await this.downloadInputFile(job.originalFile.url);
    const outputPrefix = `processed/${job.userId}/${job.contentId}/${job.id}`;

    try {
      // Update progress: Downloaded input file
      await this.updateJobProgress(job, 10, 'Processing video metadata');

      // Determine processing options based on input
      const options: ProcessingOptions = {
        generateThumbnails: true,
        generatePreview: true,
        generateHLS: true,
        audioNormalization: true,
        transcodeQualities: this.getOptimalQualitiesForResolution(job.originalFile.metadata),
      };

      // Generate thumbnails first (quick wins for user feedback)
      await this.updateJobProgress(job, 20, 'Generating thumbnails');
      const thumbnails = await mediaProcessor.generateThumbnails(tempInputPath, outputPrefix);
      job.outputs.push(...thumbnails);

      // Generate preview clip
      await this.updateJobProgress(job, 30, 'Creating preview clip');
      const preview = await mediaProcessor.generatePreview(tempInputPath, outputPrefix);
      job.outputs.push(preview);

      // Process video qualities
      const totalQualities = options.transcodeQualities?.length || 1;
      let processedQualities = 0;

      await this.updateJobProgress(job, 40, 'Starting video transcoding');

      for (const quality of options.transcodeQualities || ['360p']) {
        const qualityOptions = { ...options, transcodeQualities: [quality] };
        const qualityOutputs = await mediaProcessor.processVideo(
          tempInputPath,
          `${outputPrefix}-${quality}`,
          qualityOptions
        );

        job.outputs.push(...qualityOutputs);
        processedQualities++;

        const progressPercent = 40 + (processedQualities / totalQualities) * 40;
        await this.updateJobProgress(job, progressPercent, `Transcoded ${quality} quality`);
      }

      // Generate HLS playlist
      if (options.generateHLS) {
        await this.updateJobProgress(job, 90, 'Generating streaming playlist');
        // HLS output is already included in processVideo call
      }

      await this.updateJobProgress(job, 100, 'Video processing completed');
    } finally {
      // Cleanup temp file
      await fs.unlink(tempInputPath).catch(() => {});
    }
  }

  /**
   * Process audio job
   */
  private async processAudioJob(job: ProcessingJob): Promise<void> {
    const tempInputPath = await this.downloadInputFile(job.originalFile.url);
    const outputPrefix = `processed/${job.userId}/${job.contentId}/${job.id}`;

    try {
      await this.updateJobProgress(job, 10, 'Processing audio metadata');

      const options: ProcessingOptions = {
        generatePreview: true, // This generates waveform for audio
        audioNormalization: true,
      };

      // Process different audio qualities
      await this.updateJobProgress(job, 30, 'Transcoding audio qualities');
      const audioOutputs = await mediaProcessor.processAudio(tempInputPath, outputPrefix, options);
      job.outputs.push(...audioOutputs);

      await this.updateJobProgress(job, 100, 'Audio processing completed');
    } finally {
      await fs.unlink(tempInputPath).catch(() => {});
    }
  }

  /**
   * Update job progress and emit event
   */
  private async updateJobProgress(
    job: ProcessingJob,
    progress: number,
    currentStep: string
  ): Promise<void> {
    job.progress = Math.min(100, Math.max(0, progress));
    job.updatedAt = new Date();

    const progressUpdate: JobProgress = {
      jobId: job.id,
      contentId: job.contentId,
      status: job.status,
      progress: job.progress,
      currentStep,
    };

    this.emit('job:progress', progressUpdate);

    // Save to database every 10% progress or at key steps
    if (progress % 10 === 0 || progress === 100) {
      await this.saveJobToDatabase(job);
    }
  }

  /**
   * Handle job error with retry logic
   */
  private async handleJobError(job: ProcessingJob, error: Error): Promise<void> {
    const retryCount = (job as any).retryCount || 0;

    if (retryCount < QUEUE_CONFIG.retryAttempts) {
      // Retry the job
      (job as any).retryCount = retryCount + 1;
      job.status = 'queued';
      job.progress = 0;
      job.error = `Retry ${retryCount + 1}/${QUEUE_CONFIG.retryAttempts}: ${error.message}`;

      logger.warn('Job failed, retrying', {
        jobId: job.id,
        attempt: retryCount + 1,
        error: error.message,
      });

      // Add back to queue after delay
      setTimeout(() => {
        this.processingQueue.set(job.id, job);
        this.processNextJob();
      }, QUEUE_CONFIG.retryDelayMs);
    } else {
      // Job failed permanently
      job.status = 'failed';
      job.error = error.message;
      job.updatedAt = new Date();

      logger.error('Job failed permanently', {
        jobId: job.id,
        attempts: retryCount + 1,
        error: error.message,
      });

      this.emit('job:failed', job, error);
    }

    await this.saveJobToDatabase(job);
  }

  /**
   * Handle job timeout
   */
  private async handleJobTimeout(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const error = new Error(`Job timed out after ${QUEUE_CONFIG.jobTimeoutMs / 1000} seconds`);
    await this.handleJobError(job, error);
  }

  /**
   * Download input file to temp directory
   */
  private async downloadInputFile(url: string): Promise<string> {
    // If it's an S3 URL, we can download it directly
    // This is a simplified implementation - in production you'd want proper S3 streaming
    const tempFileName = `input-${uuidv4()}${path.extname(url)}`;
    const tempPath = path.join('/tmp', tempFileName);

    // For now, we'll assume the file is already accessible locally or via S3
    // In a real implementation, you'd download the file here
    logger.debug('Input file prepared', { url, tempPath });

    return tempPath;
  }

  /**
   * Extract S3 key from URL
   */
  private extractS3KeyFromUrl(url: string): string {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  }

  /**
   * Get optimal video qualities based on input resolution
   */
  private getOptimalQualitiesForResolution(metadata: MediaMetadata): string[] {
    const inputHeight = metadata.height;
    const availableQualities = ['1080p', '720p', '480p', '360p'];

    const heightMap: { [key: string]: number } = {
      '1080p': 1080,
      '720p': 720,
      '480p': 480,
      '360p': 360,
    };

    return availableQualities.filter(quality => heightMap[quality] <= inputHeight);
  }

  /**
   * Save job to database
   */
  private async saveJobToDatabase(job: ProcessingJob): Promise<void> {
    try {
      await prisma.processingJobs.upsert({
        where: { id: job.id },
        update: {
          status: job.status,
          progress: job.progress,
          outputs: JSON.stringify(job.outputs),
          error: job.error,
          updatedAt: job.updatedAt,
        },
        create: {
          id: job.id,
          contentId: job.contentId,
          userId: job.userId,
          type: job.type,
          status: job.status,
          progress: job.progress,
          originalFile: JSON.stringify(job.originalFile),
          outputs: JSON.stringify(job.outputs),
          error: job.error,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to save job to database', { jobId: job.id }, error as Error);
    }
  }

  /**
   * Get job from database
   */
  private async getJobFromDatabase(jobId: string): Promise<ProcessingJob | null> {
    try {
      const dbJob = await prisma.processingJobs.findUnique({
        where: { id: jobId },
      });

      if (!dbJob) return null;

      return {
        id: dbJob.id,
        contentId: dbJob.contentId,
        userId: dbJob.userId,
        type: dbJob.type as ContentType,
        status: dbJob.status as ProcessingJob['status'],
        progress: dbJob.progress,
        originalFile: JSON.parse(dbJob.originalFile),
        outputs: JSON.parse(dbJob.outputs || '[]'),
        error: dbJob.error || undefined,
        createdAt: dbJob.createdAt,
        updatedAt: dbJob.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get job from database', { jobId }, error as Error);
      return null;
    }
  }

  /**
   * Resume incomplete jobs from database
   */
  private async resumeIncompleteJobs(): Promise<void> {
    try {
      const incompleteJobs = await prisma.processingJobs.findMany({
        where: {
          status: {
            in: ['queued', 'processing'],
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      logger.info('Resuming incomplete jobs', { count: incompleteJobs.length });

      for (const dbJob of incompleteJobs) {
        const job: ProcessingJob = {
          id: dbJob.id,
          contentId: dbJob.contentId,
          userId: dbJob.userId,
          type: dbJob.type as ContentType,
          status: 'queued', // Reset to queued
          progress: 0, // Reset progress
          originalFile: JSON.parse(dbJob.originalFile),
          outputs: JSON.parse(dbJob.outputs || '[]'),
          createdAt: dbJob.createdAt,
          updatedAt: new Date(),
        };

        this.processingQueue.set(job.id, job);
      }

      // Start processing
      this.processNextJob();
    } catch (error) {
      logger.error('Failed to resume incomplete jobs', {}, error as Error);
    }
  }

  /**
   * Setup cleanup interval for old jobs
   */
  private setupCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        // Clean up old completed/failed jobs (older than 7 days)
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        await prisma.processingJobs.deleteMany({
          where: {
            status: {
              in: ['completed', 'failed'],
            },
            updatedAt: {
              lt: cutoffDate,
            },
          },
        });

        // Clean up temp files
        await mediaProcessor.cleanup();
      } catch (error) {
        logger.error('Cleanup job failed', {}, error as Error);
      }
    }, QUEUE_CONFIG.cleanupIntervalMs);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    logger.info('Shutting down transcoding pipeline');

    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clear job timeouts
    for (const timeout of this.jobTimeouts.values()) {
      clearTimeout(timeout);
    }

    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = 60000; // 1 minute
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Mark remaining active jobs as failed
    for (const job of this.activeJobs.values()) {
      job.status = 'failed';
      job.error = 'Server shutdown';
      await this.saveJobToDatabase(job);
    }

    logger.info('Transcoding pipeline shutdown complete');
  }
}

// Export singleton instance
export const transcodingPipeline = new TranscodingPipeline();
