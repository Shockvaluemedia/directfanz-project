#!/usr/bin/env node

/**
 * Performance Test Suite
 *
 * Comprehensive automated testing suite for database performance
 * Includes load testing, stress testing, and comparison with baselines
 */

import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { PerformanceBaseline } from './performance-baseline.js';

const prisma = new PrismaClient();

class PerformanceTestSuite {
  constructor(options = {}) {
    this.options = {
      iterations: options.iterations || 10,
      concurrency: options.concurrency || 5,
      loadTestDuration: options.loadTestDuration || 30, // seconds
      slowQueryThreshold: options.slowQueryThreshold || 1000, // ms
      ...options,
    };

    this.results = {};
    this.startTime = new Date().toISOString();
    this.baselineData = null;
  }

  async loadBaseline(baselineFile = null) {
    const resultsDir = path.join(process.cwd(), 'performance-results');

    if (baselineFile) {
      const baselinePath = path.join(resultsDir, baselineFile);
      try {
        const data = await fs.readFile(baselinePath, 'utf8');
        this.baselineData = JSON.parse(data);
        console.log(`📊 Loaded baseline from: ${baselineFile}`);
        return true;
      } catch (error) {
        console.warn(`⚠️ Could not load baseline file: ${error.message}`);
      }
    }

    // Try to find the most recent baseline file
    try {
      const files = await fs.readdir(resultsDir);
      const baselineFiles = files
        .filter(f => f.startsWith('performance-baseline-'))
        .sort()
        .reverse();

      if (baselineFiles.length > 0) {
        const latestBaseline = baselineFiles[0];
        const data = await fs.readFile(path.join(resultsDir, latestBaseline), 'utf8');
        this.baselineData = JSON.parse(data);
        console.log(`📊 Loaded latest baseline: ${latestBaseline}`);
        return true;
      }
    } catch (error) {
      console.warn(`⚠️ Could not auto-load baseline: ${error.message}`);
    }

    return false;
  }

  async measureQueryWithStats(name, queryFunction, description = '') {
    console.log(`\n🔍 Testing ${name}...`);
    const times = [];
    const errors = [];
    let successCount = 0;

    try {
      // Warm up
      await queryFunction();

      // Run iterations
      for (let i = 0; i < this.options.iterations; i++) {
        try {
          const start = performance.now();
          await queryFunction();
          const duration = performance.now() - start;
          times.push(duration);
          successCount++;

          process.stdout.write(`  ${i + 1}/${this.options.iterations}: ${duration.toFixed(2)}ms\r`);
        } catch (error) {
          errors.push(error.message);
        }
      }

      const stats = this.calculateStats(times);
      const errorRate = errors.length / this.options.iterations;

      // Compare with baseline if available
      let comparison = null;
      if (this.baselineData && this.baselineData.results[name]) {
        const baseline = this.baselineData.results[name];
        const improvement =
          baseline.avg > 0 ? (((baseline.avg - stats.avg) / baseline.avg) * 100).toFixed(1) : 'N/A';

        comparison = {
          baselineAvg: baseline.avg,
          currentAvg: stats.avg,
          improvement: `${improvement}%`,
          status: parseFloat(improvement) > 0 ? 'improved' : 'degraded',
        };
      }

      this.results[name] = {
        description,
        ...stats,
        successCount,
        errorCount: errors.length,
        errorRate: parseFloat((errorRate * 100).toFixed(2)),
        errors: errors.slice(0, 5), // Keep first 5 errors
        status: errors.length === 0 ? 'success' : 'partial',
        comparison,
        iterations: this.options.iterations,
      };

      const statusIcon = errors.length === 0 ? '✅' : '⚠️';
      const comparisonText = comparison ? `(${comparison.improvement} vs baseline)` : '';

      console.log(`\n  ${statusIcon} Avg: ${stats.avg}ms ${comparisonText}`);

      if (errors.length > 0) {
        console.log(`     ⚠️ ${errors.length} errors (${(errorRate * 100).toFixed(1)}%)`);
      }
    } catch (error) {
      this.results[name] = {
        description,
        error: error.message,
        status: 'error',
        iterations: this.options.iterations,
      };
      console.log(`\n  ❌ Error: ${error.message}`);
    }
  }

  calculateStats(times) {
    if (times.length === 0) return { avg: 0, min: 0, max: 0, median: 0, p95: 0, p99: 0 };

    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      avg: parseFloat(avg.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      median: parseFloat(median.toFixed(2)),
      p95: parseFloat(p95.toFixed(2)),
      p99: parseFloat(p99.toFixed(2)),
      times: times.length <= 20 ? times : times.slice(0, 20), // Keep sample
    };
  }

