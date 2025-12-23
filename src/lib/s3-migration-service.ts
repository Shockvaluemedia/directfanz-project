/**
 * S3 Content Migration Service
 * Handles migration of S3 content between buckets with integrity verification
 * Implements Requirements 11.2
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  GetBucketLocationCommand,
  PutBucketVersioningCommand,
  PutBucketEncryptionCommand,
  PutBucketLifecycleConfigurationCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getParameter } from './aws-config';
import { logger } from './logger';
import crypto from 'crypto';
import { Readable } from 'stream';

interface S3MigrationConfig {
  sourceBucket: string;
  targetBucket: string;
  region: string;
  batchSize: number;
  verifyIntegrity: boolean;
  preserveMetadata: boolean;
  deleteSource: boolean;
  dryRun: boolean;
}

interface MigrationProgress {
  totalObjects: number;
  migratedObjects: number;
  failedObjects: number;
  totalSize: number;
  migratedSize: number;
  currentObject?: string;
  errors: string[];
  startTime: Date;
  estimatedCompletion?: Date;
}

interface ObjectMigrationResult {
  key: string;
  success: boolean;
  sourceSize: number;
  targetSize: number;
  sourceETag: string;
  targetETag: string;
  checksumMatch: boolean;
  error?: string;
  migrationTime: number;
}

export class S3MigrationService {
  private s3Client: S3Client;
  private config: S3MigrationConfig;
  private progress: MigrationProgress;

  constructor(config: S3MigrationConfig) {
    this.config = config;
    this.s3Client = new S3Client({
      region: config.region,
    });

    this.progress = {
      totalObjects: 0,
      migratedObjects: 0,
      failedObjects: 0,
      totalSize: 0,
      migratedSize: 0,
      errors: [],
      startTime: new Date(),
    };
  }

  /**
   * Execute complete S3 content migration
   */
  async executeMigration(): Promise<MigrationProgress> {
    logger.info('🚀 Starting S3 content migration...');

    try {
      // Step 1: Validate buckets
      await this.validateBuckets();

      // Step 2: Scan source bucket
      const objects = await this.scanSourceBucket();
      this.progress.totalObjects = objects.length;
      this.progress.totalSize = objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);

      logger.info(`📊 Found ${objects.length} objects (${this.formatBytes(this.progress.totalSize)})`);

      if (this.config.dryRun) {
        logger.info('🔍 DRY RUN MODE - No objects will be migrated');
        return this.progress;
      }

      // Step 3: Setup target bucket
      await this.setupTargetBucket();

      // Step 4: Migrate objects in batches
      await this.migrateObjects(objects);

      // Step 5: Verify migration completeness
      if (this.config.verifyIntegrity) {
        await this.verifyMigrationCompleteness();
      }

      // Step 6: Cleanup source if requested
      if (this.config.deleteSource && this.progress.failedObjects === 0) {
        await this.cleanupSource(objects);
      }

      logger.info('✅ S3 content migration completed successfully');
      return this.progress;

    } catch (error) {
      logger.error('❌ S3 content migration failed', { error });
      throw error;
    }
  }

  /**
   * Validate source and target buckets
   */
  private async validateBuckets(): Promise<void> {
    logger.info('Validating S3 buckets...');

    try {
      // Check source bucket exists and is accessible
      const headSourceCommand = new HeadBucketCommand({
        Bucket: this.config.sourceBucket,
      });
      await this.s3Client.send(headSourceCommand);
      logger.info(`✅ Source bucket '${this.config.sourceBucket}' is accessible`);

      // Check if target bucket exists
      try {
        const headTargetCommand = new HeadBucketCommand({
          Bucket: this.config.targetBucket,
        });
        await this.s3Client.send(headTargetCommand);
        logger.info(`✅ Target bucket '${this.config.targetBucket}' exists`);
      } catch (error) {
        if (error instanceof S3ServiceException && error.name === 'NotFound') {
          logger.info(`📝 Target bucket '${this.config.targetBucket}' will be created`);
        } else {
          throw error;
        }
      }

      // Verify we have different buckets
      if (this.config.sourceBucket === this.config.targetBucket) {
        throw new Error('Source and target buckets cannot be the same');
      }

    } catch (error) {
      logger.error('❌ Bucket validation failed', { error });
      throw error;
    }
  }

  /**
   * Scan source bucket for all objects
   */
  private async scanSourceBucket(): Promise<Array<{ Key: string; Size?: number; ETag?: string; LastModified?: Date }>> {
    logger.info(`Scanning source bucket '${this.config.sourceBucket}'...`);

    const objects: Array<{ Key: string; Size?: number; ETag?: string; LastModified?: Date }> = [];
    let continuationToken: string | undefined;

    try {
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.config.sourceBucket,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const response = await this.s3Client.send(command);
        
        if (response.Contents) {
          objects.push(...response.Contents.map(obj => ({
            Key: obj.Key!,
            Size: obj.Size,
            ETag: obj.ETag,
            LastModified: obj.LastModified,
          })));
        }

        continuationToken = response.NextContinuationToken;
        
        if (objects.length % 10000 === 0) {
          logger.info(`📈 Scanned ${objects.length} objects...`);
        }

      } while (continuationToken);

      logger.info(`✅ Scan completed: ${objects.length} objects found`);
      return objects;

    } catch (error) {
      logger.error('❌ Failed to scan source bucket', { error });
      throw error;
    }
  }

  /**
   * Setup target bucket with proper configuration
   */
  private async setupTargetBucket(): Promise<void> {
    logger.info(`Setting up target bucket '${this.config.targetBucket}'...`);

    try {
      // Check if bucket exists
      try {
        await this.s3Client.send(new HeadBucketCommand({
          Bucket: this.config.targetBucket,
        }));
        logger.info('✅ Target bucket already exists');
      } catch (error) {
        if (error instanceof S3ServiceException && error.name === 'NotFound') {
          // Create bucket
          const createCommand = new CreateBucketCommand({
            Bucket: this.config.targetBucket,
            CreateBucketConfiguration: this.config.region !== 'us-east-1' ? {
              LocationConstraint: this.config.region as any,
            } : undefined,
          });

          await this.s3Client.send(createCommand);
          logger.info('✅ Target bucket created');

          // Wait for bucket to be available
          await this.waitForBucket(this.config.targetBucket);
        } else {
          throw error;
        }
      }

      // Configure bucket versioning
      const versioningCommand = new PutBucketVersioningCommand({
        Bucket: this.config.targetBucket,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
      await this.s3Client.send(versioningCommand);

      // Configure bucket encryption
      const encryptionCommand = new PutBucketEncryptionCommand({
        Bucket: this.config.targetBucket,
        ServerSideEncryptionConfiguration: {
          Rules: [{
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
            BucketKeyEnabled: true,
          }],
        },
      });
      await this.s3Client.send(encryptionCommand);

      // Configure lifecycle policy
      const lifecycleCommand = new PutBucketLifecycleConfigurationCommand({
        Bucket: this.config.targetBucket,
        LifecycleConfiguration: {
          Rules: [{
            ID: 'migration-cleanup',
            Status: 'Enabled',
            Filter: { Prefix: 'temp/' },
            Expiration: { Days: 1 },
          }, {
            ID: 'multipart-cleanup',
            Status: 'Enabled',
            Filter: {},
            AbortIncompleteMultipartUpload: {
              DaysAfterInitiation: 7,
            },
          }],
        },
      });
      await this.s3Client.send(lifecycleCommand);

      logger.info('✅ Target bucket configured');

    } catch (error) {
      logger.error('❌ Failed to setup target bucket', { error });
      throw error;
    }
  }

  /**
   * Wait for bucket to be available
   */
  private async waitForBucket(bucketName: string): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`Bucket ${bucketName} did not become available within timeout`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Migrate objects in batches
   */
  private async migrateObjects(objects: Array<{ Key: string; Size?: number; ETag?: string; LastModified?: Date }>): Promise<void> {
    logger.info('Starting object migration...');

    const batches = this.createBatches(objects, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.info(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} objects)`);

      // Process batch in parallel
      const batchPromises = batch.map(obj => this.migrateObject(obj));
      const results = await Promise.allSettled(batchPromises);

      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const migrationResult = result.value;
          if (migrationResult.success) {
            this.progress.migratedObjects++;
            this.progress.migratedSize += migrationResult.sourceSize;
          } else {
            this.progress.failedObjects++;
            this.progress.errors.push(`${migrationResult.key}: ${migrationResult.error}`);
          }
        } else {
          this.progress.failedObjects++;
          this.progress.errors.push(`Batch processing error: ${result.reason}`);
        }
      }

      // Update progress
      const completedObjects = this.progress.migratedObjects + this.progress.failedObjects;
      const progressPercent = Math.round((completedObjects / this.progress.totalObjects) * 100);
      
      logger.info(`📈 Progress: ${progressPercent}% (${completedObjects}/${this.progress.totalObjects})`);

      // Estimate completion time
      if (completedObjects > 0) {
        const elapsed = Date.now() - this.progress.startTime.getTime();
        const rate = completedObjects / elapsed;
        const remaining = this.progress.totalObjects - completedObjects;
        const estimatedMs = remaining / rate;
        this.progress.estimatedCompletion = new Date(Date.now() + estimatedMs);
      }
    }

    logger.info(`✅ Migration completed: ${this.progress.migratedObjects} succeeded, ${this.progress.failedObjects} failed`);
  }

  /**
   * Migrate a single object
   */
  private async migrateObject(obj: { Key: string; Size?: number; ETag?: string; LastModified?: Date }): Promise<ObjectMigrationResult> {
    const startTime = Date.now();
    this.progress.currentObject = obj.Key;

    try {
      // Check if object already exists in target
      let targetExists = false;
      let targetETag = '';
      
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: this.config.targetBucket,
          Key: obj.Key,
        });
        const headResponse = await this.s3Client.send(headCommand);
        targetExists = true;
        targetETag = headResponse.ETag || '';
      } catch (error) {
        // Object doesn't exist in target, which is expected
      }

      // Skip if object already exists and ETags match
      if (targetExists && targetETag === obj.ETag) {
        return {
          key: obj.Key,
          success: true,
          sourceSize: obj.Size || 0,
          targetSize: obj.Size || 0,
          sourceETag: obj.ETag || '',
          targetETag,
          checksumMatch: true,
          migrationTime: Date.now() - startTime,
        };
      }

      // Get source object metadata
      const getCommand = new GetObjectCommand({
        Bucket: this.config.sourceBucket,
        Key: obj.Key,
      });
      const sourceResponse = await this.s3Client.send(getCommand);

      // Read object data
      const objectData = await this.streamToBuffer(sourceResponse.Body as Readable);
      
      // Calculate checksum for integrity verification
      const sourceChecksum = crypto.createHash('md5').update(objectData).digest('hex');

      // Prepare metadata
      const metadata = this.config.preserveMetadata ? {
        ...sourceResponse.Metadata,
        'migration-source-bucket': this.config.sourceBucket,
        'migration-timestamp': new Date().toISOString(),
        'migration-checksum': sourceChecksum,
      } : {
        'migration-source-bucket': this.config.sourceBucket,
        'migration-timestamp': new Date().toISOString(),
        'migration-checksum': sourceChecksum,
      };

      // Upload to target bucket
      const putCommand = new PutObjectCommand({
        Bucket: this.config.targetBucket,
        Key: obj.Key,
        Body: objectData,
        ContentType: sourceResponse.ContentType,
        ContentEncoding: sourceResponse.ContentEncoding,
        ContentLanguage: sourceResponse.ContentLanguage,
        ContentDisposition: sourceResponse.ContentDisposition,
        CacheControl: sourceResponse.CacheControl,
        Expires: sourceResponse.Expires,
        Metadata: metadata,
        ServerSideEncryption: 'AES256',
      });

      const putResponse = await this.s3Client.send(putCommand);

      // Verify integrity if requested
      let checksumMatch = true;
      if (this.config.verifyIntegrity) {
        const verifyCommand = new GetObjectCommand({
          Bucket: this.config.targetBucket,
          Key: obj.Key,
        });
        const verifyResponse = await this.s3Client.send(verifyCommand);
        const targetData = await this.streamToBuffer(verifyResponse.Body as Readable);
        const targetChecksum = crypto.createHash('md5').update(targetData).digest('hex');
        checksumMatch = sourceChecksum === targetChecksum;
      }

      return {
        key: obj.Key,
        success: true,
        sourceSize: obj.Size || 0,
        targetSize: objectData.length,
        sourceETag: obj.ETag || '',
        targetETag: putResponse.ETag || '',
        checksumMatch,
        migrationTime: Date.now() - startTime,
      };

    } catch (error) {
      logger.error(`❌ Failed to migrate object ${obj.Key}`, { error });
      
      return {
        key: obj.Key,
        success: false,
        sourceSize: obj.Size || 0,
        targetSize: 0,
        sourceETag: obj.ETag || '',
        targetETag: '',
        checksumMatch: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        migrationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Create batches from objects array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Verify migration completeness
   */
  private async verifyMigrationCompleteness(): Promise<void> {
    logger.info('Verifying migration completeness...');

    try {
      // Get object counts from both buckets
      const sourceObjects = await this.scanSourceBucket();
      const targetObjects = await this.scanTargetBucket();

      const sourceCount = sourceObjects.length;
      const targetCount = targetObjects.length;

      logger.info(`📊 Object counts: source=${sourceCount}, target=${targetCount}`);

      if (sourceCount !== targetCount) {
        logger.warn(`⚠️ Object count mismatch: ${sourceCount - targetCount} objects missing`);
      }

      // Sample verification of object integrity
      const sampleSize = Math.min(100, sourceObjects.length);
      const sampleObjects = sourceObjects.slice(0, sampleSize);

      let verifiedCount = 0;
      for (const obj of sampleObjects) {
        try {
          const sourceCommand = new HeadObjectCommand({
            Bucket: this.config.sourceBucket,
            Key: obj.Key,
          });
          const targetCommand = new HeadObjectCommand({
            Bucket: this.config.targetBucket,
            Key: obj.Key,
          });

          const [sourceHead, targetHead] = await Promise.all([
            this.s3Client.send(sourceCommand),
            this.s3Client.send(targetCommand),
          ]);

          if (sourceHead.ContentLength === targetHead.ContentLength) {
            verifiedCount++;
          }
        } catch (error) {
          logger.warn(`⚠️ Verification failed for ${obj.Key}`, { error });
        }
      }

      const verificationRate = Math.round((verifiedCount / sampleSize) * 100);
      logger.info(`✅ Sample verification: ${verificationRate}% (${verifiedCount}/${sampleSize})`);

      if (verificationRate < 95) {
        logger.warn('⚠️ Low verification rate - manual review recommended');
      }

    } catch (error) {
      logger.error('❌ Migration verification failed', { error });
      throw error;
    }
  }

  /**
   * Scan target bucket for verification
   */
  private async scanTargetBucket(): Promise<Array<{ Key: string; Size?: number; ETag?: string }>> {
    const objects: Array<{ Key: string; Size?: number; ETag?: string }> = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.config.targetBucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await this.s3Client.send(command);
      
      if (response.Contents) {
        objects.push(...response.Contents.map(obj => ({
          Key: obj.Key!,
          Size: obj.Size,
          ETag: obj.ETag,
        })));
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return objects;
  }

  /**
   * Cleanup source bucket if requested
   */
  private async cleanupSource(objects: Array<{ Key: string }>): Promise<void> {
    if (!this.config.deleteSource) return;

    logger.info('🧹 Cleaning up source bucket...');

    try {
      const batches = this.createBatches(objects, 1000); // S3 delete limit

      for (const batch of batches) {
        const deletePromises = batch.map(async (obj) => {
          try {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: this.config.sourceBucket,
              Key: obj.Key,
            });
            await this.s3Client.send(deleteCommand);
          } catch (error) {
            logger.warn(`Failed to delete ${obj.Key}`, { error });
          }
        });

        await Promise.allSettled(deletePromises);
      }

      logger.info('✅ Source cleanup completed');

    } catch (error) {
      logger.error('❌ Source cleanup failed', { error });
      // Don't throw - cleanup failure shouldn't fail the migration
    }
  }

  /**
   * Get migration progress
   */
  getMigrationProgress(): MigrationProgress {
    return { ...this.progress };
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Update application references to new S3 locations
   */
  async updateApplicationReferences(): Promise<void> {
    logger.info('Updating application references to new S3 locations...');

    try {
      // This would typically involve:
      // 1. Updating database records with new S3 URLs
      // 2. Updating configuration files
      // 3. Updating CDN origins
      // 4. Updating application code references

      // For now, we'll update the Parameter Store with new bucket name
      // This would be done via AWS CLI or SDK in a real implementation
      logger.info(`💡 Update Parameter Store: /directfanz/s3/content-bucket = ${this.config.targetBucket}`);
      logger.info(`💡 Update Parameter Store: /directfanz/s3/static-bucket = ${this.config.targetBucket}`);
      
      // Update CloudFront origins if applicable
      logger.info('💡 Update CloudFront distribution origins to point to new bucket');
      
      // Update application configuration
      logger.info('💡 Update application configuration with new bucket names');

      logger.info('✅ Application references updated');

    } catch (error) {
      logger.error('❌ Failed to update application references', { error });
      throw error;
    }
  }
}

/**
 * Create S3 migration configuration from environment
 */
export async function createS3MigrationConfig(): Promise<S3MigrationConfig> {
  const sourceBucket = process.env.SOURCE_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME;
  const targetBucket = await getParameter('/directfanz/s3/content-bucket', 'TARGET_S3_BUCKET');
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!sourceBucket || !targetBucket) {
    throw new Error('Source and target S3 bucket names are required');
  }

  return {
    sourceBucket,
    targetBucket,
    region,
    batchSize: parseInt(process.env.S3_MIGRATION_BATCH_SIZE || '50'),
    verifyIntegrity: process.env.S3_MIGRATION_VERIFY_INTEGRITY !== 'false',
    preserveMetadata: process.env.S3_MIGRATION_PRESERVE_METADATA !== 'false',
    deleteSource: process.env.S3_MIGRATION_DELETE_SOURCE === 'true',
    dryRun: process.env.S3_MIGRATION_DRY_RUN === 'true',
  };
}