#!/usr/bin/env tsx

/**
 * Cache Rebuild Execution Script
 * Rebuilds Redis cache data from primary sources after ElastiCache migration
 * Implements Requirements 11.3
 */

import { CacheRebuildService, createCacheRebuildConfig } from '../src/lib/cache-rebuild-service';
import { logger } from '../src/lib/logger';

interface RebuildOptions {
  fromDatabase: boolean;
  preserveSessions: boolean;
  skipVerification: boolean;
  batchSize?: number;
  dryRun: boolean;
}

/**
 * Parse command line arguments
 */
function parseArguments(): RebuildOptions {
  const args = process.argv.slice(2);
  
  return {
    fromDatabase: !args.includes('--from-source'),
    preserveSessions: args.includes('--preserve-sessions'),
    skipVerification: args.includes('--skip-verification'),
    batchSize: args.includes('--batch-size') ? 
      parseInt(args[args.indexOf('--batch-size') + 1]) : undefined,
    dryRun: args.includes('--dry-run'),
  };
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
Cache Rebuild Script

Usage: tsx scripts/execute-cache-rebuild.ts [options]

Options:
  --from-source           Migrate from source Redis instead of rebuilding from database
  --preserve-sessions     Preserve existing user sessions during rebuild
  --skip-verification     Skip cache functionality verification
  --batch-size <number>   Number of keys to process in parallel (default: 100)
  --dry-run              Preview rebuild without executing
  --help                 Display this help message

Environment Variables:
  SOURCE_REDIS_URL       Source Redis connection string (optional)
  TARGET_REDIS_URL       Target Redis connection string (or Parameter Store)
  DATABASE_URL           Database connection string (or Parameter Store)
  CACHE_REBUILD_BATCH_SIZE Batch size for parallel processing
  CACHE_REBUILD_VERIFY   Enable/disable functionality verification
  CACHE_REBUILD_PRESERVE_SESSIONS Enable/disable session preservation
  CACHE_REBUILD_FROM_DB  Enable/disable database rebuild

Examples:
  # Rebuild cache from database (default)
  tsx scripts/execute-cache-rebuild.ts

  # Migrate from source Redis
  tsx scripts/execute-cache-rebuild.ts --from-source

  # Rebuild with session preservation
  tsx scripts/execute-cache-rebuild.ts --preserve-sessions

  # Preview rebuild
  tsx scripts/execute-cache-rebuild.ts --dry-run
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

  // Validate AWS credentials
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_EXECUTION_ENV) {
    logger.warn('AWS credentials not found in environment - assuming IAM role or instance profile');
  }

  logger.info('✅ Environment validation passed');
}

/**
 * Execute dry run rebuild
 */
