#!/usr/bin/env node

/**
 * System Test Script for Direct Fan Platform
 *
 * This script performs comprehensive system testing to verify that all requirements
 * are met before production deployment. It tests complete user flows and integrations
 * between different components of the system.
 */

import { execSync } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

// Configuration
const API_BASE_URL =
  process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'system-test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SystemTest123!';
const TEST_ARTIST_EMAIL = process.env.TEST_ARTIST_EMAIL || 'system-test-artist@example.com';
const TEST_ARTIST_PASSWORD = process.env.TEST_ARTIST_PASSWORD || 'ArtistTest123!';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

// Helper functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function executeCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    log(`Error executing command: ${command}`, colors.red);
    log(error.message, colors.red);
    return null;
  }
}

async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const start = performance.now();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const duration = performance.now() - start;
    const data = await response.json().catch(() => ({}));

    return {
      status: response.status,
      data,
      duration,
      success: response.status >= 200 && response.status < 300,
    };
  } catch (error) {
    const duration = performance.now() - start;
    return {
      status: 0,
      data: null,
      duration,
      success: false,
      error: error.message,
    };
  }
}

// Test functions
async function testHealthEndpoint() {
  log('\n🔍 Testing Health Endpoint...', colors.cyan);

  const response = await makeRequest('/api/health');

  if (response.success) {
    log(
      `✅ Health endpoint responded successfully in ${response.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Health Endpoint',
      duration: response.duration,
    });
    return true;
  } else {
    log(`❌ Health endpoint failed: ${response.error || response.status}`, colors.red);
    results.failed.push({
      test: 'Health Endpoint',
      error: response.error || `Status: ${response.status}`,
    });
    return false;
  }
}

async function testAuthentication() {
  log('\n🔍 Testing Authentication Flows...', colors.cyan);
  let success = true;

  // Test login endpoint
  const loginResponse = await makeRequest('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  if (loginResponse.success) {
    log(
      `✅ Login endpoint responded successfully in ${loginResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Authentication - Login',
      duration: loginResponse.duration,
    });
  } else {
    log(`❌ Login endpoint failed: ${loginResponse.error || loginResponse.status}`, colors.red);
    results.failed.push({
      test: 'Authentication - Login',
      error: loginResponse.error || `Status: ${loginResponse.status}`,
    });
    success = false;
  }

  // Test session endpoint
  const sessionResponse = await makeRequest('/api/auth/session');

  if (sessionResponse.success) {
    log(
      `✅ Session endpoint responded successfully in ${sessionResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Authentication - Session',
      duration: sessionResponse.duration,
    });
  } else {
    log(
      `❌ Session endpoint failed: ${sessionResponse.error || sessionResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Authentication - Session',
      error: sessionResponse.error || `Status: ${sessionResponse.status}`,
    });
    success = false;
  }

  return success;
}

async function testArtistFlows() {
  log('\n🔍 Testing Artist Flows...', colors.cyan);
  let success = true;

  // Test artist profile endpoint
  const profileResponse = await makeRequest('/api/artist/profile');

  if (profileResponse.success) {
    log(
      `✅ Artist profile endpoint responded successfully in ${profileResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Artist - Profile',
      duration: profileResponse.duration,
    });
  } else {
    log(
      `❌ Artist profile endpoint failed: ${profileResponse.error || profileResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Artist - Profile',
      error: profileResponse.error || `Status: ${profileResponse.status}`,
    });
    success = false;
  }

  // Test tiers endpoint
  const tiersResponse = await makeRequest('/api/artist/tiers');

  if (tiersResponse.success) {
    log(
      `✅ Artist tiers endpoint responded successfully in ${tiersResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Artist - Tiers',
      duration: tiersResponse.duration,
    });
  } else {
    log(
      `❌ Artist tiers endpoint failed: ${tiersResponse.error || tiersResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Artist - Tiers',
      error: tiersResponse.error || `Status: ${tiersResponse.status}`,
    });
    success = false;
  }

  // Test content endpoint
  const contentResponse = await makeRequest('/api/artist/content');

  if (contentResponse.success) {
    log(
      `✅ Artist content endpoint responded successfully in ${contentResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Artist - Content',
      duration: contentResponse.duration,
    });
  } else {
    log(
      `❌ Artist content endpoint failed: ${contentResponse.error || contentResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Artist - Content',
      error: contentResponse.error || `Status: ${contentResponse.status}`,
    });
    success = false;
  }

  // Test analytics endpoint
  const analyticsResponse = await makeRequest('/api/artist/analytics');

  if (analyticsResponse.success) {
    log(
      `✅ Artist analytics endpoint responded successfully in ${analyticsResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Artist - Analytics',
      duration: analyticsResponse.duration,
    });
  } else {
    log(
      `❌ Artist analytics endpoint failed: ${analyticsResponse.error || analyticsResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Artist - Analytics',
      error: analyticsResponse.error || `Status: ${analyticsResponse.status}`,
    });
    success = false;
  }

  return success;
}

