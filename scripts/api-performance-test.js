#!/usr/bin/env node

/**
 * API Performance Testing Script for DirectFanz AWS Migration
 * 
 * Tests API endpoints to ensure they meet the requirement of sub-200ms response times
 * Validates: Requirements 12.1 - THE Platform SHALL maintain sub-200ms response times for API endpoints
 */

import http from 'http';
import https from 'https';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

class APIPerformanceTest {
  constructor(options = {}) {
    this.options = {
      baseUrl: options.baseUrl || process.env.API_BASE_URL || 'http://localhost:3000',
      iterations: options.iterations || 50,
      concurrentUsers: options.concurrentUsers || 10,
      responseTimeThreshold: options.responseTimeThreshold || 200, // ms
      timeout: options.timeout || 5000, // ms
      warmupRequests: options.warmupRequests || 5,
      ...options
    };

    this.results = {
      timestamp: new Date().toISOString(),
      config: this.options,
      endpoints: {},
      summary: {}
    };

    // Define critical API endpoints to test
    this.endpoints = [
      // Authentication endpoints
      { name: 'health_check', path: '/api/health', method: 'GET', critical: true },
      { name: 'user_profile', path: '/api/user/profile', method: 'GET', critical: true },
      
      // Content endpoints
      { name: 'content_feed', path: '/api/content/feed', method: 'GET', critical: true },
      { name: 'content_search', path: '/api/content/search?q=test', method: 'GET', critical: false },
      { name: 'content_details', path: '/api/content/test-content-id', method: 'GET', critical: true },
      
      // Subscription endpoints
      { name: 'subscriptions_list', path: '/api/subscriptions', method: 'GET', critical: true },
      { name: 'subscription_tiers', path: '/api/subscriptions/tiers', method: 'GET', critical: false },
      
      // Campaign endpoints
      { name: 'campaigns_active', path: '/api/campaigns/active', method: 'GET', critical: false },
      
      // Live streaming endpoints
      { name: 'streams_live', path: '/api/streams/live', method: 'GET', critical: true },
      { name: 'stream_details', path: '/api/streams/test-stream-id', method: 'GET', critical: false },
      
      // Analytics endpoints
      { name: 'analytics_dashboard', path: '/api/analytics/dashboard', method: 'GET', critical: false },
      
      // Messaging endpoints
      { name: 'messages_recent', path: '/api/messages/recent', method: 'GET', critical: true },
    ];
  }

