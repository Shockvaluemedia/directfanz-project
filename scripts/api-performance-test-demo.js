#!/usr/bin/env node

/**
 * API Performance Testing Demo Script
 * 
 * Demonstrates the API performance testing functionality with mock data
 * This shows how the actual test would work when the server is running
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

class APIPerformanceTestDemo {
  constructor() {
    this.options = {
      baseUrl: 'http://localhost:3000',
      iterations: 25,
      concurrentUsers: 5,
      responseTimeThreshold: 200,
      timeout: 5000,
      warmupRequests: 5
    };

    this.results = {
      timestamp: new Date().toISOString(),
      config: this.options,
      endpoints: {},
      summary: {}
    };

    // Define critical API endpoints to test
    this.endpoints = [
      { name: 'health_check', path: '/api/health', method: 'GET', critical: true },
      { name: 'user_profile', path: '/api/user/profile', method: 'GET', critical: true },
      { name: 'content_feed', path: '/api/content', method: 'GET', critical: true },
      { name: 'subscriptions_list', path: '/api/fan/subscriptions', method: 'GET', critical: true },
      { name: 'streams_live', path: '/api/livestream', method: 'GET', critical: true },
      { name: 'messages_recent', path: '/api/messages', method: 'GET', critical: true },
      { name: 'content_search', path: '/api/search?q=test', method: 'GET', critical: false },
      { name: 'campaigns_active', path: '/api/campaigns', method: 'GET', critical: false },
      { name: 'analytics_dashboard', path: '/api/analytics', method: 'GET', critical: false },
    ];
  }

  // Mock API response simulation
  async simulateAPICall(endpoint) {
    // Simulate network latency and processing time
    const baseLatency = 50 + Math.random() * 100; // 50-150ms base
    const processingTime = endpoint.critical ? 20 + Math.random() * 30 : 30 + Math.random() * 50;
    const networkJitter = Math.random() * 20; // 0-20ms jitter
    
    const responseTime = baseLatency + processingTime + networkJitter;
    
    // Simulate occasional slower responses (5% chance)
    const slowResponse = Math.random() < 0.05;
    const finalResponseTime = slowResponse ? responseTime * 2.5 : responseTime;
    
    // Simulate very rare errors (1% chance)
    const hasError = Math.random() < 0.01;
    
    await new Promise(resolve => setTimeout(resolve, finalResponseTime));
    
    return {
      statusCode: hasError ? 500 : 200,
      responseTime: finalResponseTime,
      success: !hasError,
      endpoint: endpoint.name,
      url: `${this.options.baseUrl}${endpoint.path}`,
      bodySize: 1024 + Math.random() * 2048 // Simulate response size
    };
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

  async testEndpoint(endpoint) {
    console.log(`\n🔍 Testing ${endpoint.name} (${endpoint.path})`);
    console.log(`   Critical: ${endpoint.critical ? 'Yes' : 'No'}, Target: <${this.options.responseTimeThreshold}ms`);

    // Warmup
    console.log(`🔥 Warming up ${endpoint.name}...`);
    for (let i = 0; i < this.options.warmupRequests; i++) {
      await this.simulateAPICall(endpoint);
      process.stdout.write(`  Warmup ${i + 1}/${this.options.warmupRequests}\r`);
    }
    console.log(''); // New line after warmup

    const results = [];
    const errors = [];
    let successCount = 0;

    // Sequential tests
    console.log(`   Running ${this.options.iterations} sequential requests...`);
    for (let i = 0; i < this.options.iterations; i++) {
      try {
        const result = await this.simulateAPICall(endpoint);
        results.push(result);
        
        if (result.success) {
          successCount++;
        } else {
          errors.push(`HTTP ${result.statusCode}`);
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
    const thresholdCompliance = responseTimes.length > 0 ? 
      ((responseTimes.length - thresholdViolations) / responseTimes.length) * 100 : 0;

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
      errors: errors.slice(0, 5),
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
              const result = await this.simulateAPICall(endpoint);
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
    const throughput = allResults.length / (totalTime / 1000);
    const successRate = (successfulResults.length / allResults.length) * 100;
    const thresholdViolations = responseTimes.filter(t => t > this.options.responseTimeThreshold).length;
    const thresholdCompliance = responseTimes.length > 0 ? 
      ((responseTimes.length - thresholdViolations) / responseTimes.length) * 100 : 0;

    const statusIcon = thresholdCompliance >= 95 ? '✅' : '⚠️';

    console.log(`   ${statusIcon} Concurrent Results:`);
    console.log(`      Throughput: ${throughput.toFixed(2)} requests/sec`);
    console.log(`      Average: ${stats.avg}ms (target: <${this.options.responseTimeThreshold}ms)`);
    console.log(`      95th percentile: ${stats.p95}ms`);
    console.log(`      Success rate: ${successRate.toFixed(1)}%`);
    console.log(`      Threshold compliance: ${thresholdCompliance.toFixed(1)}%`);

    return {
      throughput: parseFloat(throughput.toFixed(2)),
      stats,
      successRate: parseFloat(successRate.toFixed(2)),
      thresholdCompliance: parseFloat(thresholdCompliance.toFixed(2))
    };
  }

  generateSummary() {
    const endpointResults = Object.values(this.results.endpoints);
    const totalEndpoints = endpointResults.length;
    const passedEndpoints = endpointResults.filter(r => r.status === 'PASS').length;
    const failedEndpoints = endpointResults.filter(r => r.status === 'FAIL').length;
    const errorEndpoints = endpointResults.filter(r => r.status === 'ERROR').length;

    const criticalEndpoints = endpointResults.filter(r => r.critical);
    const criticalPassed = criticalEndpoints.filter(r => r.status === 'PASS').length;

    const avgResponseTimes = endpointResults
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
      criticalPassRate: parseFloat(((criticalPassed / criticalEndpoints.length) * 100).toFixed(2)),
      overallAvgResponseTime: parseFloat(overallAvg.toFixed(2)),
      requirementsMet,
      responseTimeThreshold: this.options.responseTimeThreshold
    };

    return this.results.summary;
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `api-performance-demo-${timestamp}.json`;
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

  async runDemo() {
    console.log('🚀 DirectFanz API Performance Test Demo');
    console.log('=========================================');
    console.log(`📅 Timestamp: ${this.results.timestamp}`);
    console.log(`🎯 Target: ${this.options.baseUrl} (simulated)`);
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
      for (const endpoint of criticalEndpoints.slice(0, 2)) { // Test first 2 critical endpoints
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
          .filter(r => r.status !== 'PASS')
          .forEach(r => {
            console.log(`   ${r.endpoint}: ${r.stats?.avg || 'N/A'}ms (${r.status})`);
          });
      }

      // Save results
      const filePath = await this.saveResults();
      console.log(`\n💾 Demo results saved to: ${filePath}`);

      console.log('\n📋 IMPLEMENTATION NOTES:');
      console.log('========================');
      console.log('✅ API performance testing framework implemented');
      console.log('✅ Response time threshold validation (<200ms)');
      console.log('✅ Critical endpoint identification and testing');
      console.log('✅ Concurrent load testing capability');
      console.log('✅ Statistical analysis and reporting');
      console.log('✅ Results persistence and tracking');
      console.log('');
      console.log('🔧 To run against live API:');
      console.log('   1. Start the DirectFanz server: npm run dev');
      console.log('   2. Run: npm run perf:api:quick');
      console.log('   3. For production: npm run perf:api:full');

      return {
        success: summary.requirementsMet,
        summary,
        results: this.results
      };

    } catch (error) {
      console.error('\n❌ API performance test demo failed:', error);
      throw error;
    }
  }
}

// Run the demo
const demo = new APIPerformanceTestDemo();
demo.runDemo()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });