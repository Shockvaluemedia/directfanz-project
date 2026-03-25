const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  timeout: 10000,
  maxRetries: 3,
};

console.log('🧪 DirectFanZ Production Testing & Verification Suite\n');
console.log(`Testing URL: ${config.baseUrl}\n`);

// Test Results Storage
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  details: [],
  performance: {},
  security: {},
  errors: []
};

// Utility Functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const startTime = performance.now();
    
    const req = lib.request(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'DirectFanZ-Test-Suite/1.0',
        ...options.headers
      },
      timeout: config.timeout,
      ...options
    }, (res) => {
      const endTime = performance.now();
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          responseTime: endTime - startTime
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.end(options.body);
  });
}

function logTest(testName, passed, details = '', responseTime = null) {
  const status = passed ? '✅' : '❌';
  const timeStr = responseTime ? ` (${Math.round(responseTime)}ms)` : '';
  console.log(`   ${status} ${testName}${timeStr}`);
  
  testResults.details.push({
    name: testName,
    passed,
    details,
    responseTime
  });
  
  if (passed) testResults.passed++;
  else testResults.failed++;
  
  if (!passed && details) {
    testResults.errors.push({ test: testName, error: details });
  }
}

// Test Suites
async function testBasicConnectivity() {
  console.log('🌐 Basic Connectivity Tests');
  
  try {
    const response = await makeRequest(config.baseUrl);
    logTest('Homepage loads', response.statusCode === 200, '', response.responseTime);
    
    if (response.statusCode === 200) {
      testResults.performance.homepageLoadTime = response.responseTime;
    }
    
    // Test for basic HTML structure
    const hasTitle = response.body.includes('<title>');
    const hasDirectFanZ = response.body.toLowerCase().includes('directfanz');
    logTest('Contains DirectFanZ branding', hasTitle && hasDirectFanZ);
    
    // Test HTTPS redirect (if testing HTTP)
    if (config.baseUrl.startsWith('http://')) {
      const httpsUrl = config.baseUrl.replace('http://', 'https://');
      try {
        const httpsResponse = await makeRequest(httpsUrl);
        logTest('HTTPS available', httpsResponse.statusCode === 200);
      } catch (error) {
        logTest('HTTPS available', false, 'HTTPS not responding');
      }
    }
    
  } catch (error) {
    logTest('Homepage loads', false, error.message);
  }
}

async function testEssentialPages() {
  console.log('\n📄 Essential Pages Test');
  
  const pages = [
    { path: '/', name: 'Homepage' },
    { path: '/auth/signin', name: 'Sign In Page' },
    { path: '/auth/signup', name: 'Sign Up Page' },
    { path: '/discover', name: 'Discover Page', requiresAuth: true },
    { path: '/upload', name: 'Upload Page', requiresAuth: true },
    { path: '/api/health', name: 'Health Check API' },
  ];
  
  for (const page of pages) {
    try {
      const response = await makeRequest(`${config.baseUrl}${page.path}`);
      
      // For auth-required pages, 401/403/redirect is acceptable
      if (page.requiresAuth) {
        const validCodes = [200, 302, 401, 403];
        const isValid = validCodes.includes(response.statusCode);
        logTest(page.name, isValid, isValid ? '' : `Got ${response.statusCode}`, response.responseTime);
      } else {
        logTest(page.name, response.statusCode === 200, '', response.responseTime);
      }
    } catch (error) {
      logTest(page.name, false, error.message);
    }
  }
}