  async runConcurrentTest(name, queryFunction, description = '') {
    console.log(`\n🔄 Concurrent test: ${name} (${this.options.concurrency} concurrent)...`);

    const startTime = performance.now();
    const promises = [];
    const results = [];

    for (let i = 0; i < this.options.concurrency; i++) {
      promises.push(
        (async () => {
          const times = [];
          const errors = [];

          for (let j = 0; j < Math.ceil(this.options.iterations / this.options.concurrency); j++) {
            try {
              const start = performance.now();
              await queryFunction();
              times.push(performance.now() - start);
            } catch (error) {
              errors.push(error.message);
            }
          }

          return { times, errors };
        })()
      );
    }

    const concurrentResults = await Promise.all(promises);
    const allTimes = concurrentResults.flatMap(r => r.times);
    const allErrors = concurrentResults.flatMap(r => r.errors);

    const totalTime = performance.now() - startTime;
    const throughput = allTimes.length / (totalTime / 1000); // queries per second

    const stats = this.calculateStats(allTimes);
    const errorRate = allErrors.length / (allTimes.length + allErrors.length);

    this.results[`${name}_concurrent`] = {
      description: `${description} (concurrent)`,
      ...stats,
      throughput: parseFloat(throughput.toFixed(2)),
      concurrency: this.options.concurrency,
      totalQueries: allTimes.length + allErrors.length,
      successCount: allTimes.length,
      errorCount: allErrors.length,
      errorRate: parseFloat((errorRate * 100).toFixed(2)),
      totalTime: parseFloat(totalTime.toFixed(2)),
      status: allErrors.length === 0 ? 'success' : 'partial',
    };

    console.log(`  ✅ Throughput: ${throughput.toFixed(2)} queries/sec`);
    console.log(`     Average: ${stats.avg}ms, Errors: ${allErrors.length}`);
  }