  async makeRequest(endpoint, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.options.baseUrl}${endpoint.path}`;
      const isHttps = url.startsWith('https');
      const client = isHttps ? https : http;
      
      const requestOptions = {
        method: endpoint.method,
        timeout: this.options.timeout,
        headers: {
          'User-Agent': 'DirectFanz-API-Performance-Test/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const startTime = performance.now();
      
      const req = client.request(url, requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          resolve({
            statusCode: res.statusCode,
            responseTime,
            success: res.statusCode >= 200 && res.statusCode < 400,
            headers: res.headers,
            bodySize: Buffer.byteLength(data, 'utf8'),
            endpoint: endpoint.name,
            url
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        resolve({
          statusCode: 0,
          responseTime,
          success: false,
          error: error.message,
          endpoint: endpoint.name,
          url
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        resolve({
          statusCode: 0,
          responseTime,
          success: false,
          error: 'Request timeout',
          endpoint: endpoint.name,
          url
        });
      });

      req.end();
    });
  }

  calculateStats(responseTimes) {
    if (responseTimes.length === 0) {
      return { avg: 0, min: 0, max: 0, median: 0, p95: 0, p99: 0 };
    }

    const sorted = [...responseTimes].sort((a, b) => a - b);
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const min = Math.min(...responseTimes);
    const max = Math.max(...responseTimes);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      avg: parseFloat(avg.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      median: parseFloat(median.toFixed(2)),
      p95: parseFloat(p95.toFixed(2)),
      p99: parseFloat(p99.toFixed(2))
    };
  }

  async warmupEndpoint(endpoint) {
    console.log(`🔥 Warming up ${endpoint.name}...`);
    
    for (let i = 0; i < this.options.warmupRequests; i++) {
      try {
        await this.makeRequest(endpoint);
        process.stdout.write(`  Warmup ${i + 1}/${this.options.warmupRequests}\r`);
      } catch (error) {
        // Ignore warmup errors
      }
    }
    console.log(''); // New line after warmup
  }

  async testEndpoint(endpoint) {
    console.log(`\n🔍 Testing ${endpoint.name} (${endpoint.path})`);
    console.log(`   Critical: ${endpoint.critical ? 'Yes' : 'No'}, Target: <${this.options.responseTimeThreshold}ms`);

    // Warmup
    await this.warmupEndpoint(endpoint);

    const results = [];
    const errors = [];
    let successCount = 0;

    // Sequential tests
    console.log(`   Running ${this.options.iterations} sequential requests...`);
    for (let i = 0; i < this.options.iterations; i++) {
      try {
        const result = await this.makeRequest(endpoint);
        results.push(result);
        
        if (result.success) {
          successCount++;
        } else {
          errors.push(result.error || `HTTP ${result.statusCode}`);
        }

        process.stdout.write(`   Progress: ${i + 1}/${this.options.iterations} (${result.responseTime.toFixed(1)}ms)\r`);
      } catch (error) {
        errors.push(error.message);
      }
    }

    console.log(''); // New line after progress

    // Calculate statistics
    const responseTimes = results.filter(r => r.success).map(r => r.responseTime);
    const stats = this.calculateStats(responseTimes);
    const successRate = (successCount / this.options.iterations) * 100;
    const thresholdViolations = responseTimes.filter(t => t > this.options.responseTimeThreshold).length;
    const thresholdCompliance = ((responseTimes.length - thresholdViolations) / responseTimes.length) * 100;

    // Store results
    this.results.endpoints[endpoint.name] = {
      endpoint: endpoint.name,
      path: endpoint.path,
      method: endpoint.method,
      critical: endpoint.critical,
      iterations: this.options.iterations,
      successCount,
      successRate: parseFloat(successRate.toFixed(2)),
      errorCount: errors.length,
      errors: errors.slice(0, 5), // Keep first 5 errors
      stats,
      thresholdViolations,
      thresholdCompliance: parseFloat(thresholdCompliance.toFixed(2)),
      meetsRequirement: stats.avg <= this.options.responseTimeThreshold && thresholdCompliance >= 95,
      status: successCount > 0 ? (thresholdCompliance >= 95 ? 'PASS' : 'FAIL') : 'ERROR'
    };

    // Display results
    const statusIcon = this.results.endpoints[endpoint.name].status === 'PASS' ? '✅' : 
                      this.results.endpoints[endpoint.name].status === 'FAIL' ? '⚠️' : '❌';
    
    console.log(`   ${statusIcon} Results:`);
    console.log(`      Average: ${stats.avg}ms (target: <${this.options.responseTimeThreshold}ms)`);
    console.log(`      95th percentile: ${stats.p95}ms`);
    console.log(`      Success rate: ${successRate.toFixed(1)}%`);
    console.log(`      Threshold compliance: ${thresholdCompliance.toFixed(1)}%`);
    
    if (thresholdViolations > 0) {
      console.log(`      ⚠️ ${thresholdViolations} requests exceeded ${this.options.responseTimeThreshold}ms threshold`);
    }

    if (errors.length > 0) {
      console.log(`      ❌ ${errors.length} errors occurred`);
    }

    return this.results.endpoints[endpoint.name];
  }

  async testConcurrentLoad(endpoint) {
    console.log(`\n⚡ Concurrent load test: ${endpoint.name} (${this.options.concurrentUsers} users)`);

    const startTime = performance.now();
    const promises = [];
    
    // Create concurrent requests
    for (let i = 0; i < this.options.concurrentUsers; i++) {
      promises.push(
        (async () => {
          const userResults = [];
          const requestsPerUser = Math.ceil(this.options.iterations / this.options.concurrentUsers);
          
          for (let j = 0; j < requestsPerUser; j++) {
            try {
              const result = await this.makeRequest(endpoint);
              userResults.push(result);
            } catch (error) {
              userResults.push({
                success: false,
                error: error.message,
                responseTime: 0
              });
            }
          }
          
          return userResults;
        })()
      );
    }

    const concurrentResults = await Promise.all(promises);
    const allResults = concurrentResults.flat();
    const totalTime = performance.now() - startTime;

    // Calculate concurrent statistics
    const successfulResults = allResults.filter(r => r.success);
    const responseTimes = successfulResults.map(r => r.responseTime);
    const stats = this.calculateStats(responseTimes);
    const throughput = allResults.length / (totalTime / 1000); // requests per second
    const successRate = (successfulResults.length / allResults.length) * 100;
    const thresholdViolations = responseTimes.filter(t => t > this.options.responseTimeThreshold).length;
    const thresholdCompliance = responseTimes.length > 0 ? 
      ((responseTimes.length - thresholdViolations) / responseTimes.length) * 100 : 0;

    // Store concurrent results
    this.results.endpoints[`${endpoint.name}_concurrent`] = {
      endpoint: `${endpoint.name}_concurrent`,
      path: endpoint.path,
      method: endpoint.method,
      critical: endpoint.critical,
      concurrentUsers: this.options.concurrentUsers,
      totalRequests: allResults.length,
      successCount: successfulResults.length,
      successRate: parseFloat(successRate.toFixed(2)),
      stats,
      throughput: parseFloat(throughput.toFixed(2)),
      totalTime: parseFloat(totalTime.toFixed(2)),
      thresholdViolations,
      thresholdCompliance: parseFloat(thresholdCompliance.toFixed(2)),
      meetsRequirement: stats.avg <= this.options.responseTimeThreshold && thresholdCompliance >= 95,
      status: successfulResults.length > 0 ? (thresholdCompliance >= 95 ? 'PASS' : 'FAIL') : 'ERROR'
    };

    const statusIcon = this.results.endpoints[`${endpoint.name}_concurrent`].status === 'PASS' ? '✅' : 
                      this.results.endpoints[`${endpoint.name}_concurrent`].status === 'FAIL' ? '⚠️' : '❌';

    console.log(`   ${statusIcon} Concurrent Results:`);
    console.log(`      Throughput: ${throughput.toFixed(2)} requests/sec`);
    console.log(`      Average: ${stats.avg}ms (target: <${this.options.responseTimeThreshold}ms)`);
    console.log(`      95th percentile: ${stats.p95}ms`);
    console.log(`      Success rate: ${successRate.toFixed(1)}%`);
    console.log(`      Threshold compliance: ${thresholdCompliance.toFixed(1)}%`);

    return this.results.endpoints[`${endpoint.name}_concurrent`];
  }

  generateSummary() {
    const endpointResults = Object.values(this.results.endpoints);
    const sequentialResults = endpointResults.filter(r => !r.endpoint.includes('_concurrent'));
    const concurrentResults = endpointResults.filter(r => r.endpoint.includes('_concurrent'));

    const totalEndpoints = sequentialResults.length;
    const passedEndpoints = sequentialResults.filter(r => r.status === 'PASS').length;
    const failedEndpoints = sequentialResults.filter(r => r.status === 'FAIL').length;
    const errorEndpoints = sequentialResults.filter(r => r.status === 'ERROR').length;

    const criticalEndpoints = sequentialResults.filter(r => r.critical);
    const criticalPassed = criticalEndpoints.filter(r => r.status === 'PASS').length;
    const criticalFailed = criticalEndpoints.filter(r => r.status === 'FAIL').length;

    const avgResponseTimes = sequentialResults
      .filter(r => r.stats && r.stats.avg > 0)
      .map(r => r.stats.avg);
    
    const overallAvg = avgResponseTimes.length > 0 ? 
      avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length : 0;

    const requirementsMet = passedEndpoints === totalEndpoints && criticalPassed === criticalEndpoints.length;

    this.results.summary = {
      totalEndpoints,
      passedEndpoints,
      failedEndpoints,
      errorEndpoints,
      passRate: parseFloat(((passedEndpoints / totalEndpoints) * 100).toFixed(2)),
      criticalEndpoints: criticalEndpoints.length,
      criticalPassed,
      criticalFailed,
      criticalPassRate: parseFloat(((criticalPassed / criticalEndpoints.length) * 100).toFixed(2)),
      overallAvgResponseTime: parseFloat(overallAvg.toFixed(2)),
      requirementsMet,
      responseTimeThreshold: this.options.responseTimeThreshold,
      testDuration: new Date().toISOString()
    };

    return this.results.summary;
  }

  async saveResults(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `api-performance-test-${timestamp}.json`;
    }

    const resultsDir = path.join(process.cwd(), 'performance-results');

    try {
      await fs.access(resultsDir);
    } catch {
      await fs.mkdir(resultsDir, { recursive: true });
    }

    const filePath = path.join(resultsDir, filename);
    await fs.writeFile(filePath, JSON.stringify(this.results, null, 2));

    return filePath;
  }

  async runFullTest() {
    console.log('🚀 DirectFanz API Performance Test Suite');
    console.log('==========================================');
    console.log(`📅 Timestamp: ${this.results.timestamp}`);
    console.log(`🎯 Target: ${this.options.baseUrl}`);
    console.log(`⚙️ Config: ${this.options.iterations} iterations, ${this.options.concurrentUsers} concurrent users`);
    console.log(`📊 Threshold: <${this.options.responseTimeThreshold}ms response time`);
    console.log('');

    try {
      // Test each endpoint sequentially
      for (const endpoint of this.endpoints) {
        await this.testEndpoint(endpoint);
      }

      // Test critical endpoints under concurrent load
      console.log('\n⚡ CONCURRENT LOAD TESTING');
      console.log('==========================');
      
      const criticalEndpoints = this.endpoints.filter(e => e.critical);
      for (const endpoint of criticalEndpoints) {
        await this.testConcurrentLoad(endpoint);
      }

      // Generate summary
      const summary = this.generateSummary();

      // Display final results
      console.log('\n📊 FINAL RESULTS');
      console.log('=================');
      console.log(`Overall Status: ${summary.requirementsMet ? '✅ REQUIREMENTS MET' : '❌ REQUIREMENTS NOT MET'}`);
      console.log(`Total Endpoints: ${summary.totalEndpoints}`);
      console.log(`Passed: ${summary.passedEndpoints} (${summary.passRate}%)`);
      console.log(`Failed: ${summary.failedEndpoints}`);
      console.log(`Errors: ${summary.errorEndpoints}`);
      console.log(`Critical Endpoints: ${summary.criticalPassed}/${summary.criticalEndpoints} passed`);
      console.log(`Overall Average Response Time: ${summary.overallAvgResponseTime}ms`);

      if (!summary.requirementsMet) {
        console.log('\n⚠️ FAILED ENDPOINTS:');
        Object.values(this.results.endpoints)
          .filter(r => r.status !== 'PASS' && !r.endpoint.includes('_concurrent'))
          .forEach(r => {
            console.log(`   ${r.endpoint}: ${r.stats?.avg || 'N/A'}ms (${r.status})`);
          });
      }

      // Save results
      const filePath = await this.saveResults();
      console.log(`\n💾 Results saved to: ${filePath}`);

      return {
        success: summary.requirementsMet,
        summary,
        results: this.results
      };

    } catch (error) {
      console.error('\n❌ API performance test failed:', error);
      throw error;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    iterations: parseInt(process.env.PERF_ITERATIONS) || 50,
    concurrentUsers: parseInt(process.env.PERF_CONCURRENT_USERS) || 10,
    responseTimeThreshold: parseInt(process.env.PERF_RESPONSE_THRESHOLD) || 200
  };

  const tester = new APIPerformanceTest(options);

  tester.runFullTest()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('API performance test failed:', error);
      process.exit(1);
    });
}

export { APIPerformanceTest };