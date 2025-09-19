#!/usr/bin/env node

import https from 'https';
import http from 'http';
import fs from 'fs';
import { URL } from 'url';
import { fileURLToPath } from 'url';

const TEST_TIMEOUT = 30000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000;

class SmokeTestRunner {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || process.env.TEST_URL || 'http://localhost:3000';
    this.tests = [
      { name: 'Health Check', path: '/api/health', method: 'GET', expectedStatus: 200 },
      { name: 'Metrics Endpoint', path: '/api/metrics', method: 'GET', expectedStatus: 200 },
      { name: 'Home Page', path: '/', method: 'GET', expectedStatus: 200 },
      { name: 'Sign In Page', path: '/auth/signin', method: 'GET', expectedStatus: 200 },
      { name: 'Sign Up Page', path: '/auth/signup', method: 'GET', expectedStatus: 200 },
      { name: 'Discover Page', path: '/discover', method: 'GET', expectedStatus: 200 },
    ];
    this.results = [];
  }

  async makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const requestModule = url.protocol === 'https:' ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        timeout: TEST_TIMEOUT,
        headers: {
          'User-Agent': 'Smoke-Test/1.0',
          Accept: 'text/html,application/json,*/*',
        },
      };

      const req = requestModule.request(options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body: data,
            responseTime: Date.now() - startTime,
          });
        });
      });

      const startTime = Date.now();

      req.on('error', err => {
        reject(new Error(`Request failed: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${TEST_TIMEOUT}ms`));
      });

      req.end();
    });
  }

  async runTest(test, attempt = 1) {
    console.log(`Running test: ${test.name} (attempt ${attempt}/${RETRY_ATTEMPTS})`);

    try {
      const result = await this.makeRequest(test.path, test.method);
      const passed = result.statusCode === test.expectedStatus;

      const testResult = {
        name: test.name,
        path: test.path,
        method: test.method,
        expectedStatus: test.expectedStatus,
        actualStatus: result.statusCode,
        responseTime: result.responseTime,
        passed,
        attempt,
        error: null,
      };

      if (passed) {
        console.log(`✅ ${test.name}: ${result.statusCode} (${result.responseTime}ms)`);
        return testResult;
      } else {
        console.log(`❌ ${test.name}: Expected ${test.expectedStatus}, got ${result.statusCode}`);

        if (attempt < RETRY_ATTEMPTS) {
          console.log(`   Retrying in ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return this.runTest(test, attempt + 1);
        }

        return testResult;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);

      if (attempt < RETRY_ATTEMPTS) {
        console.log(`   Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.runTest(test, attempt + 1);
      }

      return {
        name: test.name,
        path: test.path,
        method: test.method,
        expectedStatus: test.expectedStatus,
        actualStatus: null,
        responseTime: null,
        passed: false,
        attempt,
        error: error.message,
      };
    }
  }

  async runAllTests() {
    console.log(`🧪 Running smoke tests against: ${this.baseUrl}`);
    console.log('═'.repeat(60));

    const startTime = Date.now();

    for (const test of this.tests) {
      const result = await this.runTest(test);
      this.results.push(result);
    }

    const totalTime = Date.now() - startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log('═'.repeat(60));
    console.log(`📊 Test Results:`);
    console.log(`   Total: ${this.results.length}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Duration: ${totalTime}ms`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(
            `   - ${result.name}: ${result.error || `Expected ${result.expectedStatus}, got ${result.actualStatus}`}`
          );
        });
    }

    // Generate JSON report for CI
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      summary: {
        total: this.results.length,
        passed,
        failed,
        duration: totalTime,
      },
      tests: this.results,
    };

    // Write report to file if in CI environment
    if (process.env.CI) {
      fs.writeFileSync('smoke-test-report.json', JSON.stringify(report, null, 2));
      console.log('\n📄 Report written to smoke-test-report.json');
    }

    return failed === 0;
  }
}

// Health check specific tests
class HealthCheckTests {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async checkDatabaseConnectivity() {
    try {
      const runner = new SmokeTestRunner(this.baseUrl);
      const response = await runner.makeRequest('/api/health');

      if (response.statusCode !== 200) {
        throw new Error(`Health check failed with status ${response.statusCode}`);
      }

      const healthData = JSON.parse(response.body);

      if (healthData.status !== 'healthy') {
        throw new Error(`Application is not healthy: ${JSON.stringify(healthData)}`);
      }

      if (healthData.checks) {
        const failedChecks = Object.entries(healthData.checks)
          .filter(([, check]) => check.status !== 'ok')
          .map(([name]) => name);

        if (failedChecks.length > 0) {
          throw new Error(`Failed health checks: ${failedChecks.join(', ')}`);
        }
      }

      console.log('✅ Health check passed - all systems operational');
      return true;
    } catch (error) {
      console.log(`❌ Health check failed: ${error.message}`);
      return false;
    }
  }
}

async function main() {
  const baseUrl = process.argv[2] || process.env.TEST_URL || 'http://localhost:3000';

  console.log(`🚀 Starting smoke tests for: ${baseUrl}`);

  // Run health check first
  const healthCheck = new HealthCheckTests(baseUrl);
  const isHealthy = await healthCheck.checkDatabaseConnectivity();

  if (!isHealthy) {
    console.error('❌ Health check failed - skipping other tests');
    process.exit(1);
  }

  // Run main smoke tests
  const runner = new SmokeTestRunner(baseUrl);
  const success = await runner.runAllTests();

  if (success) {
    console.log('\n🎉 All smoke tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some smoke tests failed!');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Smoke tests interrupted by SIGTERM');
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('Smoke tests interrupted by SIGINT');
  process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const isMainModule = import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  main().catch(error => {
    console.error('Smoke test runner error:', error);
    process.exit(1);
  });
}

export { SmokeTestRunner, HealthCheckTests };
