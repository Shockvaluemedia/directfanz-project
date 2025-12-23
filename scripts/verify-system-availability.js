#!/usr/bin/env node

/**
 * Verify System Availability Script
 * 
 * Monitors and verifies that the system meets 99.9% availability target
 * after production cutover.
 */

import { execSync } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs';

const BASE_URL = process.argv.includes('--staging') 
  ? 'https://staging.directfanz.io' 
  : 'https://directfanz.io';

interface AvailabilityMetrics {
  uptime: number;
  downtime: number;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  errorRate: number;
  slaCompliance: boolean;
}

interface HealthCheckResult {
  timestamp: string;
  success: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
}

class SystemAvailabilityVerifier {
  private healthChecks: HealthCheckResult[] = [];
  private monitoringDuration: number;
  private checkInterval: number;
  private slaTarget: number = 99.9; // 99.9% availability target

  constructor(durationMinutes: number = 60, intervalSeconds: number = 30) {
    this.monitoringDuration = durationMinutes * 60 * 1000; // Convert to milliseconds
    this.checkInterval = intervalSeconds * 1000; // Convert to milliseconds
  }

  private async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        timeout: 10000 // 10 second timeout
      });

      const responseTime = Date.now() - startTime;
      const success = response.ok;

      return {
        timestamp,
        success,
        responseTime,
        statusCode: response.status
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        timestamp,
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  private async performComprehensiveHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    try {
      // Check multiple endpoints for comprehensive health
      const endpoints = [
        '/api/health',
        '/api/auth/session',
        '/api/admin/database/health',
        '/api/admin/cache/health'
      ];

      const results = await Promise.all(
        endpoints.map(async (endpoint) => {
          try {
            const response = await fetch(`${BASE_URL}${endpoint}`, { timeout: 5000 });
            return response.ok;
          } catch {
            return false;
          }
        })
      );

      const responseTime = Date.now() - startTime;
      const success = results.every(result => result); // All endpoints must be healthy

      return {
        timestamp,
        success,
        responseTime,
        statusCode: success ? 200 : 500
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        timestamp,
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  private calculateMetrics(): AvailabilityMetrics {
    const totalChecks = this.healthChecks.length;
    const successfulChecks = this.healthChecks.filter(check => check.success).length;
    const failedChecks = totalChecks - successfulChecks;

    const uptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
    const downtime = 100 - uptime;
    const errorRate = totalChecks > 0 ? (failedChecks / totalChecks) * 100 : 0;

    const responseTimes = this.healthChecks
      .filter(check => check.success)
      .map(check => check.responseTime);
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    const slaCompliance = uptime >= this.slaTarget;

    return {
      uptime: Math.round(uptime * 100) / 100,
      downtime: Math.round(downtime * 100) / 100,
      totalChecks,
      successfulChecks,
      failedChecks,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      slaCompliance
    };
  }

  private async getCloudWatchMetrics(): Promise<any> {
    try {
      console.log('📊 Retrieving CloudWatch availability metrics...');

      // Get ALB target health metrics
      const albMetricsCommand = `
        aws cloudwatch get-metric-statistics \\
          --namespace "AWS/ApplicationELB" \\
          --metric-name "HealthyHostCount" \\
          --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \\
          --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \\
          --period 300 \\
          --statistics Average \\
          --dimensions Name=LoadBalancer,Value=app/directfanz-alb/$(aws elbv2 describe-load-balancers --names directfanz-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text | cut -d'/' -f2-) \\
          --output json
      `;

      const albMetrics = JSON.parse(execSync(albMetricsCommand, { encoding: 'utf8' }));

      // Get ECS service health metrics
      const ecsMetricsCommand = `
        aws cloudwatch get-metric-statistics \\
          --namespace "AWS/ECS" \\
          --metric-name "RunningTaskCount" \\
          --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \\
          --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \\
          --period 300 \\
          --statistics Average \\
          --dimensions Name=ServiceName,Value=web-service Name=ClusterName,Value=directfanz-cluster \\
          --output json
      `;

      const ecsMetrics = JSON.parse(execSync(ecsMetricsCommand, { encoding: 'utf8' }));

      return {
        alb: albMetrics.Datapoints || [],
        ecs: ecsMetrics.Datapoints || []
      };

    } catch (error) {
      console.warn('⚠️  Could not retrieve CloudWatch metrics:', error);
      return { alb: [], ecs: [] };
    }
  }

  private logMetrics(metrics: AvailabilityMetrics): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      metrics,
      healthChecks: this.healthChecks,
      slaTarget: this.slaTarget,
      monitoringDuration: this.monitoringDuration / 1000 / 60 // minutes
    };

    // Save to file
    const logFile = `logs/availability-report-${Date.now()}.json`;
    fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));
    console.log(`📝 Availability report saved to ${logFile}`);

    // Send to CloudWatch if available
    try {
      const logGroup = '/aws/directfanz/availability';
      const logStream = `availability-${Date.now()}`;
      
      execSync(`aws logs create-log-stream --log-group-name "${logGroup}" --log-stream-name "${logStream}" 2>/dev/null || true`, {
        stdio: 'pipe'
      });

      execSync(`aws logs put-log-events --log-group-name "${logGroup}" --log-stream-name "${logStream}" --log-events timestamp=$(date +%s000),message='${JSON.stringify(logEntry)}' 2>/dev/null || true`, {
        stdio: 'pipe'
      });

    } catch (error) {
      // Ignore CloudWatch logging errors
    }
  }

  public async monitorAvailability(): Promise<AvailabilityMetrics> {
    console.log('🔍 Starting system availability monitoring...');
    console.log(`Target: ${BASE_URL}`);
    console.log(`Duration: ${this.monitoringDuration / 1000 / 60} minutes`);
    console.log(`Check interval: ${this.checkInterval / 1000} seconds`);
    console.log(`SLA target: ${this.slaTarget}%`);
    console.log('=====================================');

    const startTime = Date.now();
    const endTime = startTime + this.monitoringDuration;

    // Perform initial comprehensive health check
    console.log('🏥 Performing initial comprehensive health check...');
    const initialCheck = await this.performComprehensiveHealthCheck();
    this.healthChecks.push(initialCheck);

    if (!initialCheck.success) {
      console.log('❌ Initial health check failed - system may not be ready');
      console.log(`   Error: ${initialCheck.error || 'Unknown error'}`);
    } else {
      console.log('✅ Initial health check passed');
    }

    // Start continuous monitoring
    let checkCount = 1;
    while (Date.now() < endTime) {
      await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      
      const check = await this.performHealthCheck();
      this.healthChecks.push(check);
      checkCount++;

      const currentMetrics = this.calculateMetrics();
      const status = check.success ? '✅' : '❌';
      const progress = Math.round(((Date.now() - startTime) / this.monitoringDuration) * 100);
      
      console.log(`${status} Check ${checkCount} (${progress}%) - Uptime: ${currentMetrics.uptime}% - Response: ${check.responseTime}ms`);

      // Early exit if we have enough data and system is stable
      if (checkCount >= 10 && currentMetrics.uptime >= this.slaTarget) {
        const recentChecks = this.healthChecks.slice(-5);
        const recentSuccess = recentChecks.every(c => c.success);
        
        if (recentSuccess) {
          console.log('🎉 System is stable and meeting SLA - early completion');
          break;
        }
      }
    }

    const finalMetrics = this.calculateMetrics();
    
    // Get additional CloudWatch metrics
    const cloudWatchMetrics = await this.getCloudWatchMetrics();
    
    this.logMetrics(finalMetrics);
    this.printReport(finalMetrics, cloudWatchMetrics);

    return finalMetrics;
  }

  private printReport(metrics: AvailabilityMetrics, cloudWatchMetrics: any): void {
    console.log('\n📊 System Availability Report');
    console.log('============================');
    
    console.log(`🎯 SLA Target: ${this.slaTarget}%`);
    console.log(`📈 Actual Uptime: ${metrics.uptime}%`);
    console.log(`📉 Downtime: ${metrics.downtime}%`);
    console.log(`✅ Successful Checks: ${metrics.successfulChecks}/${metrics.totalChecks}`);
    console.log(`❌ Failed Checks: ${metrics.failedChecks}`);
    console.log(`⚡ Average Response Time: ${metrics.averageResponseTime}ms`);
    console.log(`🚨 Error Rate: ${metrics.errorRate}%`);
    
    console.log('\n🏥 Health Check Details:');
    console.log('------------------------');
    
    // Show recent failed checks
    const failedChecks = this.healthChecks.filter(check => !check.success);
    if (failedChecks.length > 0) {
      console.log(`Recent failures (${failedChecks.length} total):`);
      failedChecks.slice(-5).forEach(check => {
        console.log(`  ❌ ${check.timestamp} - ${check.error || `HTTP ${check.statusCode}`}`);
      });
    } else {
      console.log('✅ No failed health checks detected');
    }

    // CloudWatch metrics summary
    if (cloudWatchMetrics.alb.length > 0 || cloudWatchMetrics.ecs.length > 0) {
      console.log('\n☁️  CloudWatch Metrics Summary:');
      console.log('-------------------------------');
      
      if (cloudWatchMetrics.alb.length > 0) {
        const avgHealthyHosts = cloudWatchMetrics.alb.reduce((sum: number, dp: any) => sum + dp.Average, 0) / cloudWatchMetrics.alb.length;
        console.log(`ALB Healthy Hosts (avg): ${Math.round(avgHealthyHosts * 100) / 100}`);
      }
      
      if (cloudWatchMetrics.ecs.length > 0) {
        const avgRunningTasks = cloudWatchMetrics.ecs.reduce((sum: number, dp: any) => sum + dp.Average, 0) / cloudWatchMetrics.ecs.length;
        console.log(`ECS Running Tasks (avg): ${Math.round(avgRunningTasks * 100) / 100}`);
      }
    }

    console.log('\n🎯 SLA Compliance Assessment:');
    console.log('-----------------------------');
    
    if (metrics.slaCompliance) {
      console.log('✅ SLA COMPLIANCE: PASSED');
      console.log(`   System availability (${metrics.uptime}%) meets the 99.9% target`);
      console.log('   System is ready for production traffic');
    } else {
      console.log('❌ SLA COMPLIANCE: FAILED');
      console.log(`   System availability (${metrics.uptime}%) below 99.9% target`);
      console.log('   Investigation and optimization required');
      
      // Provide recommendations
      console.log('\n💡 Recommendations:');
      if (metrics.errorRate > 1) {
        console.log('   • High error rate detected - check application logs');
      }
      if (metrics.averageResponseTime > 1000) {
        console.log('   • High response times - check performance bottlenecks');
      }
      if (metrics.failedChecks > metrics.totalChecks * 0.05) {
        console.log('   • Frequent health check failures - check infrastructure stability');
      }
    }
  }

  public async quickAvailabilityCheck(): Promise<boolean> {
    console.log('⚡ Performing quick availability check...');
    
    const checks = [];
    for (let i = 0; i < 5; i++) {
      const check = await this.performHealthCheck();
      checks.push(check);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second intervals
    }

    const successRate = checks.filter(c => c.success).length / checks.length * 100;
    const avgResponseTime = checks
      .filter(c => c.success)
      .reduce((sum, c) => sum + c.responseTime, 0) / checks.filter(c => c.success).length;

    console.log(`Quick check results: ${successRate}% success rate, ${Math.round(avgResponseTime)}ms avg response`);
    
    return successRate >= 80; // 80% minimum for quick check
  }
}

async function main() {
  const isQuickCheck = process.argv.includes('--quick');
  const durationMinutes = parseInt(process.argv.find(arg => arg.startsWith('--duration='))?.split('=')[1] || '60');

  // Create logs directory if it doesn't exist
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
  }

  const verifier = new SystemAvailabilityVerifier(durationMinutes);

  try {
    if (isQuickCheck) {
      const isAvailable = await verifier.quickAvailabilityCheck();
      process.exit(isAvailable ? 0 : 1);
    } else {
      const metrics = await verifier.monitorAvailability();
      process.exit(metrics.slaCompliance ? 0 : 1);
    }
  } catch (error) {
    console.error('❌ Availability verification failed:', error);
    process.exit(1);
  }
}

main();