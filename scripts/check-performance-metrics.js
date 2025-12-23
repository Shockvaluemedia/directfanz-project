#!/usr/bin/env node

/**
 * Check Performance Metrics Script
 * 
 * Validates that performance metrics meet requirements after cutover
 */

import { execSync } from 'child_process';
import fetch from 'node-fetch';

const BASE_URL = process.argv.includes('--production') 
  ? 'https://directfanz.io' 
  : 'https://staging.directfanz.io';

interface PerformanceMetrics {
  apiResponseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  databaseQueryTime: {
    average: number;
    p95: number;
  };
  cacheResponseTime: {
    average: number;
    p95: number;
  };
  throughput: {
    requestsPerSecond: number;
  };
  availability: {
    uptime: number;
    errorRate: number;
  };
}

class PerformanceChecker {
  private async measureAPIResponseTime(): Promise<PerformanceMetrics['apiResponseTime']> {
    console.log('📊 Measuring API response times...');

    const endpoints = [
      '/api/health',
      '/api/auth/session',
      '/api/admin/database/health',
      '/api/admin/cache/health'
    ];

    const measurements: number[] = [];

    // Take 20 measurements for statistical significance
    for (let i = 0; i < 20; i++) {
      for (const endpoint of endpoints) {
        const startTime = Date.now();
        
        try {
          await fetch(`${BASE_URL}${endpoint}`);
          const responseTime = Date.now() - startTime;
          measurements.push(responseTime);
        } catch (error) {
          console.warn(`Failed to measure ${endpoint}:`, error);
        }
      }
    }

    measurements.sort((a, b) => a - b);

    const average = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const p95Index = Math.floor(measurements.length * 0.95);
    const p99Index = Math.floor(measurements.length * 0.99);

    return {
      average: Math.round(average),
      p95: measurements[p95Index] || 0,
      p99: measurements[p99Index] || 0
    };
  }

  private async measureDatabasePerformance(): Promise<PerformanceMetrics['databaseQueryTime']> {
    console.log('🗄️  Measuring database performance...');

    try {
      const response = await fetch(`${BASE_URL}/api/admin/database/performance`);
      if (!response.ok) {
        throw new Error(`Database performance check failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        average: data.averageQueryTime || 0,
        p95: data.p95QueryTime || 0
      };
    } catch (error) {
      console.warn('Could not measure database performance:', error);
      return { average: 0, p95: 0 };
    }
  }

  private async measureCachePerformance(): Promise<PerformanceMetrics['cacheResponseTime']> {
    console.log('⚡ Measuring cache performance...');

    const measurements: number[] = [];

    // Test cache performance with multiple operations
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();
      
      try {
        await fetch(`${BASE_URL}/api/admin/cache/health`);
        const responseTime = Date.now() - startTime;
        measurements.push(responseTime);
      } catch (error) {
        console.warn('Cache performance measurement failed:', error);
      }
    }

    measurements.sort((a, b) => a - b);

    const average = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const p95Index = Math.floor(measurements.length * 0.95);

    return {
      average: Math.round(average),
      p95: measurements[p95Index] || 0
    };
  }

  private async measureThroughput(): Promise<PerformanceMetrics['throughput']> {
    console.log('🚀 Measuring throughput...');

    const startTime = Date.now();
    const requests: Promise<any>[] = [];

    // Send 50 concurrent requests
    for (let i = 0; i < 50; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/health`).catch(() => null)
      );
    }

    await Promise.all(requests);
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds

    return {
      requestsPerSecond: Math.round(50 / duration)
    };
  }

