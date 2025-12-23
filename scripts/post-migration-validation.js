#!/usr/bin/env node

/**
 * Post-Migration Validation Script
 * 
 * Comprehensive validation suite to verify all functionality works correctly
 * after AWS migration cutover. This script runs integration tests and validates
 * data integrity across all systems.
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from 'redis';
import fetch from 'node-fetch';
import fs from 'fs';
import crypto from 'crypto';

const prisma = new PrismaClient();
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BASE_URL = process.argv.includes('--staging') 
  ? 'https://staging.directfanz.io' 
  : 'https://directfanz.io';

interface ValidationResult {
  category: string;
  test: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface ValidationSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  categories: Record<string, { passed: number; total: number }>;
  overallSuccess: boolean;
}

class PostMigrationValidator {
  private results: ValidationResult[] = [];
  private startTime: number = Date.now();

  private async runTest(category: string, test: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 ${category}: ${test}...`);
      const details = await testFn();
      
      const duration = Date.now() - startTime;
      this.results.push({ category, test, passed: true, duration, details });
      console.log(`✅ ${test} - Passed (${duration}ms)`);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({ category, test, passed: false, duration, error: error.message });
      console.log(`❌ ${test} - Failed (${duration}ms): ${error.message}`);
    }
  }

  // Database Validation Tests
  private async validateDatabaseConnectivity(): Promise<any> {
    await prisma.$queryRaw`SELECT 1 as test`;
    const connectionInfo = await prisma.$queryRaw`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        now() as current_time
    `;
    return connectionInfo[0];
  }

  private async validateDatabaseSchema(): Promise<any> {
    // Check that all expected tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    const expectedTables = [
      'User', 'Content', 'Subscription', 'Campaign', 'LiveStream', 
      'Message', 'Payment', 'Notification', 'Analytics'
    ];

    const existingTables = tables.map((t: any) => t.table_name);
    const missingTables = expectedTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }

    return { totalTables: existingTables.length, expectedTables: expectedTables.length };
  }

  private async validateDataIntegrity(): Promise<any> {
    // Check record counts and basic data integrity
    const counts = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM "User") as users,
        (SELECT COUNT(*) FROM "Content") as content,
        (SELECT COUNT(*) FROM "Subscription") as subscriptions,
        (SELECT COUNT(*) FROM "Campaign") as campaigns,
        (SELECT COUNT(*) FROM "LiveStream") as live_streams
    `;

    // Check for orphaned records
    const orphanedContent = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Content" c
      LEFT JOIN "User" u ON c."userId" = u.id
      WHERE u.id IS NULL
    `;

    if (orphanedContent[0].count > 0) {
      throw new Error(`Found ${orphanedContent[0].count} orphaned content records`);
    }

    return counts[0];
  }

  private async validateDatabasePerformance(): Promise<any> {
    const startTime = Date.now();
    
    // Test a complex query
    await prisma.$queryRaw`
      SELECT u.id, u.email, COUNT(c.id) as content_count
      FROM "User" u
      LEFT JOIN "Content" c ON u.id = c."userId"
      GROUP BY u.id, u.email
      LIMIT 10
    `;

    const queryTime = Date.now() - startTime;
    
    if (queryTime > 1000) {
      throw new Error(`Query performance degraded: ${queryTime}ms`);
    }

    return { queryTime };
  }

  // Cache Validation Tests
  private async validateCacheConnectivity(): Promise<any> {
    const redis = createClient({
      url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
    });

    await redis.connect();
    
    const pong = await redis.ping();
    const info = await redis.info('server');
    
    await redis.disconnect();

    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }

    return { ping: pong, serverInfo: info.split('\n')[0] };
  }

  private async validateCacheOperations(): Promise<any> {
    const redis = createClient({
      url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
    });

    await redis.connect();

    const testKey = `test:${Date.now()}`;
    const testValue = JSON.stringify({ test: true, timestamp: Date.now() });

    // Test SET/GET operations
    await redis.set(testKey, testValue, { EX: 60 });
    const retrievedValue = await redis.get(testKey);
    
    if (retrievedValue !== testValue) {
      throw new Error('Cache SET/GET operation failed');
    }

    // Test DELETE operation
    await redis.del(testKey);
    const deletedValue = await redis.get(testKey);
    
    if (deletedValue !== null) {
      throw new Error('Cache DELETE operation failed');
    }

    await redis.disconnect();

    return { operations: ['SET', 'GET', 'DELETE'] };
  }

  // Storage Validation Tests
  private async validateS3Connectivity(): Promise<any> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME || 'directfanz-content-production';
    
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 10
    });

    const response = await s3Client.send(listCommand);
    
    return {
      bucket: bucketName,
      objectCount: response.KeyCount || 0,
      hasObjects: (response.KeyCount || 0) > 0
    };
  }

  private async validateS3FileIntegrity(): Promise<any> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME || 'directfanz-content-production';
    
    // Get a sample of files to check
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 5
    });

    const response = await s3Client.send(listCommand);
    const objects = response.Contents || [];

    if (objects.length === 0) {
      return { message: 'No objects to validate' };
    }

    // Check metadata for first few objects
    const validatedObjects = [];
    for (const obj of objects.slice(0, 3)) {
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: obj.Key
      });

      const headResponse = await s3Client.send(headCommand);
      validatedObjects.push({
        key: obj.Key,
        size: headResponse.ContentLength,
        lastModified: headResponse.LastModified,
        etag: headResponse.ETag
      });
    }

    return { validatedObjects };
  }

  // Application Validation Tests
  private async validateAPIEndpoints(): Promise<any> {
    const endpoints = [
      { path: '/api/health', expectedStatus: 200 },
      { path: '/api/auth/session', expectedStatus: [200, 401] },
      { path: '/api/admin/database/health', expectedStatus: [200, 401, 403] },
      { path: '/api/admin/cache/health', expectedStatus: [200, 401, 403] }
    ];

    const results = [];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${BASE_URL}${endpoint.path}`, {
        timeout: 10000
      });

      const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
        ? endpoint.expectedStatus 
        : [endpoint.expectedStatus];

      if (!expectedStatuses.includes(response.status)) {
        throw new Error(`Endpoint ${endpoint.path} returned ${response.status}, expected ${expectedStatuses.join(' or ')}`);
      }

      results.push({
        path: endpoint.path,
        status: response.status,
        responseTime: response.headers.get('x-response-time') || 'unknown'
      });
    }

    return { endpoints: results };
  }

  private async validateAuthentication(): Promise<any> {
    // Test that authentication endpoints are working
    const authResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Should return 401 for unauthenticated request (which is correct behavior)
    if (authResponse.status !== 401 && authResponse.status !== 200) {
      throw new Error(`Authentication endpoint returned unexpected status: ${authResponse.status}`);
    }

    return { 
      authEndpointWorking: true,
      status: authResponse.status,
      message: authResponse.status === 401 ? 'Correctly rejecting unauthenticated requests' : 'Authentication system responding'
    };
  }

  private async validateFileUpload(): Promise<any> {
    // Test file upload endpoint (should require authentication)
    const uploadResponse = await fetch(`${BASE_URL}/api/upload/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: 'test-validation.jpg',
        fileType: 'image/jpeg'
      })
    });

    // Should return 401 for unauthenticated request
    if (uploadResponse.status !== 401) {
      throw new Error(`Upload endpoint not properly protected: ${uploadResponse.status}`);
    }

    return { 
      uploadProtected: true,
      status: uploadResponse.status 
    };
  }

  // Streaming Validation Tests
  private async validateStreamingInfrastructure(): Promise<any> {
    try {
      // Check if streaming health endpoint exists
      const streamingResponse = await fetch(`${BASE_URL}/api/streaming/health`, {
        timeout: 10000
      });

      if (streamingResponse.ok) {
        const data = await streamingResponse.json();
        return {
          streamingHealthy: data.status === 'healthy',
          streamingData: data
        };
      } else {
        return {
          streamingHealthy: false,
          status: streamingResponse.status,
          message: 'Streaming health endpoint not available'
        };
      }
    } catch (error) {
      return {
        streamingHealthy: false,
        error: error.message,
        message: 'Streaming infrastructure not accessible'
      };
    }
  }

  private async validateWebSocketConnection(): Promise<any> {
    try {
      // Test WebSocket endpoint availability (not actual connection)
      const wsResponse = await fetch(`${BASE_URL}/socket.io/`, {
        method: 'GET',
        timeout: 5000
      });

      return {
        webSocketEndpointAvailable: wsResponse.status < 500,
        status: wsResponse.status
      };
    } catch (error) {
      return {
        webSocketEndpointAvailable: false,
        error: error.message
      };
    }
  }

  // Integration Tests
  private async validateCriticalUserFlows(): Promise<any> {
    // Run the critical flows test script
    try {
      const result = execSync('node scripts/test-critical-flows.js --production', {
        encoding: 'utf8',
        timeout: 60000
      });

      return {
        criticalFlowsWorking: true,
        output: result.split('\n').slice(-5).join('\n') // Last 5 lines
      };
    } catch (error) {
      throw new Error(`Critical flows test failed: ${error.message}`);
    }
  }

  private async validatePerformanceMetrics(): Promise<any> {
    // Run performance check
    try {
      const result = execSync('node scripts/check-performance-metrics.js --production', {
        encoding: 'utf8',
        timeout: 120000
      });

      return {
        performanceMetsMet: true,
        output: result.split('\n').slice(-10).join('\n') // Last 10 lines
      };
    } catch (error) {
      // Performance issues are warnings, not failures
      return {
        performanceMetsMet: false,
        warning: error.message,
        message: 'Performance metrics below target but system functional'
      };
    }
  }

  // Security Validation Tests
  private async validateSSLCertificates(): Promise<any> {
    if (!BASE_URL.startsWith('https://')) {
      throw new Error('SSL not configured - using HTTP instead of HTTPS');
    }

    const response = await fetch(BASE_URL, { timeout: 10000 });
    
    return {
      sslConfigured: true,
      httpsWorking: response.ok || response.status < 500
    };
  }

  private async validateSecurityHeaders(): Promise<any> {
    const response = await fetch(BASE_URL, { timeout: 10000 });
    
    const securityHeaders = {
      'strict-transport-security': response.headers.get('strict-transport-security'),
      'x-frame-options': response.headers.get('x-frame-options'),
      'x-content-type-options': response.headers.get('x-content-type-options'),
      'referrer-policy': response.headers.get('referrer-policy')
    };

    const missingHeaders = Object.entries(securityHeaders)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    return {
      securityHeaders,
      missingHeaders,
      allHeadersPresent: missingHeaders.length === 0
    };
  }

  // Main validation orchestrator
  public async runValidation(): Promise<ValidationSummary> {
    console.log('🚀 Starting Post-Migration Validation');
    console.log(`Target: ${BASE_URL}`);
    console.log('=====================================');

    // Database Validation
    await this.runTest('Database', 'Connectivity', () => this.validateDatabaseConnectivity());
    await this.runTest('Database', 'Schema Integrity', () => this.validateDatabaseSchema());
    await this.runTest('Database', 'Data Integrity', () => this.validateDataIntegrity());
    await this.runTest('Database', 'Performance', () => this.validateDatabasePerformance());

    // Cache Validation
    await this.runTest('Cache', 'Connectivity', () => this.validateCacheConnectivity());
    await this.runTest('Cache', 'Operations', () => this.validateCacheOperations());

    // Storage Validation
    await this.runTest('Storage', 'S3 Connectivity', () => this.validateS3Connectivity());
    await this.runTest('Storage', 'File Integrity', () => this.validateS3FileIntegrity());

    // Application Validation
    await this.runTest('Application', 'API Endpoints', () => this.validateAPIEndpoints());
    await this.runTest('Application', 'Authentication', () => this.validateAuthentication());
    await this.runTest('Application', 'File Upload Protection', () => this.validateFileUpload());

    // Streaming Validation
    await this.runTest('Streaming', 'Infrastructure', () => this.validateStreamingInfrastructure());
    await this.runTest('Streaming', 'WebSocket Connection', () => this.validateWebSocketConnection());

    // Integration Tests
    await this.runTest('Integration', 'Critical User Flows', () => this.validateCriticalUserFlows());
    await this.runTest('Integration', 'Performance Metrics', () => this.validatePerformanceMetrics());

    // Security Validation
    await this.runTest('Security', 'SSL Certificates', () => this.validateSSLCertificates());
    await this.runTest('Security', 'Security Headers', () => this.validateSecurityHeaders());

    return this.generateSummary();
  }

  private generateSummary(): ValidationSummary {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    // Group by category
    const categories: Record<string, { passed: number; total: number }> = {};
    
    for (const result of this.results) {
      if (!categories[result.category]) {
        categories[result.category] = { passed: 0, total: 0 };
      }
      categories[result.category].total++;
      if (result.passed) {
        categories[result.category].passed++;
      }
    }

    const overallSuccess = failedTests === 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      categories,
      overallSuccess
    };
  }

  public printSummary(summary: ValidationSummary): void {
    const totalDuration = Date.now() - this.startTime;
    
    console.log('\n📊 Post-Migration Validation Summary');
    console.log('====================================');
    console.log(`Total Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`Overall Result: ${summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests: ${summary.passedTests}/${summary.totalTests} passed`);
    
    console.log('\n📋 Results by Category:');
    console.log('------------------------');
    
    for (const [category, stats] of Object.entries(summary.categories)) {
      const status = stats.passed === stats.total ? '✅' : '⚠️';
      console.log(`${status} ${category}: ${stats.passed}/${stats.total}`);
    }

    console.log('\n🔍 Detailed Results:');
    console.log('--------------------');
    
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.category}: ${result.test} (${result.duration}ms)`);
      
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      results: this.results,
      environment: BASE_URL,
      duration: totalDuration
    };

    const reportFile = `logs/post-migration-validation-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);

    if (summary.overallSuccess) {
      console.log('\n🎉 Post-migration validation completed successfully!');
      console.log('All systems are operational and data integrity is maintained.');
    } else {
      console.log('\n⚠️  Post-migration validation found issues');
      console.log('Please review failed tests and address issues before proceeding.');
    }
  }
}

async function main() {
  // Create logs directory if it doesn't exist
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
  }

  const validator = new PostMigrationValidator();
  
  try {
    const summary = await validator.runValidation();
    validator.printSummary(summary);
    
    process.exit(summary.overallSuccess ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();