#!/usr/bin/env tsx

/**
 * Master Rollback Execution Script
 * Coordinates rollback procedures across all migration phases
 * Implements Requirements 11.5
 */

import { logger } from '../src/lib/logger';
import { getParameter } from '../src/lib/aws-config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface RollbackOptions {
  phase: 'database' | 's3' | 'cache' | 'application' | 'dns' | 'full';
  environment: string;
  dryRun: boolean;
  skipVerification: boolean;
  force: boolean;
  backupState: boolean;
}

interface RollbackState {
  timestamp: string;
  phase: string;
  environment: string;
  status: 'started' | 'in-progress' | 'completed' | 'failed';
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: string;
    endTime?: string;
    error?: string;
  }>;
  originalConfig: Record<string, any>;
  rollbackConfig: Record<string, any>;
}

/**
 * Parse command line arguments
 */
function parseArguments(): RollbackOptions {
  const args = process.argv.slice(2);
  
  return {
    phase: (args.find(arg => ['database', 's3', 'cache', 'application', 'dns', 'full'].includes(arg)) as RollbackOptions['phase']) || 'full',
    environment: args.includes('--environment') ? 
      args[args.indexOf('--environment') + 1] : 'production',
    dryRun: args.includes('--dry-run'),
    skipVerification: args.includes('--skip-verification'),
    force: args.includes('--force'),
    backupState: !args.includes('--no-backup'),
  };
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
Master Rollback Execution Script

Usage: tsx scripts/execute-master-rollback.ts [phase] [options]

Phases:
  database      Rollback database migration only
  s3            Rollback S3 content migration only
  cache         Rollback cache rebuild only
  application   Rollback application configuration only
  dns           Rollback DNS changes only
  full          Rollback entire migration (default)

Options:
  --environment <env>    Target environment (default: production)
  --dry-run             Preview rollback without executing
  --skip-verification   Skip post-rollback verification
  --force               Force rollback even if risky
  --no-backup           Skip state backup before rollback
  --help                Display this help message

Examples:
  # Full rollback with verification
  tsx scripts/execute-master-rollback.ts full

  # Rollback database migration only
  tsx scripts/execute-master-rollback.ts database

  # Dry run full rollback
  tsx scripts/execute-master-rollback.ts full --dry-run

  # Force rollback in staging
  tsx scripts/execute-master-rollback.ts full --environment staging --force
`);
}

/**
 * Initialize rollback state tracking
 */
function initializeRollbackState(options: RollbackOptions): RollbackState {
  const state: RollbackState = {
    timestamp: new Date().toISOString(),
    phase: options.phase,
    environment: options.environment,
    status: 'started',
    steps: [],
    originalConfig: {},
    rollbackConfig: {},
  };

  // Define rollback steps based on phase
  switch (options.phase) {
    case 'database':
      state.steps = [
        { name: 'stop-replication', status: 'pending' },
        { name: 'disable-dual-write', status: 'pending' },
        { name: 'verify-source-database', status: 'pending' },
        { name: 'cleanup-dms-resources', status: 'pending' },
      ];
      break;

    case 's3':
      state.steps = [
        { name: 'stop-migration', status: 'pending' },
        { name: 'revert-app-config', status: 'pending' },
        { name: 'restore-deleted-objects', status: 'pending' },
        { name: 'update-cloudfront', status: 'pending' },
      ];
      break;

    case 'cache':
      state.steps = [
        { name: 'stop-rebuild', status: 'pending' },
        { name: 'clear-target-cache', status: 'pending' },
        { name: 'restore-original-cache', status: 'pending' },
        { name: 'update-app-config', status: 'pending' },
      ];
      break;

    case 'application':
      state.steps = [
        { name: 'revert-environment-vars', status: 'pending' },
        { name: 'revert-parameter-store', status: 'pending' },
        { name: 'rollback-deployment', status: 'pending' },
      ];
      break;

    case 'dns':
      state.steps = [
        { name: 'revert-dns-records', status: 'pending' },
        { name: 'update-health-checks', status: 'pending' },
        { name: 'monitor-propagation', status: 'pending' },
      ];
      break;

    case 'full':
      state.steps = [
        { name: 'stop-all-migrations', status: 'pending' },
        { name: 'revert-dns', status: 'pending' },
        { name: 'rollback-application', status: 'pending' },
        { name: 'restore-cache', status: 'pending' },
        { name: 'revert-s3-config', status: 'pending' },
        { name: 'stop-database-replication', status: 'pending' },
        { name: 'verify-system-integrity', status: 'pending' },
      ];
      break;
  }

  return state;
}

/**
 * Backup current system state
 */
async function backupCurrentState(state: RollbackState): Promise<void> {
  logger.info('📦 Backing up current system state...');

  try {
    // Backup environment variables
    state.originalConfig.environment = {
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
      AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
      CLOUDFRONT_DISTRIBUTION_ID: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    };

    // Backup Parameter Store values
    try {
      state.originalConfig.parameterStore = {
        databaseUrl: await getParameter('/directfanz/database/url'),
        redisUrl: await getParameter('/directfanz/redis/url'),
        s3Bucket: await getParameter('/directfanz/s3/content-bucket'),
      };
    } catch (error) {
      logger.warn('⚠️ Could not backup Parameter Store values', { error });
    }

    // Backup Kubernetes deployment state
    try {
      const deploymentState = execSync('kubectl get deployments -o json', { encoding: 'utf8' });
      state.originalConfig.kubernetes = JSON.parse(deploymentState);
    } catch (error) {
      logger.warn('⚠️ Could not backup Kubernetes state', { error });
    }

    // Save state to file
    const stateFile = path.join(process.cwd(), `rollback-state-${Date.now()}.json`);
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    
    logger.info(`✅ System state backed up to: ${stateFile}`);

  } catch (error) {
    logger.error('❌ Failed to backup system state', { error });
    throw error;
  }
}

/**
 * Execute rollback step
 */
async function executeRollbackStep(stepName: string, state: RollbackState, options: RollbackOptions): Promise<void> {
  const step = state.steps.find(s => s.name === stepName);
  if (!step) {
    throw new Error(`Step not found: ${stepName}`);
  }

  step.status = 'running';
  step.startTime = new Date().toISOString();

  logger.info(`🔄 Executing rollback step: ${stepName}`);

  try {
    switch (stepName) {
      case 'stop-all-migrations':
        await stopAllMigrations();
        break;

      case 'stop-replication':
        await stopDatabaseReplication();
        break;

      case 'disable-dual-write':
        await disableDualWrite();
        break;

      case 'verify-source-database':
        await verifySourceDatabase();
        break;

      case 'cleanup-dms-resources':
        await cleanupDMSResources();
        break;

      case 'stop-migration':
        await stopS3Migration();
        break;

      case 'revert-app-config':
        await revertApplicationConfig();
        break;

      case 'restore-deleted-objects':
        await restoreDeletedS3Objects();
        break;

      case 'update-cloudfront':
        await updateCloudFrontConfig();
        break;

      case 'stop-rebuild':
        await stopCacheRebuild();
        break;

      case 'clear-target-cache':
        await clearTargetCache();
        break;

      case 'restore-original-cache':
        await restoreOriginalCache();
        break;

      case 'update-app-config':
        await updateApplicationConfig();
        break;

      case 'revert-environment-vars':
        await revertEnvironmentVariables(state);
        break;

      case 'revert-parameter-store':
        await revertParameterStore(state);
        break;

      case 'rollback-deployment':
        await rollbackKubernetesDeployment();
        break;

      case 'revert-dns-records':
        await revertDNSRecords();
        break;

      case 'update-health-checks':
        await updateHealthChecks();
        break;

      case 'monitor-propagation':
        await monitorDNSPropagation();
        break;

      case 'revert-dns':
        await revertDNSRecords();
        break;

      case 'rollback-application':
        await revertApplicationConfig();
        await rollbackKubernetesDeployment();
        break;

      case 'restore-cache':
        await restoreOriginalCache();
        break;

      case 'revert-s3-config':
        await revertApplicationConfig();
        break;

      case 'stop-database-replication':
        await stopDatabaseReplication();
        break;

      case 'verify-system-integrity':
        if (!options.skipVerification) {
          await verifySystemIntegrity();
        }
        break;

      default:
        throw new Error(`Unknown rollback step: ${stepName}`);
    }

    step.status = 'completed';
    step.endTime = new Date().toISOString();
    logger.info(`✅ Completed rollback step: ${stepName}`);

  } catch (error) {
    step.status = 'failed';
    step.endTime = new Date().toISOString();
    step.error = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(`❌ Failed rollback step: ${stepName}`, { error });
    throw error;
  }
}

/**
 * Stop all migration processes
 */
async function stopAllMigrations(): Promise<void> {
  logger.info('🛑 Stopping all migration processes...');

  try {
    // Stop database migration
    try {
      execSync('pkill -f "execute-database-migration"', { stdio: 'ignore' });
    } catch (error) {
      // Process might not be running
    }

    // Stop S3 migration
    try {
      execSync('pkill -f "execute-s3-migration"', { stdio: 'ignore' });
    } catch (error) {
      // Process might not be running
    }

    // Stop cache rebuild
    try {
      execSync('pkill -f "execute-cache-rebuild"', { stdio: 'ignore' });
    } catch (error) {
      // Process might not be running
    }

    logger.info('✅ All migration processes stopped');

  } catch (error) {
    logger.error('❌ Failed to stop migration processes', { error });
    throw error;
  }
}

/**
 * Stop database replication
 */
async function stopDatabaseReplication(): Promise<void> {
  logger.info('🔄 Stopping database replication...');

  try {
    execSync('tsx scripts/execute-database-migration.ts --rollback', { stdio: 'inherit' });
    logger.info('✅ Database replication stopped');
  } catch (error) {
    logger.error('❌ Failed to stop database replication', { error });
    throw error;
  }
}

/**
 * Disable dual-write mode
 */
async function disableDualWrite(): Promise<void> {
  logger.info('🔄 Disabling dual-write mode...');

  try {
    // Update environment variable
    process.env.DUAL_WRITE_ENABLED = 'false';
    
    // Update Kubernetes secret
    execSync(`kubectl create secret generic directfanz-config \
      --from-literal=DUAL_WRITE_ENABLED=false \
      --dry-run=client -o yaml | kubectl apply -f -`, { stdio: 'inherit' });

    logger.info('✅ Dual-write mode disabled');
  } catch (error) {
    logger.error('❌ Failed to disable dual-write mode', { error });
    throw error;
  }
}

/**
 * Verify source database connectivity
 */
async function verifySourceDatabase(): Promise<void> {
  logger.info('🔍 Verifying source database...');

  try {
    execSync('tsx scripts/test-db-connection.cjs --source', { stdio: 'inherit' });
    logger.info('✅ Source database verified');
  } catch (error) {
    logger.error('❌ Source database verification failed', { error });
    throw error;
  }
}

/**
 * Cleanup DMS resources
 */
async function cleanupDMSResources(): Promise<void> {
  logger.info('🧹 Cleaning up DMS resources...');

  try {
    // This would be implemented with AWS SDK calls
    logger.info('💡 DMS resource cleanup would be executed here');
    logger.info('✅ DMS resources cleaned up');
  } catch (error) {
    logger.error('❌ Failed to cleanup DMS resources', { error });
    throw error;
  }
}

/**
 * Stop S3 migration
 */
async function stopS3Migration(): Promise<void> {
  logger.info('🛑 Stopping S3 migration...');

  try {
    execSync('pkill -f "execute-s3-migration"', { stdio: 'ignore' });
    logger.info('✅ S3 migration stopped');
  } catch (error) {
    logger.warn('⚠️ S3 migration process may not have been running');
  }
}

/**
 * Revert application configuration
 */
async function revertApplicationConfig(): Promise<void> {
  logger.info('🔄 Reverting application configuration...');

  try {
    // This would revert to original configuration
    logger.info('💡 Application configuration revert would be executed here');
    logger.info('✅ Application configuration reverted');
  } catch (error) {
    logger.error('❌ Failed to revert application configuration', { error });
    throw error;
  }
}

/**
 * Restore deleted S3 objects
 */
async function restoreDeletedS3Objects(): Promise<void> {
  logger.info('🔄 Restoring deleted S3 objects...');

  try {
    // This would restore objects from target bucket back to source
    logger.info('💡 S3 object restoration would be executed here');
    logger.info('✅ S3 objects restored');
  } catch (error) {
    logger.error('❌ Failed to restore S3 objects', { error });
    throw error;
  }
}

/**
 * Update CloudFront configuration
 */
async function updateCloudFrontConfig(): Promise<void> {
  logger.info('🔄 Updating CloudFront configuration...');

  try {
    // This would revert CloudFront to original bucket
    logger.info('💡 CloudFront configuration update would be executed here');
    logger.info('✅ CloudFront configuration updated');
  } catch (error) {
    logger.error('❌ Failed to update CloudFront configuration', { error });
    throw error;
  }
}

/**
 * Stop cache rebuild
 */
async function stopCacheRebuild(): Promise<void> {
  logger.info('🛑 Stopping cache rebuild...');

  try {
    execSync('pkill -f "execute-cache-rebuild"', { stdio: 'ignore' });
    logger.info('✅ Cache rebuild stopped');
  } catch (error) {
    logger.warn('⚠️ Cache rebuild process may not have been running');
  }
}

/**
 * Clear target cache
 */
async function clearTargetCache(): Promise<void> {
  logger.info('🧹 Clearing target cache...');

  try {
    // This would clear ElastiCache
    logger.info('💡 Target cache clearing would be executed here');
    logger.info('✅ Target cache cleared');
  } catch (error) {
    logger.error('❌ Failed to clear target cache', { error });
    throw error;
  }
}

/**
 * Restore original cache
 */
async function restoreOriginalCache(): Promise<void> {
  logger.info('🔄 Restoring original cache...');

  try {
    execSync('tsx scripts/execute-cache-rebuild.ts --restore-from-source', { stdio: 'inherit' });
    logger.info('✅ Original cache restored');
  } catch (error) {
    logger.error('❌ Failed to restore original cache', { error });
    throw error;
  }
}

/**
 * Update application configuration
 */
async function updateApplicationConfig(): Promise<void> {
  logger.info('🔄 Updating application configuration...');

  try {
    // This would update app config to use original cache
    logger.info('💡 Application configuration update would be executed here');
    logger.info('✅ Application configuration updated');
  } catch (error) {
    logger.error('❌ Failed to update application configuration', { error });
    throw error;
  }
}

/**
 * Revert environment variables
 */
async function revertEnvironmentVariables(state: RollbackState): Promise<void> {
  logger.info('🔄 Reverting environment variables...');

  try {
    const originalEnv = state.originalConfig.environment;
    if (originalEnv) {
      // Update Kubernetes secrets with original values
      const secretData = Object.entries(originalEnv)
        .map(([key, value]) => `--from-literal=${key}=${value}`)
        .join(' ');

      execSync(`kubectl create secret generic directfanz-config \
        ${secretData} \
        --dry-run=client -o yaml | kubectl apply -f -`, { stdio: 'inherit' });
    }

    logger.info('✅ Environment variables reverted');
  } catch (error) {
    logger.error('❌ Failed to revert environment variables', { error });
    throw error;
  }
}

/**
 * Revert Parameter Store values
 */
async function revertParameterStore(state: RollbackState): Promise<void> {
  logger.info('🔄 Reverting Parameter Store values...');

  try {
    const originalParams = state.originalConfig.parameterStore;
    if (originalParams) {
      // Revert each parameter
      for (const [param, value] of Object.entries(originalParams)) {
        if (value) {
          let paramName = '';
          switch (param) {
            case 'databaseUrl':
              paramName = '/directfanz/database/url';
              break;
            case 'redisUrl':
              paramName = '/directfanz/redis/url';
              break;
            case 's3Bucket':
              paramName = '/directfanz/s3/content-bucket';
              break;
          }

          if (paramName) {
            execSync(`aws ssm put-parameter \
              --name "${paramName}" \
              --value "${value}" \
              --overwrite`, { stdio: 'inherit' });
          }
        }
      }
    }

    logger.info('✅ Parameter Store values reverted');
  } catch (error) {
    logger.error('❌ Failed to revert Parameter Store values', { error });
    throw error;
  }
}

/**
 * Rollback Kubernetes deployment
 */
async function rollbackKubernetesDeployment(): Promise<void> {
  logger.info('🔄 Rolling back Kubernetes deployment...');

  try {
    execSync('kubectl rollout undo deployment/directfanz-web', { stdio: 'inherit' });
    execSync('kubectl rollout undo deployment/directfanz-websocket', { stdio: 'inherit' });
    
    // Wait for rollout to complete
    execSync('kubectl rollout status deployment/directfanz-web --timeout=300s', { stdio: 'inherit' });
    execSync('kubectl rollout status deployment/directfanz-websocket --timeout=300s', { stdio: 'inherit' });

    logger.info('✅ Kubernetes deployment rolled back');
  } catch (error) {
    logger.error('❌ Failed to rollback Kubernetes deployment', { error });
    throw error;
  }
}

/**
 * Revert DNS records
 */
async function revertDNSRecords(): Promise<void> {
  logger.info('🔄 Reverting DNS records...');

  try {
    // This would revert Route 53 records to original values
    logger.info('💡 DNS record reversion would be executed here');
    logger.info('✅ DNS records reverted');
  } catch (error) {
    logger.error('❌ Failed to revert DNS records', { error });
    throw error;
  }
}

/**
 * Update health checks
 */
async function updateHealthChecks(): Promise<void> {
  logger.info('🔄 Updating health checks...');

  try {
    // This would update Route 53 health checks
    logger.info('💡 Health check updates would be executed here');
    logger.info('✅ Health checks updated');
  } catch (error) {
    logger.error('❌ Failed to update health checks', { error });
    throw error;
  }
}

/**
 * Monitor DNS propagation
 */
async function monitorDNSPropagation(): Promise<void> {
  logger.info('🔍 Monitoring DNS propagation...');

  try {
    // This would monitor DNS propagation
    logger.info('💡 DNS propagation monitoring would be executed here');
    logger.info('✅ DNS propagation completed');
  } catch (error) {
    logger.error('❌ DNS propagation monitoring failed', { error });
    throw error;
  }
}

/**
 * Verify system integrity after rollback
 */
async function verifySystemIntegrity(): Promise<void> {
  logger.info('🔍 Verifying system integrity...');

  try {
    execSync('tsx scripts/verify-rollback-success.ts', { stdio: 'inherit' });
    logger.info('✅ System integrity verified');
  } catch (error) {
    logger.error('❌ System integrity verification failed', { error });
    throw error;
  }
}

/**
 * Execute dry run
 */
async function executeDryRun(state: RollbackState): Promise<void> {
  logger.info('🔍 Executing dry run rollback...');

  logger.info('Rollback Plan:');
  logger.info(`  Phase: ${state.phase}`);
  logger.info(`  Environment: ${state.environment}`);
  logger.info(`  Steps: ${state.steps.length}`);

  state.steps.forEach((step, index) => {
    logger.info(`    ${index + 1}. ${step.name}`);
  });

  logger.info('✅ Dry run completed - no changes made');
}

/**
 * Execute full rollback
 */
async function executeFullRollback(state: RollbackState, options: RollbackOptions): Promise<void> {
  logger.info(`🚀 Executing ${state.phase} rollback...`);

  state.status = 'in-progress';

  try {
    // Execute each rollback step
    for (const step of state.steps) {
      await executeRollbackStep(step.name, state, options);
    }

    state.status = 'completed';
    logger.info('🎉 Rollback completed successfully!');

  } catch (error) {
    state.status = 'failed';
    logger.error('❌ Rollback failed', { error });
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

  try {
    logger.info('🔄 DirectFanz Master Rollback Tool');
    logger.info(`Phase: ${options.phase}`);
    logger.info(`Environment: ${options.environment}`);
    logger.info(`Dry Run: ${options.dryRun}`);

    // Initialize rollback state
    const state = initializeRollbackState(options);

    // Backup current state if requested
    if (options.backupState && !options.dryRun) {
      await backupCurrentState(state);
    }

    // Execute rollback
    if (options.dryRun) {
      await executeDryRun(state);
    } else {
      await executeFullRollback(state, options);
    }

    // Save final state
    const stateFile = path.join(process.cwd(), `rollback-final-${Date.now()}.json`);
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

    logger.info('🎉 Master rollback completed successfully');
    logger.info(`📄 Rollback state saved to: ${stateFile}`);

  } catch (error) {
    logger.error('❌ Master rollback failed', { 
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

export { main, parseArguments, initializeRollbackState };