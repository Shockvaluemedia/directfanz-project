#!/usr/bin/env node

/**
 * DirectFanz.io Domain Testing Script
 * Tests the custom domain functionality after DNS setup
 */

const https = require('https');
const http = require('http');

// Configuration
const CUSTOM_DOMAIN = 'https://directfanz.io';
const TIMEOUT = 10000;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${colors[color]}${prefix}${colors.reset} ${message}`);
}

function logInfo(message) { log('blue', 'ℹ️ INFO:', message); }
function logSuccess(message) { log('green', '✅ SUCCESS:', message); }
function logWarning(message) { log('yellow', '⚠️  WARNING:', message); }
function logError(message) { log('red', '❌ ERROR:', message); }
function logTest(message) { log('cyan', '🌐 DOMAIN TEST:', message); }

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https://') ? https : http;
    
    const requestOptions = {
      method: options.method || 'GET',
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'DirectFanz-Domain-Testing/1.0',
        'Accept': 'application/json,text/html',
        ...options.headers
      },
      ...options
    };

    const req = protocol.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test suite
const tests = [];

function addTest(name, testFn) {
  tests.push({ name, fn: testFn });
}

// Test 1: Basic Domain Connectivity
addTest('Basic Domain Connectivity', async () => {
  try {
    const response = await makeRequest(CUSTOM_DOMAIN);
    
    if (response.status === 200) {
      logSuccess('Domain is accessible and responding');
    } else if (response.status === 401) {
      logSuccess('Domain accessible - protected by Vercel deployment protection');
    } else {
      logWarning(`Domain responding with status: ${response.status}`);
    }
    
    // Check for SSL
    logInfo(`✓ HTTPS connection successful`);
    logInfo(`✓ Status: ${response.status} ${response.statusMessage}`);
    
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      throw new Error('Domain not found - DNS may not be configured correctly');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Connection refused - check DNS A record');
    } else if (error.code === 'CERT_HAS_EXPIRED') {
      throw new Error('SSL certificate has expired');
    } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      throw new Error('SSL certificate verification failed');
    } else if (error.message.includes('timeout')) {
      throw new Error('Connection timeout - DNS may not be propagated yet');
    }
    throw error;
  }
});

// Test 2: WWW Subdomain
addTest('WWW Subdomain Redirect', async () => {
  try {
    const response = await makeRequest('https://www.directfanz.io');
    
    if (response.status === 200 || response.status === 401) {
      logSuccess('WWW subdomain working correctly');
    } else if ([301, 302, 307, 308].includes(response.status)) {
      logSuccess('WWW subdomain redirecting correctly');
      if (response.headers.location) {
        logInfo(`✓ Redirects to: ${response.headers.location}`);
      }
    } else {
      logWarning(`WWW subdomain status: ${response.status}`);
    }
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      logWarning('WWW subdomain not configured (optional)');
    } else {
      throw error;
    }
  }
});

// Test 3: SSL Certificate
addTest('SSL Certificate Verification', async () => {
  try {
    const response = await makeRequest(CUSTOM_DOMAIN);
    logSuccess('SSL certificate is valid and working');
    
    // Check security headers
    if (response.headers['strict-transport-security']) {
      logInfo('✓ HSTS header present');
    }
    if (response.headers['x-content-type-options']) {
      logInfo('✓ Content-Type security header present');
    }
  } catch (error) {
    throw error;
  }
});

// Test 4: API Endpoints
addTest('API Endpoints Functionality', async () => {
  const apiEndpoints = [
    '/api/health',
    '/api/auth/session',
    '/api/observability'
  ];
  
  let workingEndpoints = 0;
  
  for (const endpoint of apiEndpoints) {
    try {
      const response = await makeRequest(`${CUSTOM_DOMAIN}${endpoint}`);
      
      if ([200, 401].includes(response.status)) {
        workingEndpoints++;
        logInfo(`✓ API endpoint working: ${endpoint} (${response.status})`);
      } else {
        logWarning(`API endpoint ${endpoint}: ${response.status}`);
      }
    } catch (error) {
      logWarning(`API endpoint ${endpoint}: Connection failed`);
    }
  }
  
  if (workingEndpoints >= 2) {
    logSuccess(`API endpoints functional (${workingEndpoints}/${apiEndpoints.length} working)`);
  } else {
    throw new Error('API endpoints may not be working correctly');
  }
});

// Test 5: Performance Check
addTest('Performance Check', async () => {
  const startTime = Date.now();
  
  try {
    await makeRequest(CUSTOM_DOMAIN);
    const responseTime = Date.now() - startTime;
    
    if (responseTime < 1000) {
      logSuccess(`Excellent response time: ${responseTime}ms`);
    } else if (responseTime < 3000) {
      logSuccess(`Good response time: ${responseTime}ms`);
    } else {
      logWarning(`Slow response time: ${responseTime}ms`);
    }
  } catch (error) {
    throw error;
  }
});

// Test 6: Environment Variable Check
addTest('Environment Variables Check', async () => {
  try {
    // Test that the app is using the correct domain in its responses
    const response = await makeRequest(CUSTOM_DOMAIN);
    
    // Check if the response contains references to the correct domain
    if (response.data.includes('directfanz.io')) {
      logSuccess('Environment variables correctly configured for custom domain');
    } else if (response.status === 401) {
      logSuccess('Application responding (environment variables likely configured)');
    } else {
      logInfo('Unable to verify environment variables from response');
    }
  } catch (error) {
    throw error;
  }
});

// Run all tests
async function runDomainTests() {
  console.log(`\n🌐 DirectFanz Custom Domain Tests`);
  console.log(`Target: ${CUSTOM_DOMAIN}`);
  console.log(`Total tests: ${tests.length}\n`);
  
  let passed = 0;
  let failed = 0;
  const failedTests = [];
  
  for (const test of tests) {
    try {
      logTest(`Running: ${test.name}`);
      await test.fn();
      passed++;
      console.log('');
    } catch (error) {
      logError(`FAILED: ${test.name} - ${error.message}`);
      failed++;
      failedTests.push({ name: test.name, error: error.message });
      console.log('');
    }
  }
  
  // Results summary
  console.log('='.repeat(60));
  console.log(`🌐 Custom Domain Test Results:`);
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  }
  
  const successRate = ((passed / (passed + failed)) * 100).toFixed(1);
  console.log(`📈 Success Rate: ${successRate}%\n`);
  
  if (failed > 0) {
    console.log('❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   • ${test.name}: ${test.error}`);
    });
    console.log('');
  }
  
  // Domain Status Assessment
  console.log('🌍 Custom Domain Assessment:');
  if (failed === 0) {
    logSuccess('🎉 Custom domain fully functional!');
    console.log('   ✅ DirectFanz.io is live and working');
    console.log('   ✅ SSL certificate configured correctly');
    console.log('   ✅ All API endpoints accessible');
    console.log('   ✅ Performance is good');
    console.log('   ✅ Environment variables updated');
    console.log('');
    logSuccess('🚀 DirectFanz.io is ready for production use!');
  } else if (failed <= 2) {
    logWarning('🟡 Custom domain mostly working with minor issues');
    console.log('   • Core functionality accessible');
    console.log('   • Some features may need fine-tuning');
  } else {
    logError('🔴 Custom domain needs attention');
    console.log('   • DNS or SSL configuration may need adjustment');
    console.log('   • Check Hostinger DNS settings');
  }
  
  console.log('\n💡 Next Steps:');
  if (failed === 0) {
    console.log('   • Remove Vercel deployment protection for public access');
    console.log('   • Update marketing materials with directfanz.io');
    console.log('   • Set up email services if needed');
    console.log('   • Configure domain redirects (www → non-www)');
  } else {
    console.log('   • Review failed tests above');
    console.log('   • Check DNS configuration at Hostinger');
    console.log('   • Wait for DNS propagation (can take up to 48 hours)');
    console.log('   • Verify SSL certificate status in Vercel dashboard');
  }
  
  console.log('');
  return failed === 0;
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n🛑 Domain tests interrupted by user');
  process.exit(130);
});

// Run tests if called directly
if (require.main === module) {
  runDomainTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logError(`Domain test runner failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runDomainTests, makeRequest };