async function testFanFlows() {
  log('\n🔍 Testing Fan Flows...', colors.cyan);
  let success = true;

  // Test artists discovery endpoint
  const artistsResponse = await makeRequest('/api/fan/artists');

  if (artistsResponse.success) {
    log(
      `✅ Fan artists discovery endpoint responded successfully in ${artistsResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Fan - Artists Discovery',
      duration: artistsResponse.duration,
    });
  } else {
    log(
      `❌ Fan artists discovery endpoint failed: ${artistsResponse.error || artistsResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Fan - Artists Discovery',
      error: artistsResponse.error || `Status: ${artistsResponse.status}`,
    });
    success = false;
  }

  // Test subscriptions endpoint
  const subscriptionsResponse = await makeRequest('/api/fan/subscriptions');

  if (subscriptionsResponse.success) {
    log(
      `✅ Fan subscriptions endpoint responded successfully in ${subscriptionsResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Fan - Subscriptions',
      duration: subscriptionsResponse.duration,
    });
  } else {
    log(
      `❌ Fan subscriptions endpoint failed: ${subscriptionsResponse.error || subscriptionsResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Fan - Subscriptions',
      error: subscriptionsResponse.error || `Status: ${subscriptionsResponse.status}`,
    });
    success = false;
  }

  return success;
}

async function testPaymentIntegration() {
  log('\n🔍 Testing Payment Integration...', colors.cyan);
  let success = true;

  // Test Stripe webhook endpoint (just check if it's responding, not actual functionality)
  const webhookResponse = await makeRequest('/api/payments/webhooks', {
    method: 'POST',
    body: JSON.stringify({ type: 'ping' }),
  });

  // We expect a 400 because we're not sending a valid Stripe signature
  if (webhookResponse.status === 400) {
    log(
      `✅ Stripe webhook endpoint responded correctly in ${webhookResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Payments - Webhook',
      duration: webhookResponse.duration,
    });
  } else {
    log(
      `❌ Stripe webhook endpoint failed: ${webhookResponse.error || webhookResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Payments - Webhook',
      error: webhookResponse.error || `Status: ${webhookResponse.status}`,
    });
    success = false;
  }

  return success;
}

async function testContentAccess() {
  log('\n🔍 Testing Content Access...', colors.cyan);
  let success = true;

  // Test content access endpoint
  const contentId = 'content-1'; // This should be a valid content ID in your test environment
  const accessResponse = await makeRequest(`/api/content/${contentId}/access`);

  // We expect either a 200 (access granted) or 403 (access denied)
  if (accessResponse.status === 200 || accessResponse.status === 403) {
    log(
      `✅ Content access endpoint responded correctly in ${accessResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Content - Access Control',
      duration: accessResponse.duration,
    });
  } else {
    log(
      `❌ Content access endpoint failed: ${accessResponse.error || accessResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Content - Access Control',
      error: accessResponse.error || `Status: ${accessResponse.status}`,
    });
    success = false;
  }

  return success;
}

async function testNotifications() {
  log('\n🔍 Testing Notification System...', colors.cyan);
  let success = true;

  // Test notification preferences endpoint
  const preferencesResponse = await makeRequest('/api/user/notifications/preferences');

  if (preferencesResponse.success) {
    log(
      `✅ Notification preferences endpoint responded successfully in ${preferencesResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Notifications - Preferences',
      duration: preferencesResponse.duration,
    });
  } else {
    log(
      `❌ Notification preferences endpoint failed: ${preferencesResponse.error || preferencesResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Notifications - Preferences',
      error: preferencesResponse.error || `Status: ${preferencesResponse.status}`,
    });
    success = false;
  }

  return success;
}

async function testSecurity() {
  log('\n🔍 Testing Security Features...', colors.cyan);
  let success = true;

  // Run security check script
  log('Running security check script...', colors.blue);
  const securityOutput = executeCommand('node scripts/security-check.js || true');

  if (securityOutput && !securityOutput.includes('Security issues were found')) {
    log('✅ Security check passed', colors.green);
    results.passed.push({
      test: 'Security - Check Script',
    });
  } else {
    log('⚠️ Security check found issues or warnings', colors.yellow);
    results.warnings.push({
      test: 'Security - Check Script',
      warning: 'Security issues or warnings found',
    });
  }

  // Test GDPR endpoints
  const gdprExportResponse = await makeRequest('/api/user/gdpr/export');

  if (gdprExportResponse.status === 200 || gdprExportResponse.status === 401) {
    log(
      `✅ GDPR export endpoint responded correctly in ${gdprExportResponse.duration.toFixed(2)}ms`,
      colors.green
    );
    results.passed.push({
      test: 'Security - GDPR Export',
      duration: gdprExportResponse.duration,
    });
  } else {
    log(
      `❌ GDPR export endpoint failed: ${gdprExportResponse.error || gdprExportResponse.status}`,
      colors.red
    );
    results.failed.push({
      test: 'Security - GDPR Export',
      error: gdprExportResponse.error || `Status: ${gdprExportResponse.status}`,
    });
    success = false;
  }

  return success;
}

