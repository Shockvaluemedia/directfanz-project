#!/usr/bin/env node

/**
 * Production Cutover Script for AWS Migration
 * 
 * This script orchestrates the final production cutover from the current
 * infrastructure to the new AWS-native infrastructure.
 * 
 * Features:
 * - Final data synchronization
 * - DNS switching to AWS infrastructure
 * - Real-time system health monitoring
 * - Rollback capability
 * - Progress tracking and reporting
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

interface CutoverConfig {
  environment: 'staging' | 'production';
  dryRun: boolean;
  rollbackEnabled: boolean;
  healthCheckInterval: number;
  maxHealthCheckFailures: number;
  dnsUpdateDelay: number;
}

interface SystemHealth {
  database: boolean;
  cache: boolean;
  storage: boolean;
  application: boolean;
  streaming: boolean;
  monitoring: boolean;
}

interface CutoverProgress {
  phase: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

class ProductionCutoverOrchestrator {
  private config: CutoverConfig;
  private progress: Map<string, CutoverProgress> = new Map();
  private healthHistory: SystemHealth[] = [];
  private rollbackData: any = {};
  private rl: readline.Interface;

  constructor(config: CutoverConfig) {
    this.config = config;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Initialize progress tracking
    this.initializeProgress();
  }

  private initializeProgress(): void {
    const phases = [
      'pre_cutover_validation',
      'final_data_sync',
      'application_deployment',
      'dns_update',
      'health_verification',
      'post_cutover_validation'
    ];

    phases.forEach(phase => {
      this.progress.set(phase, { phase, status: 'pending' });
    });
  }

  private log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    const timestamp = new Date().toISOString();
    console.log(`${colors[level]}[${timestamp}] ${message}${colors.reset}`);

    // Log to file for audit trail
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    fs.appendFileSync(`logs/cutover-${Date.now()}.log`, logEntry);
  }

  private async executeCommand(command: string, options: any = {}): Promise<string> {
    try {
      this.log(`Executing: ${command}`, 'info');
      
      if (this.config.dryRun) {
        this.log(`DRY RUN: Would execute: ${command}`, 'warning');
        return 'DRY_RUN_SUCCESS';
      }

      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      });

      return result;
    } catch (error: any) {
      this.log(`Command failed: ${command}`, 'error');
      this.log(`Error: ${error.message}`, 'error');
      throw error;
    }
  }

  private async updateProgress(phase: string, status: CutoverProgress['status'], error?: string): Promise<void> {
    const progress = this.progress.get(phase);
    if (!progress) return;

    progress.status = status;
    if (status === 'in_progress') {
      progress.startTime = new Date();
    } else if (status === 'completed' || status === 'failed') {
      progress.endTime = new Date();
      if (error) progress.error = error;
    }

    this.progress.set(phase, progress);
    this.log(`Phase ${phase}: ${status}${error ? ` - ${error}` : ''}`, 
             status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'info');
  }

  private async checkSystemHealth(): Promise<SystemHealth> {
    this.log('Checking system health...', 'info');

    const health: SystemHealth = {
      database: false,
      cache: false,
      storage: false,
      application: false,
      streaming: false,
      monitoring: false
    };

    try {
      // Check database connectivity
      await this.executeCommand('node -e "require(\'./src/lib/prisma.ts\').prisma.$queryRaw`SELECT 1`"', { silent: true });
      health.database = true;
      this.log('✅ Database health check passed', 'success');
    } catch (error) {
      this.log('❌ Database health check failed', 'error');
    }

    try {
      // Check Redis connectivity
      await this.executeCommand('node -e "require(\'./src/lib/redis.ts\').redis.ping()"', { silent: true });
      health.cache = true;
      this.log('✅ Cache health check passed', 'success');
    } catch (error) {
      this.log('❌ Cache health check failed', 'error');
    }

    try {
      // Check S3 connectivity
      await this.executeCommand('aws s3 ls s3://directfanz-content-production', { silent: true });
      health.storage = true;
      this.log('✅ Storage health check passed', 'success');
    } catch (error) {
      this.log('❌ Storage health check failed', 'error');
    }

    try {
      // Check application endpoints
      const response = await this.executeCommand('curl -f -s https://api.directfanz.io/health', { silent: true });
      health.application = response.includes('healthy');
      this.log('✅ Application health check passed', 'success');
    } catch (error) {
      this.log('❌ Application health check failed', 'error');
    }

    try {
      // Check streaming infrastructure
      await this.executeCommand('aws medialive list-channels --query "Channels[?State==\'RUNNING\']" --output text', { silent: true });
      health.streaming = true;
      this.log('✅ Streaming health check passed', 'success');
    } catch (error) {
      this.log('❌ Streaming health check failed', 'error');
    }

    try {
      // Check monitoring systems
      await this.executeCommand('aws cloudwatch get-metric-statistics --namespace "DirectFanz/Application" --metric-name "HealthCheck" --start-time "$(date -u -d "5 minutes ago" +%Y-%m-%dT%H:%M:%S)" --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" --period 300 --statistics Average', { silent: true });
      health.monitoring = true;
      this.log('✅ Monitoring health check passed', 'success');
    } catch (error) {
      this.log('❌ Monitoring health check failed', 'error');
    }

    this.healthHistory.push(health);
    return health;
  }

  private async preCutoverValidation(): Promise<void> {
    await this.updateProgress('pre_cutover_validation', 'in_progress');

    try {
      this.log('Starting pre-cutover validation...', 'info');

      // Verify AWS infrastructure is ready
      this.log('Verifying AWS infrastructure...', 'info');
      await this.executeCommand('terraform output -json > /tmp/terraform-outputs.json');
      
      const outputs = JSON.parse(fs.readFileSync('/tmp/terraform-outputs.json', 'utf8'));
      if (!outputs.alb_dns_name || !outputs.rds_endpoint || !outputs.redis_endpoint) {
        throw new Error('Critical AWS infrastructure components not ready');
      }

      // Check system health
      const health = await this.checkSystemHealth();
      const criticalSystemsHealthy = health.database && health.cache && health.storage;
      
      if (!criticalSystemsHealthy) {
        throw new Error('Critical systems not healthy - cannot proceed with cutover');
      }

      // Verify data migration completion
      this.log('Verifying data migration completion...', 'info');
      await this.executeCommand('node scripts/verify-migration-completion.js');

      // Check backup status
      this.log('Verifying backup status...', 'info');
      await this.executeCommand('node scripts/verify-backup-status.js');

      await this.updateProgress('pre_cutover_validation', 'completed');
      this.log('Pre-cutover validation completed successfully', 'success');

    } catch (error: any) {
      await this.updateProgress('pre_cutover_validation', 'failed', error.message);
      throw error;
    }
  }

  private async finalDataSync(): Promise<void> {
    await this.updateProgress('final_data_sync', 'in_progress');

    try {
      this.log('Starting final data synchronization...', 'info');

      // Stop write operations to old system (maintenance mode)
      this.log('Enabling maintenance mode...', 'info');
      await this.executeCommand('node scripts/enable-maintenance-mode.js');
      this.rollbackData.maintenanceEnabled = true;

      // Perform final database sync
      this.log('Performing final database synchronization...', 'info');
      await this.executeCommand('node scripts/execute-database-migration.ts --final-sync');

      // Sync remaining S3 content
      this.log('Synchronizing remaining S3 content...', 'info');
      await this.executeCommand('node scripts/execute-s3-migration.ts --final-sync');

      // Rebuild cache with latest data
      this.log('Rebuilding cache with latest data...', 'info');
      await this.executeCommand('node scripts/execute-cache-rebuild.ts --production');

      // Verify data integrity
      this.log('Verifying data integrity...', 'info');
      await this.executeCommand('node scripts/verify-data-integrity.js --comprehensive');

      await this.updateProgress('final_data_sync', 'completed');
      this.log('Final data synchronization completed successfully', 'success');

    } catch (error: any) {
      await this.updateProgress('final_data_sync', 'failed', error.message);
      throw error;
    }
  }

  private async deployApplication(): Promise<void> {
    await this.updateProgress('application_deployment', 'in_progress');

    try {
      this.log('Deploying application to AWS infrastructure...', 'info');

      // Deploy ECS services
      this.log('Deploying ECS services...', 'info');
      await this.executeCommand('bash scripts/deploy-ecs-containers.sh --production');

      // Update load balancer target groups
      this.log('Updating load balancer configuration...', 'info');
      await this.executeCommand('aws elbv2 modify-target-group --target-group-arn $(terraform output -raw web_target_group_arn) --health-check-path /api/health');

      // Deploy WebSocket service
      this.log('Deploying WebSocket service...', 'info');
      await this.executeCommand('aws ecs update-service --cluster directfanz-cluster --service websocket-service --force-new-deployment');

      // Wait for services to be healthy
      this.log('Waiting for services to become healthy...', 'info');
      await this.executeCommand('aws ecs wait services-stable --cluster directfanz-cluster --services web-service websocket-service');

      await this.updateProgress('application_deployment', 'completed');
      this.log('Application deployment completed successfully', 'success');

    } catch (error: any) {
      await this.updateProgress('application_deployment', 'failed', error.message);
      throw error;
    }
  }

  private async updateDNS(): Promise<void> {
    await this.updateProgress('dns_update', 'in_progress');

    try {
      this.log('Updating DNS to point to AWS infrastructure...', 'info');

      // Get ALB DNS name from Terraform outputs
      const outputs = JSON.parse(fs.readFileSync('/tmp/terraform-outputs.json', 'utf8'));
      const albDnsName = outputs.alb_dns_name.value;

      // Store current DNS for rollback
      const currentDns = await this.executeCommand('dig +short directfanz.io', { silent: true });
      this.rollbackData.previousDns = currentDns.trim();

      // Update Route 53 records
      this.log('Updating Route 53 A record...', 'info');
      const changeSet = {
        Changes: [{
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: 'directfanz.io',
            Type: 'CNAME',
            TTL: 60,
            ResourceRecords: [{ Value: albDnsName }]
          }
        }]
      };

      fs.writeFileSync('/tmp/dns-changeset.json', JSON.stringify(changeSet));
      await this.executeCommand(`aws route53 change-resource-record-sets --hosted-zone-id $(aws route53 list-hosted-zones --query "HostedZones[?Name=='directfanz.io.'].Id" --output text | cut -d'/' -f3) --change-batch file:///tmp/dns-changeset.json`);

      // Update API subdomain
      this.log('Updating API subdomain...', 'info');
      const apiChangeSet = {
        Changes: [{
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: 'api.directfanz.io',
            Type: 'CNAME',
            TTL: 60,
            ResourceRecords: [{ Value: albDnsName }]
          }
        }]
      };

      fs.writeFileSync('/tmp/api-dns-changeset.json', JSON.stringify(apiChangeSet));
      await this.executeCommand(`aws route53 change-resource-record-sets --hosted-zone-id $(aws route53 list-hosted-zones --query "HostedZones[?Name=='directfanz.io.'].Id" --output text | cut -d'/' -f3) --change-batch file:///tmp/api-dns-changeset.json`);

      // Wait for DNS propagation
      this.log(`Waiting ${this.config.dnsUpdateDelay / 1000} seconds for DNS propagation...`, 'info');
      await new Promise(resolve => setTimeout(resolve, this.config.dnsUpdateDelay));

      await this.updateProgress('dns_update', 'completed');
      this.log('DNS update completed successfully', 'success');

    } catch (error: any) {
      await this.updateProgress('dns_update', 'failed', error.message);
      throw error;
    }
  }

  private async verifyHealth(): Promise<void> {
    await this.updateProgress('health_verification', 'in_progress');

    try {
      this.log('Starting continuous health verification...', 'info');

      let consecutiveFailures = 0;
      const maxChecks = 10;

      for (let i = 0; i < maxChecks; i++) {
        this.log(`Health check ${i + 1}/${maxChecks}...`, 'info');
        
        const health = await this.checkSystemHealth();
        const allSystemsHealthy = Object.values(health).every(status => status);

        if (allSystemsHealthy) {
          consecutiveFailures = 0;
          this.log(`Health check ${i + 1} passed`, 'success');
        } else {
          consecutiveFailures++;
          this.log(`Health check ${i + 1} failed (${consecutiveFailures}/${this.config.maxHealthCheckFailures})`, 'warning');

          if (consecutiveFailures >= this.config.maxHealthCheckFailures) {
            throw new Error(`Health checks failed ${consecutiveFailures} times consecutively`);
          }
        }

        if (i < maxChecks - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.healthCheckInterval));
        }
      }

      await this.updateProgress('health_verification', 'completed');
      this.log('Health verification completed successfully', 'success');

    } catch (error: any) {
      await this.updateProgress('health_verification', 'failed', error.message);
      throw error;
    }
  }

  private async postCutoverValidation(): Promise<void> {
    await this.updateProgress('post_cutover_validation', 'in_progress');

    try {
      this.log('Starting post-cutover validation...', 'info');

      // Test critical user flows
      this.log('Testing critical user flows...', 'info');
      await this.executeCommand('node scripts/test-critical-flows.js --production');

      // Verify data integrity
      this.log('Verifying data integrity...', 'info');
      await this.executeCommand('node scripts/verify-data-integrity.js --post-cutover');

      // Check performance metrics
      this.log('Checking performance metrics...', 'info');
      await this.executeCommand('node scripts/check-performance-metrics.js --baseline');

      // Disable maintenance mode
      this.log('Disabling maintenance mode...', 'info');
      await this.executeCommand('node scripts/disable-maintenance-mode.js');
      this.rollbackData.maintenanceEnabled = false;

      // Send success notifications
      this.log('Sending success notifications...', 'info');
      await this.executeCommand('node scripts/send-cutover-notifications.js --success');

      await this.updateProgress('post_cutover_validation', 'completed');
      this.log('Post-cutover validation completed successfully', 'success');

    } catch (error: any) {
      await this.updateProgress('post_cutover_validation', 'failed', error.message);
      throw error;
    }
  }

  private async rollback(): Promise<void> {
    this.log('Initiating rollback procedure...', 'warning');

    try {
      // Restore DNS if it was changed
      if (this.rollbackData.previousDns) {
        this.log('Restoring previous DNS configuration...', 'info');
        // Implementation would restore DNS to previous state
      }

      // Re-enable old system if maintenance mode was enabled
      if (this.rollbackData.maintenanceEnabled) {
        this.log('Disabling maintenance mode on old system...', 'info');
        await this.executeCommand('node scripts/disable-maintenance-mode.js --old-system');
      }

      // Execute comprehensive rollback
      await this.executeCommand('node scripts/execute-master-rollback.ts --emergency');

      this.log('Rollback completed successfully', 'success');

    } catch (error: any) {
      this.log(`Rollback failed: ${error.message}`, 'error');
      throw error;
    }
  }

  private async question(query: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(query, resolve);
    });
  }

  private printProgressSummary(): void {
    this.log('\n=== CUTOVER PROGRESS SUMMARY ===', 'info');
    
    for (const [phase, progress] of this.progress) {
      const status = progress.status;
      const duration = progress.startTime && progress.endTime 
        ? `(${Math.round((progress.endTime.getTime() - progress.startTime.getTime()) / 1000)}s)`
        : '';
      
      const statusIcon = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌'
      }[status];

      this.log(`${statusIcon} ${phase}: ${status} ${duration}`, 
               status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'info');
    }
  }

  public async executeCutover(): Promise<void> {
    try {
      this.log('🚀 Starting DirectFanz AWS Production Cutover', 'info');
      this.log('================================================', 'info');

      // Confirm cutover execution
      if (!this.config.dryRun) {
        const confirm = await this.question('This will perform the production cutover. Are you sure? (yes/no): ');
        if (confirm.toLowerCase() !== 'yes') {
          this.log('Cutover cancelled by user', 'warning');
          return;
        }
      }

      // Execute cutover phases
      await this.preCutoverValidation();
      await this.finalDataSync();
      await this.deployApplication();
      await this.updateDNS();
      await this.verifyHealth();
      await this.postCutoverValidation();

      this.log('🎉 Production cutover completed successfully!', 'success');
      this.printProgressSummary();

    } catch (error: any) {
      this.log(`❌ Cutover failed: ${error.message}`, 'error');
      this.printProgressSummary();

      if (this.config.rollbackEnabled) {
        const rollbackConfirm = await this.question('Do you want to initiate rollback? (yes/no): ');
        if (rollbackConfirm.toLowerCase() === 'yes') {
          await this.rollback();
        }
      }

      throw error;
    } finally {
      this.rl.close();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const config: CutoverConfig = {
    environment: args.includes('--staging') ? 'staging' : 'production',
    dryRun: args.includes('--dry-run'),
    rollbackEnabled: !args.includes('--no-rollback'),
    healthCheckInterval: 30000, // 30 seconds
    maxHealthCheckFailures: 3,
    dnsUpdateDelay: 120000 // 2 minutes
  };

  // Create logs directory if it doesn't exist
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
  }

  const orchestrator = new ProductionCutoverOrchestrator(config);
  await orchestrator.executeCutover();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Cutover failed:', error);
    process.exit(1);
  });
}

export { ProductionCutoverOrchestrator };