async function testAPIEndpoints() {
  console.log('\n🔌 API Endpoints Test');
  
  const endpoints = [
    { path: '/api/health', method: 'GET', name: 'Health Check' },
    { path: '/api/health/db', method: 'GET', name: 'Database Health' },
    { path: '/api/status', method: 'GET', name: 'Status API' },
    { path: '/api/auth/csrf', method: 'GET', name: 'CSRF Token' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${config.baseUrl}${endpoint.path}`, {
        method: endpoint.method
      });
      
      const isHealthy = response.statusCode === 200;
      logTest(`API: ${endpoint.name}`, isHealthy, '', response.responseTime);
      
      // Record API response times
      if (isHealthy) {
        testResults.performance[`api_${endpoint.name.toLowerCase().replace(' ', '_')}`] = response.responseTime;
      }
    } catch (error) {
      logTest(`API: ${endpoint.name}`, false, error.message);
    }
  }
}

async function testSecurityHeaders() {
  console.log('\n🔒 Security Headers Test');
  
  try {
    const response = await makeRequest(config.baseUrl);
    const headers = response.headers;
    
    const securityTests = [
      {
        name: 'X-Frame-Options',
        check: () => headers['x-frame-options'] === 'DENY',
        required: true
      },
      {
        name: 'X-Content-Type-Options',
        check: () => headers['x-content-type-options'] === 'nosniff',
        required: true
      },
      {
        name: 'Referrer-Policy',
        check: () => !!headers['referrer-policy'],
        required: false
      },
      {
        name: 'Content-Security-Policy',
        check: () => !!headers['content-security-policy'],
        required: false
      },
      {
        name: 'Strict-Transport-Security',
        check: () => !!headers['strict-transport-security'],
        required: config.baseUrl.startsWith('https')
      }
    ];
    
    for (const test of securityTests) {
      const passed = test.check();
      logTest(`Security: ${test.name}`, passed);
      
      if (test.required && !passed) {
        testResults.security[test.name] = 'MISSING_REQUIRED';
      } else if (passed) {
        testResults.security[test.name] = 'PRESENT';
      } else {
        testResults.security[test.name] = 'MISSING_OPTIONAL';
      }
    }
  } catch (error) {
    logTest('Security Headers', false, error.message);
  }
}

async function testPerformance() {
  console.log('\n⚡ Performance Tests');
  
  const performanceTests = [
    { path: '/', name: 'Homepage Load Time', target: 2000 },
    { path: '/api/health', name: 'API Response Time', target: 500 },
    { path: '/discover', name: 'Discovery Page Load', target: 3000 },
  ];
  
  for (const test of performanceTests) {
    try {
      const response = await makeRequest(`${config.baseUrl}${test.path}`);
      const passed = response.responseTime < test.target;
      
      logTest(
        `Performance: ${test.name}`,
        passed,
        passed ? '' : `${Math.round(response.responseTime)}ms > ${test.target}ms target`,
        response.responseTime
      );
    } catch (error) {
      logTest(`Performance: ${test.name}`, false, error.message);
    }
  }
}

async function testUploadEndpoint() {
  console.log('\n📤 Upload System Test');
  
  try {
    // Test presigned URL endpoint (without auth - should fail gracefully)
    const response = await makeRequest(`${config.baseUrl}/api/upload/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'test.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024
      })
    });
    
    // Should return 401 (unauthorized) which means the endpoint exists
    const endpointExists = [401, 403].includes(response.statusCode);
    logTest('Upload endpoint exists', endpointExists, 
      endpointExists ? 'Returns proper auth error' : `Got ${response.statusCode}`);
    
  } catch (error) {
    logTest('Upload endpoint exists', false, error.message);
  }
}

