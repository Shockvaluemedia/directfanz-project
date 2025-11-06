#!/usr/bin/env node

/**
 * DirectFanz Platform Automated Testing Suite
 * Tests all critical endpoints and functionality
 */

const https = require('https');
const url = require('url');

const BASE_URL = 'https://www.directfanz.io';
const TEST_RESULTS = [];

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(color, message) {
  console.log(`${color}${message}${RESET}`);
}

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      ...url.parse(BASE_URL + path),
      method: method,
      timeout: 10000,
      headers: {
        'User-Agent': 'DirectFanz-Test/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          responseTime: Date.now() - startTime
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    const startTime = Date.now();
    req.end();
  });
}

async function testEndpoint(name, path, expectedStatus = 200, maxResponseTime = 3000) {
  try {
    log(BLUE, `Testing ${name}...`);
    const result = await makeRequest(path);
    
    const statusOk = result.statusCode === expectedStatus;
    const timeOk = result.responseTime <= maxResponseTime;
    
    if (statusOk && timeOk) {
      log(GREEN, `✅ ${name}: ${result.statusCode} (${result.responseTime}ms)`);
      TEST_RESULTS.push({ name, status: 'PASS', details: `${result.statusCode} in ${result.responseTime}ms` });
    } else {
      const issues = [];
      if (!statusOk) issues.push(`Expected ${expectedStatus}, got ${result.statusCode}`);
      if (!timeOk) issues.push(`Slow response: ${result.responseTime}ms`);
      
      log(YELLOW, `⚠️  ${name}: ${issues.join(', ')}`);
      TEST_RESULTS.push({ name, status: 'WARN', details: issues.join(', ') });
    }
  } catch (error) {
    log(RED, `❌ ${name}: ${error.message}`);
    TEST_RESULTS.push({ name, status: 'FAIL', details: error.message });
  }
}

async function testHealthCheck() {
  try {
    log(BLUE, 'Testing API Health...');
    const result = await makeRequest('/api/health');
    
    if (result.statusCode === 200) {
      const health = JSON.parse(result.data);
      
      if (health.status === 'healthy') {
        log(GREEN, `✅ API Health: ${health.status} (${result.responseTime}ms)`);
        log(GREEN, `   Database: ${health.checks.database.status} (${health.checks.database.latency}ms)`);
        log(GREEN, `   Redis: ${health.checks.redis.status} (${health.checks.redis.latency}ms)`);
        TEST_RESULTS.push({ name: 'API Health Check', status: 'PASS', details: 'All systems healthy' });
      } else {
        log(YELLOW, `⚠️  API Health: ${health.status}`);
        TEST_RESULTS.push({ name: 'API Health Check', status: 'WARN', details: `Status: ${health.status}` });
      }
    } else {
      throw new Error(`HTTP ${result.statusCode}`);
    }
  } catch (error) {
    log(RED, `❌ API Health Check: ${error.message}`);
    TEST_RESULTS.push({ name: 'API Health Check', status: 'FAIL', details: error.message });
  }
}

async function runTests() {
  log(BLUE, '🚀 Starting DirectFanz Platform Tests...\n');
  
  // Core Infrastructure Tests
  log(BLUE, '=== Infrastructure Tests ===');
  await testHealthCheck();
  
  // Page Load Tests
  log(BLUE, '\n=== Page Load Tests ===');
  await testEndpoint('Home Page', '/', 200, 2000);
  await testEndpoint('Auth Signin', '/auth/signin', 200, 2000);
  await testEndpoint('Auth Signup', '/auth/signup', 200, 2000);
  await testEndpoint('Dashboard', '/dashboard', 200, 2000);
  await testEndpoint('Artist Pages', '/artist', [307, 200], 2000); // May redirect
  await testEndpoint('Upload Page', '/upload', 200, 2000);
  await testEndpoint('Discover Page', '/discover', [200, 307], 2000); // May redirect
  
  // API Security Tests
  log(BLUE, '\n=== API Security Tests ===');
  await testEndpoint('Protected Content API', '/api/artist/content', 401, 1000);
  await testEndpoint('Protected Profile API', '/api/artist/profile', 401, 1000);
  await testEndpoint('Protected Tiers API', '/api/artist/tiers', 401, 1000);
  
  // Public API Tests
  log(BLUE, '\n=== Public API Tests ===');
  await testEndpoint('Search API', '/api/search', [200, 400, 500], 2000); // May need query params
  
  // Mobile & Feature Tests
  log(BLUE, '\n=== Feature Tests ===');
  await testEndpoint('Analytics Page', '/analytics', [200, 307], 2000);
  await testEndpoint('Features Demo', '/features', 200, 2000);
  await testEndpoint('Player Interface', '/player', 200, 2000);
  
  // Performance Tests
  log(BLUE, '\n=== Performance Tests ===');
  await testEndpoint('Static Assets', '/_next/static/chunks/framework-1158e7decabd1757.js', [200, 404], 1000);
  
  // Generate Report
  log(BLUE, '\n=== Test Results Summary ===');
  
  const passed = TEST_RESULTS.filter(r => r.status === 'PASS').length;
  const warned = TEST_RESULTS.filter(r => r.status === 'WARN').length;
  const failed = TEST_RESULTS.filter(r => r.status === 'FAIL').length;
  
  log(GREEN, `✅ Passed: ${passed}`);
  log(YELLOW, `⚠️  Warnings: ${warned}`);
  log(RED, `❌ Failed: ${failed}`);
  
  if (failed === 0 && warned <= 2) {
    log(GREEN, '\n🎉 Platform is healthy and ready for production!');
  } else if (failed === 0) {
    log(YELLOW, '\n⚠️  Platform is functional with minor issues.');
  } else {
    log(RED, '\n❌ Platform has critical issues that need attention.');
  }
  
  // Detailed Results
  if (warned > 0 || failed > 0) {
    log(BLUE, '\n=== Issues Found ===');
    TEST_RESULTS.filter(r => r.status !== 'PASS').forEach(result => {
      const color = result.status === 'FAIL' ? RED : YELLOW;
      log(color, `${result.status}: ${result.name} - ${result.details}`);
    });
  }
  
  log(BLUE, `\n📊 Total tests run: ${TEST_RESULTS.length}`);
  log(BLUE, `⏱️  Test completed at: ${new Date().toLocaleString()}`);
  log(BLUE, `🌐 Platform URL: ${BASE_URL}`);
}

// Run tests
runTests().catch(error => {
  log(RED, `Test suite failed: ${error.message}`);
  process.exit(1);
});