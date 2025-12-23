#!/usr/bin/env tsx

/**
 * Rollback Success Verification Script
 * Verifies that rollback procedures completed successfully and system is functional
 * Implements Requirements 11.5
 */

import { logger } from '../src/lib/logger';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

interface VerificationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
  duration: number;
}

interface VerificationSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: VerificationResult[];
  overallStatus: 'pass' | 'fail' | 'warning';
  duration: number;
}

/**
 * Verify database connectivity and functionality
 */
async function verifyDatabase(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 Verifying database connectivity...');
    
    const prisma = new PrismaClient();
    
    // Test basic connectivity
    await prisma.$executeRaw`SELECT 1 as test`;
    
    // Test table access
    const userCount = await prisma.users.count();
    const contentCount = await prisma.content.count();
    
    // Test write operation
    const testRecord = await prisma.users.findFirst();
    if (testRecord) {
      await prisma.users.update({
        where: { id: testRecord.id },
        data: { last_login: new Date() }
      });
    }
    
    await prisma.$disconnect();
    
    return {
      component: 'Database',
      status: 'pass',
      message: 'Database connectivity and operations verified',
      details: {
        userCount,
        contentCount,
        writeTestPassed: true
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      component: 'Database',
      status: 'fail',
      message: `Database verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Verify Redis/cache connectivity and functionality
 */
async function verifyCache(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 Verifying cache connectivity...');
    
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Test basic connectivity
    const pingResult = await redis.ping();
    if (pingResult !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    // Test write/read operations
    const testKey = `test:rollback:${Date.now()}`;
    await redis.set(testKey, 'rollback-test', 'EX', 10);
    const testValue = await redis.get(testKey);
    
    if (testValue !== 'rollback-test') {
      throw new Error('Redis read/write test failed');
    }
    
    // Test hash operations
    await redis.hmset(`${testKey}:hash`, { field1: 'value1', field2: 'value2' });
    const hashValue = await redis.hgetall(`${testKey}:hash`);
    
    // Cleanup test keys
    await redis.del(testKey, `${testKey}:hash`);
    
    // Get cache info
    const info = await redis.info('memory');
    const keyCount = await redis.dbsize();
    
    await redis.disconnect();
    
    return {
      component: 'Cache',
      status: 'pass',
      message: 'Cache connectivity and operations verified',
      details: {
        pingSuccess: true,
        readWriteTest: true,
        hashTest: Object.keys(hashValue).length === 2,
        keyCount,
        memoryInfo: info.split('\n').find(line => line.startsWith('used_memory_human:'))
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      component: 'Cache',
      status: 'fail',
      message: `Cache verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Verify S3 connectivity and functionality
 */
async function verifyS3(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 Verifying S3 connectivity...');
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME not configured');
    }
    
    // Test bucket access
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    
    // Test list objects
    const listResponse = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 10
    }));
    
    const objectCount = listResponse.KeyCount || 0;
    
    return {
      component: 'S3',
      status: 'pass',
      message: 'S3 connectivity and access verified',
      details: {
        bucketName,
        objectCount,
        bucketAccessible: true
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      component: 'S3',
      status: 'fail',
      message: `S3 verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Verify application health endpoints
 */
async function verifyApplicationHealth(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 Verifying application health...');
    
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // Test health endpoint
    const healthResponse = await fetch(`${baseUrl}/health`, {
      timeout: 10000
    });
    
    if (!healthResponse.ok) {
      throw new Error(`Health endpoint returned ${healthResponse.status}`);
    }
    
    const healthData = await healthResponse.json();
    
    // Test API endpoint
    const apiResponse = await fetch(`${baseUrl}/api/health`, {
      timeout: 10000
    });
    
    if (!apiResponse.ok) {
      throw new Error(`API health endpoint returned ${apiResponse.status}`);
    }
    
    const apiData = await apiResponse.json();
    
    return {
      component: 'Application',
      status: 'pass',
      message: 'Application health endpoints verified',
      details: {
        healthEndpoint: healthData,
        apiEndpoint: apiData,
        responseTime: Date.now() - startTime
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      component: 'Application',
      status: 'fail',
      message: `Application health verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Verify Kubernetes deployment status
 */
async function verifyKubernetesDeployment(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 Verifying Kubernetes deployment...');
    
    // Check deployment status
    const webDeployment = execSync('kubectl get deployment directfanz-web -o json', { encoding: 'utf8' });
    const webStatus = JSON.parse(webDeployment);
    
    const websocketDeployment = execSync('kubectl get deployment directfanz-websocket -o json', { encoding: 'utf8' });
    const websocketStatus = JSON.parse(websocketDeployment);
    
    // Check pod status
    const pods = execSync('kubectl get pods -l app=directfanz -o json', { encoding: 'utf8' });
    const podStatus = JSON.parse(pods);
    
    const runningPods = podStatus.items.filter((pod: any) => 
      pod.status.phase === 'Running' && 
      pod.status.conditions?.some((condition: any) => 
        condition.type === 'Ready' && condition.status === 'True'
      )
    );
    
    const webReady = webStatus.status.readyReplicas === webStatus.status.replicas;
    const websocketReady = websocketStatus.status.readyReplicas === websocketStatus.status.replicas;
    
    if (!webReady || !websocketReady) {
      return {
        component: 'Kubernetes',
        status: 'warning',
        message: 'Some deployments are not fully ready',
        details: {
          webDeployment: webReady,
          websocketDeployment: websocketReady,
          runningPods: runningPods.length,
          totalPods: podStatus.items.length
        },
        duration: Date.now() - startTime
      };
    }
    
    return {
      component: 'Kubernetes',
      status: 'pass',
      message: 'Kubernetes deployments verified',
      details: {
        webDeployment: webReady,
        websocketDeployment: websocketReady,
        runningPods: runningPods.length,
        totalPods: podStatus.items.length
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      component: 'Kubernetes',
      status: 'fail',
      message: `Kubernetes verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Verify DNS resolution
 */
async function verifyDNS(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 Verifying DNS resolution...');
    
    const domain = process.env.DOMAIN_NAME || 'directfanz.io';
    
    // Test DNS resolution
    const dnsResult = execSync(`dig +short ${domain}`, { encoding: 'utf8' }).trim();
    
    if (!dnsResult) {
      throw new Error('DNS resolution returned no results');
    }
    
    // Test subdomain resolution
    const apiDnsResult = execSync(`dig +short api.${domain}`, { encoding: 'utf8' }).trim();
    
    return {
      component: 'DNS',
      status: 'pass',
      message: 'DNS resolution verified',
      details: {
        domain,
        mainDomain: dnsResult,
        apiSubdomain: apiDnsResult,
        resolutionWorking: true
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      component: 'DNS',
      status: 'fail',
      message: `DNS verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Verify configuration consistency
 */
async function verifyConfiguration(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 Verifying configuration consistency...');
    
    const config = {
      databaseUrl: process.env.DATABASE_URL,
      redisUrl: process.env.REDIS_URL,
      s3Bucket: process.env.AWS_S3_BUCKET_NAME,
      awsRegion: process.env.AWS_REGION,
      nodeEnv: process.env.NODE_ENV
    };
    
    const missingConfig = Object.entries(config)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingConfig.length > 0) {
      return {
        component: 'Configuration',
        status: 'warning',
        message: `Some configuration values are missing: ${missingConfig.join(', ')}`,
        details: {
          config,
          missingConfig
        },
        duration: Date.now() - startTime
      };
    }
    
    // Verify configuration format
    const configIssues = [];
    
    if (config.databaseUrl && !config.databaseUrl.startsWith('postgresql://')) {
      configIssues.push('DATABASE_URL should start with postgresql://');
    }
    
    if (config.redisUrl && !config.redisUrl.startsWith('redis://')) {
      configIssues.push('REDIS_URL should start with redis://');
    }
    
    if (configIssues.length > 0) {
      return {
        component: 'Configuration',
        status: 'warning',
        message: `Configuration format issues: ${configIssues.join(', ')}`,
        details: {
          config,
          configIssues
        },
        duration: Date.now() - startTime
      };
    }
    
    return {
      component: 'Configuration',
      status: 'pass',
      message: 'Configuration consistency verified',
      details: {
        config: Object.keys(config),
        allConfigured: true
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      component: 'Configuration',
      status: 'fail',
      message: `Configuration verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Run performance baseline test
 */
async function verifyPerformance(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 Verifying performance baseline...');
    
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // Test API response times
    const apiTests = [
      { endpoint: '/api/health', expectedMaxTime: 1000 },
      { endpoint: '/api/users/me', expectedMaxTime: 2000 },
      { endpoint: '/api/content', expectedMaxTime: 3000 }
    ];
    
    const results = [];
    
    for (const test of apiTests) {
      const testStart = Date.now();
      
      try {
        const response = await fetch(`${baseUrl}${test.endpoint}`, {
          timeout: test.expectedMaxTime + 1000,
          headers: {
            'Authorization': 'Bearer test-token' // This would be a real token in practice
          }
        });
        
        const responseTime = Date.now() - testStart;
        
        results.push({
          endpoint: test.endpoint,
          responseTime,
          status: response.status,
          withinThreshold: responseTime <= test.expectedMaxTime
        });
        
      } catch (error) {
        results.push({
          endpoint: test.endpoint,
          responseTime: Date.now() - testStart,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          withinThreshold: false
        });
      }
    }
    
    const slowEndpoints = results.filter(r => !r.withinThreshold);
    
    if (slowEndpoints.length > 0) {
      return {
        component: 'Performance',
        status: 'warning',
        message: `Some endpoints are slower than expected: ${slowEndpoints.map(e => e.endpoint).join(', ')}`,
        details: {
          results,
          slowEndpoints: slowEndpoints.length
        },
        duration: Date.now() - startTime
      };
    }
    
    return {
      component: 'Performance',
      status: 'pass',
      message: 'Performance baseline verified',
      details: {
        results,
        averageResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      component: 'Performance',
      status: 'fail',
      message: `Performance verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Run all verification checks
 */
async function runAllVerifications(): Promise<VerificationSummary> {
  const startTime = Date.now();
  
  logger.info('🚀 Starting rollback verification...');
  
  const verifications = [
    verifyDatabase,
    verifyCache,
    verifyS3,
    verifyApplicationHealth,
    verifyKubernetesDeployment,
    verifyDNS,
    verifyConfiguration,
    verifyPerformance
  ];
  
  const results: VerificationResult[] = [];
  
  for (const verification of verifications) {
    try {
      const result = await verification();
      results.push(result);
      
      const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      logger.info(`${statusIcon} ${result.component}: ${result.message} (${result.duration}ms)`);
      
    } catch (error) {
      const result: VerificationResult = {
        component: 'Unknown',
        status: 'fail',
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0
      };
      results.push(result);
      logger.error(`❌ Verification error: ${result.message}`);
    }
  }
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  let overallStatus: 'pass' | 'fail' | 'warning' = 'pass';
  if (failed > 0) {
    overallStatus = 'fail';
  } else if (warnings > 0) {
    overallStatus = 'warning';
  }
  
  const summary: VerificationSummary = {
    totalChecks: results.length,
    passed,
    failed,
    warnings,
    results,
    overallStatus,
    duration: Date.now() - startTime
  };
  
  return summary;
}

/**
 * Display verification summary
 */
function displaySummary(summary: VerificationSummary): void {
  logger.info('\n📊 Rollback Verification Summary');
  logger.info('================================');
  
  const statusIcon = summary.overallStatus === 'pass' ? '✅' : 
                    summary.overallStatus === 'warning' ? '⚠️' : '❌';
  
  logger.info(`${statusIcon} Overall Status: ${summary.overallStatus.toUpperCase()}`);
  logger.info(`📈 Total Checks: ${summary.totalChecks}`);
  logger.info(`✅ Passed: ${summary.passed}`);
  logger.info(`⚠️ Warnings: ${summary.warnings}`);
  logger.info(`❌ Failed: ${summary.failed}`);
  logger.info(`⏱️ Total Duration: ${summary.duration}ms`);
  
  if (summary.failed > 0) {
    logger.info('\n❌ Failed Checks:');
    summary.results
      .filter(r => r.status === 'fail')
      .forEach(r => logger.info(`  - ${r.component}: ${r.message}`));
  }
  
  if (summary.warnings > 0) {
    logger.info('\n⚠️ Warnings:');
    summary.results
      .filter(r => r.status === 'warning')
      .forEach(r => logger.info(`  - ${r.component}: ${r.message}`));
  }
  
  logger.info('\n📝 Recommendations:');
  
  if (summary.overallStatus === 'pass') {
    logger.info('  ✅ Rollback verification passed - system is ready for use');
    logger.info('  📊 Monitor system performance and error rates');
    logger.info('  🔍 Continue with post-rollback testing');
  } else if (summary.overallStatus === 'warning') {
    logger.info('  ⚠️ Rollback verification passed with warnings');
    logger.info('  🔧 Address warning conditions when possible');
    logger.info('  📊 Monitor system closely for issues');
  } else {
    logger.info('  ❌ Rollback verification failed - system needs attention');
    logger.info('  🚨 Address failed checks immediately');
    logger.info('  🔧 Do not proceed with normal operations until issues are resolved');
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    logger.info('🔍 DirectFanz Rollback Verification Tool');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Timestamp: ${new Date().toISOString()}`);
    
    const summary = await runAllVerifications();
    
    displaySummary(summary);
    
    // Exit with appropriate code
    if (summary.overallStatus === 'fail') {
      process.exit(1);
    } else if (summary.overallStatus === 'warning') {
      process.exit(2);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    logger.error('❌ Rollback verification failed', { 
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

export { main, runAllVerifications, displaySummary };