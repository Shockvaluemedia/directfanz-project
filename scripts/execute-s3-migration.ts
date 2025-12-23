#!/usr/bin/env tsx

/**
 * S3 Content Migration Execution Script
 * Migrates S3 content between buckets with integrity verification
 * Implements Requirements 11.2
 */

import { S3MigrationService, createS3MigrationConfig } from '../src/lib/s3-migration-service';
import { logger } from '../src/lib/logger';

interface MigrationOptions {
  dryRun: boolean;
  skipVerification: boolean;
  preserveMetadata: boolean;
  deleteSource: boolean;
  batchSize?: number;
  updateReferences: boolean;
}

/**
 * Parse command line arguments
 */
function parseArguments(): MigrationOptions {
  const args = process.argv.slice(2);
  
  return {
    dryRun: args.includes('--dry-run'),
    skipVerification: args.includes('--skip-verification'),
    preserveMetadata: !args.includes('--no-metadata'),
    deleteSource: args.includes('--delete-source'),
    batchSize: args.includes('--batch-size') ? 
      parseInt(args[args.indexOf('--batch-size') + 1]) : undefined,
    updateReferences: !args.includes('--no-update-references'),
  };
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
S3 Content Migration Script

Usage: tsx scripts/execute-s3-migration.ts [options]

Options:
  --dry-run                Preview migration without executing
  --skip-verification      Skip integrity verification
  --no-metadata           Don't preserve object metadata
  --delete-source         Delete source objects after successful migration
  --batch-size <number>   Number of objects to process in parallel (default: 50)
  --no-update-references  Skip updating application references
  --help                  Display this help message

Environment Variables:
  SOURCE_S3_BUCKET        Source S3 bucket name
  TARGET_S3_BUCKET        Target S3 bucket name (or Parameter Store)
  AWS_REGION             AWS region for S3 operations
  S3_MIGRATION_BATCH_SIZE Batch size for parallel processing
  S3_MIGRATION_VERIFY_INTEGRITY Enable/disable integrity verification
  S3_MIGRATION_PRESERVE_METADATA Enable/disable metadata preservation
  S3_MIGRATION_DELETE_SOURCE Enable/disable source deletion
  S3_MIGRATION_DRY_RUN   Enable/disable dry run mode

Examples:
  # Preview migration
  tsx scripts/execute-s3-migration.ts --dry-run

  # Execute migration with verification
  tsx scripts/execute-s3-migration.ts

  # Execute migration and delete source
  tsx scripts/execute-s3-migration.ts --delete-source

  # Execute migration with custom batch size
  tsx scripts/execute-s3-migration.ts --batch-size 100
`);
}

/**
 * Validate environment and prerequisites
 */
async function validateEnvironment(): Promise<void> {
  logger.info('Validating environment and prerequisites...');

  // Check required environment variables
  const requiredVars = ['AWS_REGION'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Check S3 bucket names
  const sourceBucket = process.env.SOURCE_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME;
  if (!sourceBucket) {
    throw new Error('SOURCE_S3_BUCKET or AWS_S3_BUCKET_NAME is required');
  }

  // Validate AWS credentials
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_EXECUTION_ENV) {
    logger.warn('AWS credentials not found in environment - assuming IAM role or instance profile');
  }

  logger.info('✅ Environment validation passed');
}

/**
 * Execute dry run migration
 */
async function executeDryRun(): Promise<void> {
  logger.info('🔍 Executing dry run S3 migration...');

  try {
    const config = await createS3MigrationConfig();
    config.dryRun = true;

    const migrationService = new S3MigrationService(config);

    logger.info('Migration Configuration:');
    logger.info(`  Source Bucket: ${config.sourceBucket}`);
    logger.info(`  Target Bucket: ${config.targetBucket}`);
    logger.info(`  Region: ${config.region}`);
    logger.info(`  Batch Size: ${config.batchSize}`);
    logger.info(`  Verify Integrity: ${config.verifyIntegrity}`);
    logger.info(`  Preserve Metadata: ${config.preserveMetadata}`);
    logger.info(`  Delete Source: ${config.deleteSource}`);

    const progress = await migrationService.executeMigration();

    logger.info('📊 Dry Run Results:');
    logger.info(`  Total Objects: ${progress.totalObjects}`);
    logger.info(`  Total Size: ${formatBytes(progress.totalSize)}`);
    logger.info(`  Estimated Migration Time: ${estimateMigrationTime(progress.totalObjects, progress.totalSize)}`);

    logger.info('✅ Dry run completed successfully');
    logger.info('💡 Run without --dry-run to execute actual migration');

  } catch (error) {
    logger.error('❌ Dry run failed', { error });
    throw error;
  }
}

/**
 * Execute full S3 migration
 */
async function executeFullMigration(options: MigrationOptions): Promise<void> {
  logger.info('🚀 Executing full S3 content migration...');

  let migrationService: S3MigrationService | null = null;

  try {
    const config = await createS3MigrationConfig();
    
    // Override configuration with command line options
    if (options.batchSize) {
      config.batchSize = options.batchSize;
    }
    if (options.skipVerification) {
      config.verifyIntegrity = false;
      logger.warn('⚠️ Integrity verification disabled');
    }
    config.preserveMetadata = options.preserveMetadata;
    config.deleteSource = options.deleteSource;

    migrationService = new S3MigrationService(config);

    logger.info('Starting migration process...');
    const startTime = Date.now();
    
    const progress = await migrationService.executeMigration();

    const duration = Date.now() - startTime;
    const durationMinutes = Math.round(duration / 60000);

    logger.info('📊 Final Migration Results:');
    logger.info(`  Total Objects: ${progress.totalObjects}`);
    logger.info(`  Migrated: ${progress.migratedObjects}`);
    logger.info(`  Failed: ${progress.failedObjects}`);
    logger.info(`  Total Size: ${formatBytes(progress.totalSize)}`);
    logger.info(`  Migrated Size: ${formatBytes(progress.migratedSize)}`);
    logger.info(`  Duration: ${durationMinutes} minutes`);
    logger.info(`  Success Rate: ${Math.round((progress.migratedObjects / progress.totalObjects) * 100)}%`);

    if (progress.errors.length > 0) {
      logger.warn(`⚠️ Migration completed with ${progress.errors.length} errors:`);
      progress.errors.slice(0, 10).forEach(error => logger.warn(`  - ${error}`));
      if (progress.errors.length > 10) {
        logger.warn(`  ... and ${progress.errors.length - 10} more errors`);
      }
    }

    // Update application references if requested
    if (options.updateReferences && progress.failedObjects === 0) {
      logger.info('🔄 Updating application references...');
      await migrationService.updateApplicationReferences();
    }

    if (progress.failedObjects === 0) {
      logger.info('🎉 S3 content migration completed successfully!');
      
      logger.info('📝 Next Steps:');
      logger.info('  1. Verify application functionality with new S3 bucket');
      logger.info('  2. Update CloudFront distribution origins if applicable');
      logger.info('  3. Test content access and upload functionality');
      logger.info('  4. Monitor application for any S3-related errors');
      if (!options.deleteSource) {
        logger.info('  5. Consider cleaning up source bucket after verification');
      }
    } else {
      logger.warn('⚠️ Migration completed with errors - review failed objects before proceeding');
    }

  } catch (error) {
    logger.error('❌ S3 migration failed', { error });
    throw error;
  }
}

/**
 * Monitor existing migration
 */
async function monitorMigration(): Promise<void> {
  logger.info('📊 Monitoring S3 migration progress...');

  try {
    const config = await createS3MigrationConfig();
    const migrationService = new S3MigrationService(config);

    // This would typically connect to an existing migration process
    // For now, we'll just show how to get progress
    const progress = migrationService.getMigrationProgress();

    logger.info(`📈 Current Progress:`);
    logger.info(`  Objects: ${progress.migratedObjects}/${progress.totalObjects}`);
    logger.info(`  Size: ${formatBytes(progress.migratedSize)}/${formatBytes(progress.totalSize)}`);
    logger.info(`  Errors: ${progress.failedObjects}`);
    
    if (progress.estimatedCompletion) {
      logger.info(`  ETA: ${progress.estimatedCompletion.toLocaleString()}`);
    }

    logger.info('✅ Monitoring completed');

  } catch (error) {
    logger.error('❌ Monitoring failed', { error });
    throw error;
  }
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Estimate migration time
 */
function estimateMigrationTime(objectCount: number, totalSize: number): string {
  // Rough estimates based on typical S3 transfer rates
  const avgTransferRate = 10 * 1024 * 1024; // 10 MB/s
  const avgObjectOverhead = 0.1; // 100ms per object overhead
  
  const transferTime = totalSize / avgTransferRate;
  const overheadTime = objectCount * avgObjectOverhead;
  const totalSeconds = transferTime + overheadTime;
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `~${hours}h ${minutes}m`;
  } else {
    return `~${minutes}m`;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const options = parseArguments();

  // Handle help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    displayHelp();
    return;
  }

  try {
    logger.info('🚀 DirectFanz S3 Migration Tool');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);

    // Validate environment
    await validateEnvironment();

    // Execute based on options
    if (options.dryRun) {
      await executeDryRun();
    } else {
      await executeFullMigration(options);
    }

    logger.info('🎉 S3 migration script completed successfully');

  } catch (error) {
    logger.error('❌ S3 migration script failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { main, parseArguments, validateEnvironment };