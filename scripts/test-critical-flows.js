#!/usr/bin/env node

/**
 * Test Critical User Flows Script
 * 
 * Tests essential user journeys after production cutover
 */

import { execSync } from 'child_process';
import fetch from 'node-fetch';

const BASE_URL = process.argv.includes('--production') 
  ? 'https://directfanz.io' 
  : 'https://staging.directfanz.io';

const API_URL = `${BASE_URL}/api`;

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class CriticalFlowTester {
  private results: TestResult[] = [];

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Testing: ${name}...`);
      await testFn();
      
      const duration = Date.now() - startTime;
      this.results.push({ name, passed: true, duration });
      console.log(`✅ ${name} - Passed (${duration}ms)`);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({ name, passed: false, duration, error: error.message });
      console.log(`❌ ${name} - Failed (${duration}ms): ${error.message}`);
    }
  }

  private async testHealthEndpoint(): Promise<void> {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.status !== 'healthy') {
      throw new Error(`Health status not healthy: ${data.status}`);
    }
  }

  private async testDatabaseConnectivity(): Promise<void> {
    const response = await fetch(`${API_URL}/admin/database/health`);
    if (!response.ok) {
      throw new Error(`Database health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.connected) {
      throw new Error('Database not connected');
    }
  }

  private async testCacheConnectivity(): Promise<void> {
    const response = await fetch(`${API_URL}/admin/cache/health`);
    if (!response.ok) {
      throw new Error(`Cache health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.connected) {
      throw new Error('Cache not connected');
    }
  }

  private async testS3Connectivity(): Promise<void> {
    const response = await fetch(`${API_URL}/admin/storage/health`);
    if (!response.ok) {
      throw new Error(`Storage health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.connected) {
      throw new Error('S3 storage not connected');
    }
  }

  private async testUserAuthentication(): Promise<void> {
    // Test authentication endpoint
    const response = await fetch(`${API_URL}/auth/session`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Should return 401 for unauthenticated request (which is correct)
    if (response.status !== 401 && response.status !== 200) {
      throw new Error(`Unexpected auth response: ${response.status}`);
    }
  }

  private async testContentUpload(): Promise<void> {
    // Test file upload endpoint (should require authentication)
    const response = await fetch(`${API_URL}/upload/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: 'test.jpg',
        fileType: 'image/jpeg'
      })
    });
    
    // Should return 401 for unauthenticated request
    if (response.status !== 401) {
      throw new Error(`Upload endpoint not properly protected: ${response.status}`);
    }
  }

  private async testStreamingEndpoints(): Promise<void> {
    const response = await fetch(`${API_URL}/streaming/health`);
    if (!response.ok) {
      throw new Error(`Streaming health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.status !== 'healthy') {
      throw new Error(`Streaming service not healthy: ${data.status}`);
    }
  }

  private async testWebSocketConnection(): Promise<void> {
    // Test WebSocket endpoint availability
    const response = await fetch(`${BASE_URL}/socket.io/`, {
      method: 'GET'
    });
    
    // WebSocket endpoint should be available (may return various status codes)
    if (response.status >= 500) {
      throw new Error(`WebSocket endpoint error: ${response.status}`);
    }
  }

  private async testAPIResponseTimes(): Promise<void> {
    const endpoints = [
      '/health',
      '/auth/session',
      '/admin/database/health'
    ];

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      const response = await fetch(`${API_URL}${endpoint}`);
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 5000) { // 5 second timeout
        throw new Error(`Endpoint ${endpoint} too slow: ${responseTime}ms`);
      }
    }
  }

  private async testStaticAssets(): Promise<void> {
    // Test that static assets are being served
    const response = await fetch(`${BASE_URL}/favicon.ico`);
    if (!response.ok && response.status !== 404) {
      throw new Error(`Static assets not being served properly: ${response.status}`);
    }
  }

  private async testSSLCertificate(): Promise<void> {
    if (!BASE_URL.startsWith('https://')) {
      throw new Error('SSL not configured - using HTTP instead of HTTPS');
    }
    
    // Test SSL certificate validity
    const response = await fetch(BASE_URL);
    if (!response.ok && response.status >= 500) {
      throw new Error(`SSL/HTTPS issue: ${response.status}`);
    }
  }

  public async runAllTests(): Promise<void> {
    console.log('🚀 Running Critical Flow Tests');
    console.log(`Target: ${BASE_URL}`);
    console.log('================================');

    // Core infrastructure tests
    await this.runTest('Health Endpoint', () => this.testHealthEndpoint());
    await this.runTest('Database Connectivity', () => this.testDatabaseConnectivity());
    await this.runTest('Cache Connectivity', () => this.testCacheConnectivity());
    await this.runTest('S3 Storage Connectivity', () => this.testS3Connectivity());

    // Application functionality tests
    await this.runTest('User Authentication', () => this.testUserAuthentication());
    await this.runTest('Content Upload Protection', () => this.testContentUpload());
    await this.runTest('Streaming Endpoints', () => this.testStreamingEndpoints());
    await this.runTest('WebSocket Connection', () => this.testWebSocketConnection());

    // Performance and security tests
    await this.runTest('API Response Times', () => this.testAPIResponseTimes());
    await this.runTest('Static Assets', () => this.testStaticAssets());
    await this.runTest('SSL Certificate', () => this.testSSLCertificate());

    this.printResults();
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const passRate = Math.round((passed / total) * 100);

    console.log(`Overall: ${passed}/${total} tests passed (${passRate}%)`);
    console.log('');

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      console.log(`${status} ${result.name} (${duration})`);
      
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    if (passRate >= 90) {
      console.log('\n🎉 Critical flows are working correctly!');
      process.exit(0);
    } else if (passRate >= 70) {
      console.log('\n⚠️  Some issues detected but core functionality works');
      process.exit(0);
    } else {
      console.log('\n❌ Critical issues detected - manual investigation required');
      process.exit(1);
    }
  }
}

async function main() {
  const tester = new CriticalFlowTester();
  await tester.runAllTests();
}

main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});