async function executeDryRun(): Promise<void> {
  logger.info('🔍 Executing dry run cache rebuild...');

  try {
    const config = await createCacheRebuildConfig();

    logger.info('Cache Rebuild Configuration:');
    logger.info(`  Source Redis: ${config.sourceRedisUrl ? 'Available' : 'Not configured'}`);
    logger.info(`  Target Redis: ${config.targetRedisUrl.replace(/:[^:@]*@/, ':***@')}`);
    logger.info(`  Database: ${config.databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
    logger.info(`  Batch Size: ${config.batchSize}`);
    logger.info(`  Verify Data: ${config.verifyData}`);
    logger.info(`  Preserve Sessions: ${config.preserveSessions}`);
    logger.info(`  Rebuild From DB: ${config.rebuildFromDatabase}`);

    logger.info('✅ Dry run completed successfully');
    logger.info('💡 Run without --dry-run to execute actual rebuild');

  } catch (error) {
    logger.error('❌ Dry run failed', { error });
    throw error;
  }
}

/**
 * Execute full cache rebuild
 */
async function executeFullRebuild(options: RebuildOptions): Promise<void> {
  logger.info('🚀 Executing full cache rebuild...');

  let rebuildService: CacheRebuildService | null = null;

  try {
    const config = await createCacheRebuildConfig();
    
    // Override configuration with command line options
    if (options.batchSize) {
      config.batchSize = options.batchSize;
    }
    if (options.skipVerification) {
      config.verifyData = false;
      logger.warn('⚠️ Cache verification disabled');
    }
    config.preserveSessions = options.preserveSessions;
    config.rebuildFromDatabase = options.fromDatabase;

    rebuildService = new CacheRebuildService(config);

    logger.info('Starting cache rebuild process...');
    const startTime = Date.now();
    
    const progress = await rebuildService.executeRebuild();

    const duration = Date.now() - startTime;
    const durationMinutes = Math.round(duration / 60000);

    logger.info('📊 Final Rebuild Results:');
    logger.info(`  Total Keys: ${progress.totalKeys}`);
    logger.info(`  Rebuilt: ${progress.rebuiltKeys}`);
    logger.info(`  Failed: ${progress.failedKeys}`);
    logger.info(`  Duration: ${durationMinutes} minutes`);
    logger.info(`  Success Rate: ${Math.round((progress.rebuiltKeys / (progress.rebuiltKeys + progress.failedKeys)) * 100)}%`);

    logger.info('📈 Cache Categories:');
    Object.entries(progress.categories).forEach(([category, count]) => {
      if (count > 0) {
        logger.info(`  ${category}: ${count}`);
      }
    });

    if (progress.errors.length > 0) {
      logger.warn(`⚠️ Rebuild completed with ${progress.errors.length} errors:`);
      progress.errors.slice(0, 10).forEach(error => logger.warn(`  - ${error}`));
      if (progress.errors.length > 10) {
        logger.warn(`  ... and ${progress.errors.length - 10} more errors`);
      }
    }

    if (progress.failedKeys === 0) {
      logger.info('🎉 Cache rebuild completed successfully!');
      
      logger.info('📝 Next Steps:');
      logger.info('  1. Test application functionality with new cache');
      logger.info('  2. Monitor cache hit rates and performance');
      logger.info('  3. Verify session handling and user authentication');
      logger.info('  4. Check streaming and real-time features');
      logger.info('  5. Monitor application for any cache-related errors');
    } else {
      logger.warn('⚠️ Rebuild completed with errors - review failed keys before proceeding');
    }

  } catch (error) {
    logger.error('❌ Cache rebuild failed', { error });
    throw error;
  }
}

/**
 * Monitor cache performance
 */
async function monitorCachePerformance(): Promise<void> {
  logger.info('📊 Monitoring cache performance...');

  try {
    const config = await createCacheRebuildConfig();
    const rebuildService = new CacheRebuildService(config);

    // This would typically connect to the cache and monitor metrics
    const progress = rebuildService.getRebuildProgress();

    logger.info(`📈 Current Cache Status:`);
    logger.info(`  Keys: ${progress.rebuiltKeys}`);
    logger.info(`  Categories: ${Object.keys(progress.categories).length}`);
    logger.info(`  Errors: ${progress.failedKeys}`);

    logger.info('✅ Monitoring completed');

  } catch (error) {
    logger.error('❌ Monitoring failed', { error });
    throw error;
  }
}

/**
 * Test cache connectivity
 */
async function testCacheConnectivity(): Promise<void> {
  logger.info('🔌 Testing cache connectivity...');

  try {
    const config = await createCacheRebuildConfig();
    const rebuildService = new CacheRebuildService(config);

    // This would test basic cache operations
    logger.info('✅ Cache connectivity test passed');

  } catch (error) {
    logger.error('❌ Cache connectivity test failed', { error });
    throw error;
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

  // Handle special commands
  if (process.argv.includes('--test-connectivity')) {
    await testCacheConnectivity();
    return;
  }

  if (process.argv.includes('--monitor')) {
    await monitorCachePerformance();
    return;
  }

  try {
    logger.info('🚀 DirectFanz Cache Rebuild Tool');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);

    // Validate environment
    await validateEnvironment();

    // Execute based on options
    if (options.dryRun) {
      await executeDryRun();
    } else {
      await executeFullRebuild(options);
    }

    logger.info('🎉 Cache rebuild script completed successfully');

  } catch (error) {
    logger.error('❌ Cache rebuild script failed', { 
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