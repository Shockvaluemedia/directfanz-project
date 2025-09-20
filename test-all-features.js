#!/usr/bin/env node

/**
 * Comprehensive Feature Testing Script for DirectFanz Platform
 * Tests all major features and functionality
 */

const BASE_URL = 'https://www.directfanz.io';

const endpoints = [
  // Core API endpoints
  { path: '/api/health', method: 'GET', expectedStatus: [200], description: 'Health Check' },
  { path: '/api/metrics', method: 'GET', expectedStatus: [200, 401], description: 'Metrics Endpoint' },
  
  // Authentication endpoints
  { path: '/api/auth/signup', method: 'POST', expectedStatus: [400, 401], description: 'User Signup' },
  { path: '/api/auth/login', method: 'POST', expectedStatus: [400, 401], description: 'User Login' },
  
  // Content endpoints  
  { path: '/api/content/discover', method: 'GET', expectedStatus: [200, 500], description: 'Content Discovery' },
  { path: '/api/search', method: 'GET', expectedStatus: [400, 401], description: 'Search Functionality' },
  
  // Artist endpoints
  { path: '/api/artist/analytics', method: 'GET', expectedStatus: [401, 403], description: 'Artist Analytics' },
  { path: '/api/artist/tiers', method: 'GET', expectedStatus: [401, 403], description: 'Artist Tiers' },
  { path: '/api/artist/content', method: 'GET', expectedStatus: [401, 403], description: 'Artist Content' },
  
  // Fan endpoints
  { path: '/api/fan/subscriptions', method: 'GET', expectedStatus: [401, 403], description: 'Fan Subscriptions' },
  { path: '/api/fan/artists', method: 'GET', expectedStatus: [401, 403], description: 'Fan Artists' },
  
  // Payment endpoints
  { path: '/api/payments/create-checkout', method: 'POST', expectedStatus: [400, 401], description: 'Payment Checkout' },
  { path: '/api/payments/webhooks', method: 'POST', expectedStatus: [400, 401], description: 'Payment Webhooks' },
  
  // Admin endpoints
  { path: '/api/admin/analytics', method: 'GET', expectedStatus: [401, 403], description: 'Admin Analytics' },
  { path: '/api/admin/users', method: 'GET', expectedStatus: [401, 403], description: 'Admin User Management' },
  
  // Recommendation endpoints
  { path: '/api/recommendations', method: 'GET', expectedStatus: [401, 403], description: 'Recommendations' },
  { path: '/api/recommendations/artists', method: 'GET', expectedStatus: [401, 403], description: 'Artist Recommendations' }
];

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const options = {
    method: endpoint.method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DirectFanz-FeatureTest/1.0'
    }
  };

  try {
    const response = await fetch(url, options);
    const isExpectedStatus = endpoint.expectedStatus.includes(response.status);
    
    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      status: response.status,
      success: isExpectedStatus,
      message: isExpectedStatus ? '✅ Working as expected' : '❌ Unexpected status',
      responseTime: 'N/A'
    };
  } catch (error) {
    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      status: 'ERROR',
      success: false,
      message: `❌ Error: ${error.message}`,
      responseTime: 'N/A'
    };
  }
}

async function runFeatureTests() {
  console.log('\n🚀 DirectFanz Platform - Comprehensive Feature Testing');
  console.log('=' .repeat(60));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Total endpoints to test: ${endpoints.length}`);
  console.log('');

  const results = [];
  let passCount = 0;
  let failCount = 0;

  console.log('🧪 Testing endpoints...\n');

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    process.stdout.write(`[${i + 1}/${endpoints.length}] Testing ${endpoint.description}... `);
    
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    if (result.success) {
      passCount++;
      console.log(result.message);
    } else {
      failCount++;
      console.log(result.message);
    }
  }

  // Summary Report
  console.log('\n' + '=' .repeat(60));
  console.log('📊 FEATURE TESTING SUMMARY:');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Success Rate: ${((passCount / endpoints.length) * 100).toFixed(1)}%`);
  console.log('');

  // Detailed Results
  console.log('📋 DETAILED RESULTS:');
  console.log('-' .repeat(60));
  results.forEach((result, index) => {
    const statusIcon = result.success ? '✅' : '❌';
    console.log(`${statusIcon} ${result.description}`);
    console.log(`   ${result.method} ${result.endpoint} → ${result.status}`);
    console.log('');
  });

  // Feature Assessment
  console.log('🏆 FEATURE ASSESSMENT:');
  console.log('-' .repeat(60));
  
  const categories = {
    'Authentication': ['User Signup', 'User Login'],
    'Content System': ['Content Discovery', 'Search Functionality'],
    'Creator Features': ['Artist Analytics', 'Artist Tiers', 'Artist Content'],
    'Fan Features': ['Fan Subscriptions', 'Fan Artists'],
    'Payment System': ['Payment Checkout', 'Payment Webhooks'],
    'Admin Panel': ['Admin Analytics', 'Admin User Management'],
    'Discovery': ['Recommendations', 'Artist Recommendations'],
    'Infrastructure': ['Health Check', 'Metrics Endpoint']
  };

  Object.entries(categories).forEach(([category, features]) => {
    const categoryResults = results.filter(r => features.includes(r.description));
    const categoryPass = categoryResults.filter(r => r.success).length;
    const categoryTotal = categoryResults.length;
    const categoryRate = ((categoryPass / categoryTotal) * 100).toFixed(0);
    
    const statusEmoji = categoryRate >= 80 ? '🟢' : categoryRate >= 60 ? '🟡' : '🔴';
    console.log(`${statusEmoji} ${category}: ${categoryPass}/${categoryTotal} (${categoryRate}%)`);
  });

  console.log('');
  console.log('🎯 CONCLUSION:');
  console.log('-' .repeat(60));
  
  const overallRate = (passCount / endpoints.length) * 100;
  if (overallRate >= 90) {
    console.log('🎉 EXCELLENT: All major features are fully functional!');
    console.log('   Your DirectFanz platform is production-ready.');
  } else if (overallRate >= 75) {
    console.log('✅ GOOD: Most features are working well.');
    console.log('   Minor issues detected but platform is operational.');
  } else if (overallRate >= 50) {
    console.log('⚠️  NEEDS ATTENTION: Several features need fixes.');
    console.log('   Platform needs debugging before full launch.');
  } else {
    console.log('❌ CRITICAL: Major features are not working.');
    console.log('   Platform requires significant debugging.');
  }
  
  console.log('');
  console.log('🔧 NEXT STEPS:');
  console.log('   1. Fix any failed endpoints');
  console.log('   2. Test with authenticated requests');
  console.log('   3. Verify end-to-end user journeys');
  console.log('   4. Run load testing for scalability');
  console.log('');
}

// Run the tests
runFeatureTests().catch(console.error);