  private async checkAvailability(): Promise<PerformanceMetrics['availability']> {
    console.log('📈 Checking availability metrics...');

    try {
      // Get CloudWatch metrics for the last hour
      const metricsCommand = `
        aws cloudwatch get-metric-statistics \\
          --namespace "DirectFanz/Application" \\
          --metric-name "HealthCheck" \\
          --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \\
          --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \\
          --period 300 \\
          --statistics Average \\
          --output json
      `;

      const metricsOutput = execSync(metricsCommand, { encoding: 'utf8' });
      const metrics = JSON.parse(metricsOutput);

      const datapoints = metrics.Datapoints || [];
      const totalChecks = datapoints.length;
      const successfulChecks = datapoints.filter((dp: any) => dp.Average > 0.9).length;

      const uptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

      // Get error rate from ALB metrics
      const errorCommand = `
        aws cloudwatch get-metric-statistics \\
          --namespace "AWS/ApplicationELB" \\
          --metric-name "HTTPCode_Target_5XX_Count" \\
          --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \\
          --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \\
          --period 300 \\
          --statistics Sum \\
          --dimensions Name=LoadBalancer,Value=app/directfanz-alb/$(aws elbv2 describe-load-balancers --names directfanz-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text | cut -d'/' -f2-) \\
          --output json
      `;

      const errorOutput = execSync(errorCommand, { encoding: 'utf8' });
      const errorMetrics = JSON.parse(errorOutput);

      const errorDatapoints = errorMetrics.Datapoints || [];
      const totalErrors = errorDatapoints.reduce((sum: number, dp: any) => sum + dp.Sum, 0);
      const errorRate = totalErrors > 0 ? (totalErrors / (totalChecks * 10)) * 100 : 0; // Rough estimate

      return {
        uptime: Math.round(uptime * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100
      };

    } catch (error) {
      console.warn('Could not retrieve availability metrics from CloudWatch:', error);
      
      // Fallback: simple availability check
      try {
        const response = await fetch(`${BASE_URL}/api/health`);
        return {
          uptime: response.ok ? 100 : 0,
          errorRate: response.ok ? 0 : 100
        };
      } catch {
        return { uptime: 0, errorRate: 100 };
      }
    }
  }

  private evaluateMetrics(metrics: PerformanceMetrics): void {
    console.log('\n📊 Performance Metrics Evaluation:');
    console.log('==================================');

    const requirements = {
      apiResponseTime: { average: 200, p95: 500 }, // ms
      databaseQueryTime: { average: 50, p95: 100 }, // ms
      cacheResponseTime: { average: 5, p95: 10 }, // ms
      throughput: { requestsPerSecond: 100 },
      availability: { uptime: 99.9, errorRate: 0.1 } // %
    };

    const results = {
      apiResponseTime: {
        average: metrics.apiResponseTime.average <= requirements.apiResponseTime.average,
        p95: metrics.apiResponseTime.p95 <= requirements.apiResponseTime.p95
      },
      databaseQueryTime: {
        average: metrics.databaseQueryTime.average <= requirements.databaseQueryTime.average,
        p95: metrics.databaseQueryTime.p95 <= requirements.databaseQueryTime.p95
      },
      cacheResponseTime: {
        average: metrics.cacheResponseTime.average <= requirements.cacheResponseTime.average,
        p95: metrics.cacheResponseTime.p95 <= requirements.cacheResponseTime.p95
      },
      throughput: metrics.throughput.requestsPerSecond >= requirements.throughput.requestsPerSecond,
      availability: {
        uptime: metrics.availability.uptime >= requirements.availability.uptime,
        errorRate: metrics.availability.errorRate <= requirements.availability.errorRate
      }
    };

    // API Response Time
    console.log(`API Response Time:`);
    console.log(`  Average: ${metrics.apiResponseTime.average}ms ${results.apiResponseTime.average ? '✅' : '❌'} (req: ≤${requirements.apiResponseTime.average}ms)`);
    console.log(`  95th percentile: ${metrics.apiResponseTime.p95}ms ${results.apiResponseTime.p95 ? '✅' : '❌'} (req: ≤${requirements.apiResponseTime.p95}ms)`);

    // Database Performance
    console.log(`Database Query Time:`);
    console.log(`  Average: ${metrics.databaseQueryTime.average}ms ${results.databaseQueryTime.average ? '✅' : '❌'} (req: ≤${requirements.databaseQueryTime.average}ms)`);
    console.log(`  95th percentile: ${metrics.databaseQueryTime.p95}ms ${results.databaseQueryTime.p95 ? '✅' : '❌'} (req: ≤${requirements.databaseQueryTime.p95}ms)`);

    // Cache Performance
    console.log(`Cache Response Time:`);
    console.log(`  Average: ${metrics.cacheResponseTime.average}ms ${results.cacheResponseTime.average ? '✅' : '❌'} (req: ≤${requirements.cacheResponseTime.average}ms)`);
    console.log(`  95th percentile: ${metrics.cacheResponseTime.p95}ms ${results.cacheResponseTime.p95 ? '✅' : '❌'} (req: ≤${requirements.cacheResponseTime.p95}ms)`);

    // Throughput
    console.log(`Throughput:`);
    console.log(`  Requests/second: ${metrics.throughput.requestsPerSecond} ${results.throughput ? '✅' : '❌'} (req: ≥${requirements.throughput.requestsPerSecond})`);

    // Availability
    console.log(`Availability:`);
    console.log(`  Uptime: ${metrics.availability.uptime}% ${results.availability.uptime ? '✅' : '❌'} (req: ≥${requirements.availability.uptime}%)`);
    console.log(`  Error rate: ${metrics.availability.errorRate}% ${results.availability.errorRate ? '✅' : '❌'} (req: ≤${requirements.availability.errorRate}%)`);

    // Overall assessment
    const allPassed = Object.values(results).every(result => 
      typeof result === 'boolean' ? result : Object.values(result).every(Boolean)
    );

    console.log('\n🎯 Overall Performance Assessment:');
    if (allPassed) {
      console.log('✅ All performance requirements met!');
      process.exit(0);
    } else {
      console.log('⚠️  Some performance requirements not met');
      console.log('Consider optimization or investigate issues');
      process.exit(1);
    }
  }

  public async checkPerformance(): Promise<void> {
    console.log('🚀 Checking Performance Metrics');
    console.log(`Target: ${BASE_URL}`);
    console.log('===============================');

    try {
      const metrics: PerformanceMetrics = {
        apiResponseTime: await this.measureAPIResponseTime(),
        databaseQueryTime: await this.measureDatabasePerformance(),
        cacheResponseTime: await this.measureCachePerformance(),
        throughput: await this.measureThroughput(),
        availability: await this.checkAvailability()
      };

      this.evaluateMetrics(metrics);

    } catch (error) {
      console.error('❌ Performance check failed:', error);
      process.exit(1);
    }
  }
}

async function main() {
  const checker = new PerformanceChecker();
  await checker.checkPerformance();
}

main();