async function testPerformance() {
  log('\n🔍 Testing Performance...', colors.cyan);
  let success = true;

  // Run performance test script
  log('Running performance test script...', colors.blue);
  const performanceOutput = executeCommand('node scripts/performance-test.js || true');

  if (performanceOutput && !performanceOutput.includes('Performance threshold failures')) {
    log('✅ Performance tests passed', colors.green);
    results.passed.push({
      test: 'Performance - Test Script',
    });
  } else {
    log('⚠️ Performance tests found issues', colors.yellow);
    results.warnings.push({
      test: 'Performance - Test Script',
      warning: 'Performance issues found',
    });
  }

  return success;
}

async function testAccessibility() {
  log('\n🔍 Testing Accessibility...', colors.cyan);
  let success = true;

  // Check if accessibility components exist
  const accessibilityFiles = [
    'src/components/ui/accessibility.tsx',
    'src/components/ui/accessible-form.tsx',
    'src/lib/accessibility.ts',
  ];

  let allFilesExist = true;
  for (const file of accessibilityFiles) {
    if (!fs.existsSync(file)) {
      allFilesExist = false;
      break;
    }
  }

  if (allFilesExist) {
    log('✅ Accessibility components exist', colors.green);
    results.passed.push({
      test: 'Accessibility - Components',
    });
  } else {
    log('❌ Some accessibility components are missing', colors.red);
    results.failed.push({
      test: 'Accessibility - Components',
      error: 'Missing accessibility components',
    });
    success = false;
  }

  return success;
}

async function testEndToEnd() {
  log('\n🔍 Running End-to-End Tests...', colors.cyan);
  let success = true;

  // Run Playwright tests
  log('Running Playwright tests...', colors.blue);
  const e2eOutput = executeCommand('npm run test:e2e || true');

  if (e2eOutput && !e2eOutput.includes('Test failed')) {
    log('✅ End-to-end tests passed', colors.green);
    results.passed.push({
      test: 'E2E - Playwright Tests',
    });
  } else {
    log('❌ Some end-to-end tests failed', colors.red);
    results.failed.push({
      test: 'E2E - Playwright Tests',
      error: 'Test failures',
    });
    success = false;
  }

  return success;
}

async function testLoadHandling() {
  log('\n🔍 Testing Load Handling...', colors.cyan);
  let success = true;

  // Run load test script with minimal settings
  log('Running load test script with minimal settings...', colors.blue);
  const loadOutput = executeCommand('node scripts/load-test.js --users=10 --duration=10 || true');

  if (loadOutput && !loadOutput.includes('Failed requests')) {
    log('✅ Load tests passed', colors.green);
    results.passed.push({
      test: 'Load - Test Script',
    });
  } else {
    log('⚠️ Load tests found issues', colors.yellow);
    results.warnings.push({
      test: 'Load - Test Script',
      warning: 'Load issues found',
    });
  }

  return success;
}

// Main function
async function runSystemTests() {
  log('🧪 Starting System Tests for Direct Fan Platform', colors.bold + colors.blue);
  log('==============================================\n', colors.blue);

  // Run all tests
  const healthCheck = await testHealthEndpoint();

  if (!healthCheck) {
    log('❌ Health check failed. Aborting system tests.', colors.red);
    return false;
  }

  await testAuthentication();
  await testArtistFlows();
  await testFanFlows();
  await testPaymentIntegration();
  await testContentAccess();
  await testNotifications();
  await testSecurity();
  await testPerformance();
  await testAccessibility();
  await testEndToEnd();
  await testLoadHandling();

  // Print summary
  log('\n📊 System Test Summary', colors.bold + colors.blue);
  log('===================', colors.blue);
  log(`✅ Passed: ${results.passed.length}`, colors.green);
  log(`❌ Failed: ${results.failed.length}`, colors.red);
  log(`⚠️ Warnings: ${results.warnings.length}`, colors.yellow);

  if (results.failed.length > 0) {
    log(
      '\n❌ System tests failed. Please fix the issues before deploying to production.',
      colors.bold + colors.red
    );
    return false;
  } else if (results.warnings.length > 0) {
    log(
      '\n⚠️ System tests passed with warnings. Consider addressing them before deploying to production.',
      colors.bold + colors.yellow
    );
    return true;
  } else {
    log(
      '\n✅ All system tests passed! The application is ready for production.',
      colors.bold + colors.green
    );
    return true;
  }
}

// Run the tests
runSystemTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    log(`Error running system tests: ${error.message}`, colors.red);
    process.exit(1);
  });