  async runLoadTest(name, queryFunction, description = '') {
    console.log(`\n🏋️ Load test: ${name} (${this.options.loadTestDuration}s)...`);

    const endTime = Date.now() + this.options.loadTestDuration * 1000;
    const times = [];
    const errors = [];
    let requestCount = 0;

    while (Date.now() < endTime) {
      try {
        const start = performance.now();
        await queryFunction();
        times.push(performance.now() - start);
        requestCount++;

        // Brief pause to prevent overwhelming
        if (requestCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (error) {
        errors.push(error.message);
      }
    }

    const stats = this.calculateStats(times);
    const throughput = times.length / this.options.loadTestDuration;
    const errorRate = errors.length / (times.length + errors.length);

    this.results[`${name}_load`] = {
      description: `${description} (load test)`,
      ...stats,
      throughput: parseFloat(throughput.toFixed(2)),
      duration: this.options.loadTestDuration,
      totalRequests: times.length + errors.length,
      successCount: times.length,
      errorCount: errors.length,
      errorRate: parseFloat((errorRate * 100).toFixed(2)),
      status: errors.length === 0 ? 'success' : 'partial',
    };

    console.log(
      `  ✅ Load test: ${throughput.toFixed(2)} queries/sec over ${this.options.loadTestDuration}s`
    );
    console.log(`     Requests: ${times.length + errors.length}, Errors: ${errors.length}`);
  }

  // Core test methods (similar to baseline but with enhanced metrics)
  async testCorePerformance() {
    console.log('\n🚀 === CORE PERFORMANCE TESTS ===');

    // User authentication
    await this.measureQueryWithStats(
      'user_auth_by_email',
      async () => {
        await prisma.users.findUnique({
          where: { email: 'test@example.com' },
          include: { accounts: true },
        });
      },
      'User authentication by email'
    );

    // Content discovery
    await this.measureQueryWithStats(
      'content_by_artist',
      async () => {
        await prisma.content.findMany({
          where: {
            artistId: 'test-artist-id',
            visibility: 'PUBLIC',
          },
          include: {
            users: true,
            content_likes: { take: 5 },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
      'Artist content feed with engagement'
    );

    // Subscription queries
    await this.measureQueryWithStats(
      'fan_subscriptions',
      async () => {
        await prisma.subscriptions.findMany({
          where: {
            fanId: 'test-fan-id',
            status: 'ACTIVE',
          },
          include: { tiers: true },
        });
      },
      'Fan active subscriptions'
    );

    // Trending content
    await this.measureQueryWithStats(
      'trending_content',
      async () => {
        await prisma.content.findMany({
          where: { visibility: 'PUBLIC' },
          orderBy: { totalViews: 'desc' },
          take: 20,
        });
      },
      'Trending content by views'
    );
  }

  async testConcurrentPerformance() {
    console.log('\n⚡ === CONCURRENT PERFORMANCE TESTS ===');

    // Test concurrent user authentication
    await this.runConcurrentTest(
      'user_auth',
      async () => {
        await prisma.users.findUnique({ where: { email: 'test@example.com' } });
      },
      'Concurrent user authentication'
    );

    // Test concurrent content queries
    await this.runConcurrentTest(
      'content_feed',
      async () => {
        await prisma.content.findMany({
          where: { visibility: 'PUBLIC' },
          take: 10,
        });
      },
      'Concurrent content feed'
    );
  }

  async testLoadCapacity() {
    console.log('\n🏋️ === LOAD CAPACITY TESTS ===');

    // Load test user queries
    await this.runLoadTest(
      'user_load',
      async () => {
        await prisma.users.count();
      },
      'User query load test'
    );

    // Load test content queries
    await this.runLoadTest(
      'content_load',
      async () => {
        await prisma.content.findMany({
          where: { visibility: 'PUBLIC' },
          take: 5,
        });
      },
      'Content query load test'
    );
  }

  generatePerformanceReport() {
    const successful = Object.values(this.results).filter(r => r.status === 'success').length;
    const partial = Object.values(this.results).filter(r => r.status === 'partial').length;
    const failed = Object.values(this.results).filter(r => r.status === 'error').length;

    const avgTimes = Object.values(this.results)
      .filter(r => r.avg && r.status !== 'error')
      .map(r => r.avg);

    const slowQueries = Object.entries(this.results)
      .filter(([_, r]) => r.avg && r.avg > this.options.slowQueryThreshold)
      .map(([name, result]) => ({ name, avg: result.avg }));

    // Performance improvements vs baseline
    const improvements = Object.entries(this.results)
      .filter(([_, r]) => r.comparison && r.comparison.status === 'improved')
      .map(([name, result]) => ({
        name,
        improvement: result.comparison.improvement,
        before: result.comparison.baselineAvg,
        after: result.comparison.currentAvg,
      }));

    const degradations = Object.entries(this.results)
      .filter(([_, r]) => r.comparison && r.comparison.status === 'degraded')
      .map(([name, result]) => ({
        name,
        degradation: result.comparison.improvement,
        before: result.comparison.baselineAvg,
        after: result.comparison.currentAvg,
      }));

    return {
      timestamp: this.startTime,
      options: this.options,
      summary: {
        totalTests: Object.keys(this.results).length,
        successful,
        partial,
        failed,
        overallAvg:
          avgTimes.length > 0
            ? parseFloat((avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length).toFixed(2))
            : 0,
        slowQueries: slowQueries.length,
        improvements: improvements.length,
        degradations: degradations.length,
      },
      improvements,
      degradations,
      slowQueries,
      results: this.results,
    };
  }

  async saveResults(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `performance-test-${timestamp}.json`;
    }

    const resultsDir = path.join(process.cwd(), 'performance-results');

    try {
      await fs.access(resultsDir);
    } catch {
      await fs.mkdir(resultsDir, { recursive: true });
    }

    const filePath = path.join(resultsDir, filename);
    const report = this.generatePerformanceReport();

    await fs.writeFile(filePath, JSON.stringify(report, null, 2));

    return { filePath, report };
  }

  async runFullSuite() {
    console.log('🚀 Starting Comprehensive Performance Test Suite');
    console.log(`📅 Timestamp: ${this.startTime}`);
    console.log(
      `⚙️ Config: ${this.options.iterations} iterations, ${this.options.concurrency} concurrent`
    );
    console.log('='.repeat(70));

    try {
      // Try to load baseline for comparison
      await this.loadBaseline();

      // Run all test categories
      await this.testCorePerformance();
      await this.testConcurrentPerformance();
      await this.testLoadCapacity();

      console.log('\n' + '='.repeat(70));
      console.log('✅ Performance test suite completed!');

      const { filePath, report } = await this.saveResults();

      // Display summary
      console.log('\n📊 TEST SUMMARY:');
      console.log(`   Total tests: ${report.summary.totalTests}`);
      console.log(`   Successful: ${report.summary.successful}`);
      console.log(`   Partial: ${report.summary.partial}`);
      console.log(`   Failed: ${report.summary.failed}`);
      console.log(`   Overall average: ${report.summary.overallAvg}ms`);
      console.log(
        `   Slow queries (>${this.options.slowQueryThreshold}ms): ${report.summary.slowQueries}`
      );

      if (report.improvements.length > 0) {
        console.log(`\n🎉 PERFORMANCE IMPROVEMENTS:`);
        report.improvements.forEach(imp => {
          console.log(
            `   ${imp.name}: ${imp.improvement} faster (${imp.before}ms → ${imp.after}ms)`
          );
        });
      }

      if (report.degradations.length > 0) {
        console.log(`\n⚠️ PERFORMANCE DEGRADATIONS:`);
        report.degradations.forEach(deg => {
          console.log(
            `   ${deg.name}: ${deg.degradation} slower (${deg.before}ms → ${deg.after}ms)`
          );
        });
      }

      console.log(`\n💾 Results saved to: ${filePath}`);

      return report;
    } catch (error) {
      console.error('\n❌ Performance test suite failed:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    iterations: parseInt(process.env.PERF_ITERATIONS) || 10,
    concurrency: parseInt(process.env.PERF_CONCURRENCY) || 5,
    loadTestDuration: parseInt(process.env.PERF_LOAD_DURATION) || 30,
  };

  const suite = new PerformanceTestSuite(options);

  suite
    .runFullSuite()
    .then(report => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Performance test suite failed:', error);
      process.exit(1);
    });
}

export { PerformanceTestSuite };
