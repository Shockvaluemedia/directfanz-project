#!/usr/bin/env node

/**
 * AI API Endpoint Integration Test Script
 * Tests all new AI endpoints to verify they work correctly
 * Run with: npm run test:ai-endpoints
 */

const fetch = require('node-fetch');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const AI_ENDPOINTS = [
  '/api/ai',
  '/api/ai/predictive-analytics',
  '/api/ai/revenue-optimization',
  '/api/ai/admin-operations',
  '/api/ai/revenue-stripe',
  '/api/ai/moderation'
];

// Mock JWT token for testing (in production, use real auth)
const TEST_JWT = 'Bearer test-jwt-token-for-development';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test helper functions
async function testEndpoint(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': TEST_JWT
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    log(`Testing ${method} ${endpoint}...`, 'blue');
    const start = Date.now();
    
    const response = await fetch(url, options);
    const duration = Date.now() - start;
    
    const contentType = response.headers.get('content-type');
    let responseData;
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    
    // Log result
    if (response.ok) {
      log(`  ✅ ${response.status} - ${duration}ms`, 'green');
      log(`  📄 Response: ${JSON.stringify(responseData).substring(0, 200)}...`, 'cyan');
    } else {
      log(`  ❌ ${response.status} - ${response.statusText} - ${duration}ms`, 'red');
      log(`  📄 Error: ${JSON.stringify(responseData).substring(0, 200)}...`, 'yellow');
    }
    
    return {
      endpoint,
      method,
      status: response.status,
      success: response.ok,
      duration,
      data: responseData
    };
    
  } catch (error) {
    log(`  💥 Network Error: ${error.message}`, 'red');
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      duration: 0,
      error: error.message
    };
  }
}

async function testServerHealth() {
  log('\n🏥 Testing server health...', 'magenta');
  
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { 
      method: 'GET',
      timeout: 5000 
    });
    
    if (response.ok) {
      const health = await response.json();
      log('  ✅ Server is healthy', 'green');
      return true;
    } else {
      log('  ❌ Server health check failed', 'red');
      return false;
    }
  } catch (error) {
    log(`  💥 Cannot connect to server: ${error.message}`, 'red');
    log(`  📍 Make sure the server is running on ${BASE_URL}`, 'yellow');
    return false;
  }
}

async function runAIEndpointTests() {
  log('🤖 DirectFanZ AI Endpoint Integration Tests', 'magenta');
  log('=' .repeat(50), 'blue');
  
  // Check server health first
  const isHealthy = await testServerHealth();
  if (!isHealthy) {
    log('\n❌ Cannot run tests - server is not accessible', 'red');
    process.exit(1);
  }
  
  const results = [];
  
  log('\n📋 Testing AI endpoints...', 'magenta');
  
  // Test main AI router
  const mainResult = await testEndpoint('/api/ai');
  results.push(mainResult);
  
  // Test each AI agent endpoint (GET)
  for (const endpoint of AI_ENDPOINTS.slice(1)) {
    const result = await testEndpoint(endpoint);
    results.push(result);
  }
  
  // Test POST endpoints with sample data
  log('\n📤 Testing POST endpoints...', 'magenta');
  
  // Test Predictive Analytics POST
  const analyticsPostResult = await testEndpoint('/api/ai/predictive-analytics', 'POST', {
    task: 'trend_analysis',
    userId: 'test-user-id',
    timeframe: '30d'
  });
  results.push(analyticsPostResult);
  
  // Test Revenue Optimization POST
  const revenuePostResult = await testEndpoint('/api/ai/revenue-optimization', 'POST', {
    task: 'pricing_optimization',
    userId: 'test-user-id',
    targetMetric: 'revenue'
  });
  results.push(revenuePostResult);
  
  // Test Admin Operations POST (if user is admin)
  const adminPostResult = await testEndpoint('/api/ai/admin-operations', 'POST', {
    operation: 'system_health_check',
    parameters: { includeMetrics: true }
  });
  results.push(adminPostResult);
  
  // Test Revenue Stripe POST
  const stripePostResult = await testEndpoint('/api/ai/revenue-stripe', 'POST', {
    action: 'analyze_performance',
    timeframe: '30d'
  });
  results.push(stripePostResult);
  
  // Test Content Moderation POST
  const moderationPostResult = await testEndpoint('/api/ai/moderation', 'POST', {
    contentIds: ['test-content-id'],
    moderationType: 'quick'
  });
  results.push(moderationPostResult);
  
  // Summary
  log('\n📊 Test Results Summary', 'magenta');
  log('=' .repeat(50), 'blue');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  log(`Total Endpoints Tested: ${results.length}`, 'blue');
  log(`✅ Successful: ${successful.length}`, 'green');
  log(`❌ Failed: ${failed.length}`, failed.length > 0 ? 'red' : 'green');
  log(`⏱️  Average Response Time: ${Math.round(avgDuration)}ms`, 'cyan');
  
  if (failed.length > 0) {
    log('\n🔴 Failed Endpoints:', 'red');
    failed.forEach(result => {
      log(`  • ${result.method} ${result.endpoint} - ${result.status || 'Network Error'}`, 'yellow');
      if (result.error) {
        log(`    Error: ${result.error}`, 'red');
      }
    });
  }
  
  // Performance analysis
  log('\n⚡ Performance Analysis:', 'cyan');
  const fastEndpoints = results.filter(r => r.success && r.duration < 1000);
  const slowEndpoints = results.filter(r => r.success && r.duration >= 1000);
  
  log(`Fast responses (<1s): ${fastEndpoints.length}`, 'green');
  log(`Slow responses (≥1s): ${slowEndpoints.length}`, slowEndpoints.length > 0 ? 'yellow' : 'green');
  
  if (slowEndpoints.length > 0) {
    log('Slow endpoints:', 'yellow');
    slowEndpoints.forEach(result => {
      log(`  • ${result.endpoint} - ${result.duration}ms`, 'yellow');
    });
  }
  
  // Exit with appropriate code
  const exitCode = failed.length > 0 ? 1 : 0;
  
  if (exitCode === 0) {
    log('\n🎉 All AI endpoint tests passed!', 'green');
    log('✨ Your AI features are ready for deployment', 'cyan');
  } else {
    log('\n💥 Some AI endpoint tests failed', 'red');
    log('🔧 Please check the server logs and fix the issues', 'yellow');
  }
  
  process.exit(exitCode);
}

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
  log('💥 Unhandled Rejection:', 'red');
  console.error(reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log('💥 Uncaught Exception:', 'red');
  console.error(error);
  process.exit(1);
});

// Run tests if script is executed directly
if (require.main === module) {
  runAIEndpointTests().catch(error => {
    log('💥 Test execution failed:', 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runAIEndpointTests,
  testEndpoint,
  testServerHealth
};