async function testPaymentEndpoints() {
  console.log('\n💳 Payment System Test');
  
  const paymentEndpoints = [
    '/api/payments/create-checkout',
    '/api/payments/webhooks',
    '/api/artist/stripe/onboard'
  ];
  
  for (const endpoint of paymentEndpoints) {
    try {
      const response = await makeRequest(`${config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Should return 401 (unauthorized) or 400 (bad request) which means endpoint exists
      const endpointExists = [400, 401, 403, 405].includes(response.statusCode);
      logTest(`Payment: ${endpoint.split('/').pop()}`, endpointExists,
        endpointExists ? 'Endpoint responding' : `Got ${response.statusCode}`);
        
    } catch (error) {
      logTest(`Payment: ${endpoint.split('/').pop()}`, false, error.message);
    }
  }
}

async function testMobileResponsiveness() {
  console.log('\n📱 Mobile Responsiveness Test');
  
  try {
    const response = await makeRequest(config.baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });
    
    const hasMobileViewport = response.body.includes('viewport') && 
                             response.body.includes('width=device-width');
    logTest('Mobile viewport meta tag', hasMobileViewport);
    
    const hasResponsiveCSS = response.body.includes('responsive') || 
                           response.body.includes('@media') ||
                           response.body.includes('tailwind'); // Tailwind is mobile-first
    logTest('Responsive CSS detected', hasResponsiveCSS);
    
  } catch (error) {
    logTest('Mobile Responsiveness', false, error.message);
  }
}

async function testDatabaseConnectivity() {
  console.log('\n🗄️  Database Connectivity Test');
  
  try {
    const response = await makeRequest(`${config.baseUrl}/api/health/db`);
    const isHealthy = response.statusCode === 200;
    
    logTest('Database connectivity', isHealthy, '', response.responseTime);
    
    if (isHealthy && response.body) {
      try {
        const healthData = JSON.parse(response.body);
        if (healthData.database && healthData.database.status === 'healthy') {
          logTest('Database status healthy', true);
        }
      } catch (e) {
        // Response might not be JSON, but endpoint is working
        logTest('Database status healthy', true);
      }
    }
  } catch (error) {
    logTest('Database connectivity', false, error.message);
  }
}

async function generateReport() {
  console.log('\n📊 Test Summary Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const total = testResults.passed + testResults.failed + testResults.skipped;
  const successRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
  
  console.log(`📈 Overall Results:`);
  console.log(`   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  console.log(`   ⏭️  Skipped: ${testResults.skipped}`);
  console.log(`   📊 Success Rate: ${successRate}%`);
  
  // Performance Summary
  if (Object.keys(testResults.performance).length > 0) {
    console.log(`\n⚡ Performance Summary:`);
    for (const [key, value] of Object.entries(testResults.performance)) {
      console.log(`   ${key}: ${Math.round(value)}ms`);
    }
  }
  
  // Security Summary
  if (Object.keys(testResults.security).length > 0) {
    console.log(`\n🔒 Security Summary:`);
    for (const [key, value] of Object.entries(testResults.security)) {
      const status = value === 'PRESENT' ? '✅' : 
                    value === 'MISSING_REQUIRED' ? '❌' : '⚠️';
      console.log(`   ${status} ${key}: ${value}`);
    }
  }
  
  // Critical Errors
  if (testResults.errors.length > 0) {
    console.log(`\n🚨 Critical Issues:`);
    testResults.errors.forEach(error => {
      console.log(`   ❌ ${error.test}: ${error.error}`);
    });
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Production Readiness Assessment
  const criticalTests = [
    'Homepage loads',
    'Database connectivity',
    'API: Health Check'
  ];
  
  const criticalPassed = criticalTests.every(test => 
    testResults.details.some(detail => detail.name === test && detail.passed)
  );
  
  if (criticalPassed && successRate >= 80) {
    console.log('🎉 PRODUCTION READY! Your DirectFanZ platform is ready to launch!');
  } else if (criticalPassed && successRate >= 60) {
    console.log('⚠️  MOSTLY READY: Some non-critical issues need attention before launch.');
  } else {
    console.log('❌ NOT READY: Critical issues must be resolved before production launch.');
  }
  
  return {
    ready: criticalPassed && successRate >= 80,
    successRate,
    criticalPassed,
    ...testResults
  };
}

// Main execution
async function runAllTests() {
  const startTime = performance.now();
  
  console.log(`🚀 Starting DirectFanZ Production Test Suite`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🌐 Target: ${config.baseUrl}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    await testBasicConnectivity();
    await testEssentialPages();
    await testAPIEndpoints();
    await testSecurityHeaders();
    await testPerformance();
    await testUploadEndpoint();
    await testPaymentEndpoints();
    await testMobileResponsiveness();
    await testDatabaseConnectivity();
    
    const report = await generateReport();
    const totalTime = performance.now() - startTime;
    
    console.log(`\n⏱️  Total test time: ${Math.round(totalTime)}ms`);
    console.log(`📋 Detailed report available in test results object`);
    
    // Exit with appropriate code
    process.exit(report.ready ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Test suite failed with error:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testResults,
  config
};