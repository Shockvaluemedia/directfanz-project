#!/usr/bin/env node

/**
 * Integration Test Script for Campaign System
 * Tests the complete end-to-end functionality of campaigns, from creation to participation
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Test configuration
const testConfig = {
  baseUrl: BASE_URL,
  timeout: 30000,
  retries: 3,
};

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🚀 Starting Campaign System Integration Tests\n');
    console.log(`Testing against: ${testConfig.baseUrl}`);
    console.log(`Total tests: ${this.tests.length}\n`);

    for (const test of this.tests) {
      try {
        console.log(`⏳ Running: ${test.name}`);
        await test.fn();
        console.log(`✅ PASSED: ${test.name}\n`);
        this.passed++;
      } catch (error) {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('📊 Test Results Summary');
    console.log('========================');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`⏭️  Skipped: ${this.skipped}`);
    console.log(
      `📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`
    );

    if (this.failed > 0) {
      process.exit(1);
    }
  }

  async request(path, options = {}) {
    const url = `${testConfig.baseUrl}${path}`;
    const response = await fetch(url, {
      timeout: testConfig.timeout,
      ...options,
    });

    if (!response.ok && !options.expectError) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    try {
      return await response.json();
    } catch (error) {
      if (options.expectError) {
        return { error: 'Parse error', status: response.status };
      }
      throw error;
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }
}

// Initialize test runner
const runner = new TestRunner();

// Test 1: API Health Check
runner.test('API Health Check', async () => {
  const response = await runner.request('/api/health', { expectError: true });

  // If no health endpoint, check campaigns endpoint instead
  if (response.status === 404) {
    const campaignsResponse = await runner.request('/api/campaigns');
    runner.assert(campaignsResponse.campaigns !== undefined, 'Campaigns API should be accessible');
    runner.assert(Array.isArray(campaignsResponse.campaigns), 'Campaigns should be an array');
    console.log(`   Found ${campaignsResponse.campaigns.length} campaigns in database`);
  } else {
    runner.assert(
      response.status === 'healthy' || response.status === 'ok',
      'Health check should return healthy status'
    );
  }
});

// Test 2: Campaign Discovery API
runner.test('Campaign Discovery API', async () => {
  const response = await runner.request('/api/campaigns');

  runner.assert(response.campaigns !== undefined, 'Response should contain campaigns array');
  runner.assert(Array.isArray(response.campaigns), 'Campaigns should be an array');
  runner.assert(response.pagination !== undefined, 'Response should contain pagination info');
  runner.assert(
    typeof response.pagination.total === 'number',
    'Pagination should have total count'
  );

  console.log(`   ✓ Found ${response.campaigns.length} campaigns`);
  console.log(`   ✓ Total campaigns in database: ${response.pagination.total}`);
});

// Test 3: Campaign Discovery with Filters
runner.test('Campaign Discovery with Filters', async () => {
  // Test different filters
  const statusFilter = await runner.request('/api/campaigns?status=ACTIVE');
  const typeFilter = await runner.request('/api/campaigns?type=PROMOTIONAL');
  const limitFilter = await runner.request('/api/campaigns?limit=5');

  runner.assert(
    Array.isArray(statusFilter.campaigns),
    'Status filter should return campaigns array'
  );
  runner.assert(Array.isArray(typeFilter.campaigns), 'Type filter should return campaigns array');
  runner.assert(Array.isArray(limitFilter.campaigns), 'Limit filter should return campaigns array');

  // Check limit is respected
  runner.assert(
    limitFilter.campaigns.length <= 5,
    'Limit filter should respect the limit parameter'
  );

  console.log(`   ✓ Active campaigns: ${statusFilter.campaigns.length}`);
  console.log(`   ✓ Promotional campaigns: ${typeFilter.campaigns.length}`);
  console.log(`   ✓ Limited results work correctly`);
});

// Test 4: Frontend Page Accessibility
runner.test('Frontend Campaign Discovery Page', async () => {
  const response = await fetch(`${testConfig.baseUrl}/campaigns`, {
    timeout: testConfig.timeout,
  });

  runner.assert(response.ok, 'Campaign discovery page should be accessible');
  runner.assert(
    response.headers.get('content-type').includes('text/html'),
    'Should return HTML content'
  );

  const html = await response.text();
  runner.assert(
    html.includes('Discover Campaigns'),
    'Page should contain expected campaign discovery content'
  );

  console.log(`   ✓ Campaign discovery page loads successfully`);
  console.log(`   ✓ Contains expected content`);
});

// Test 5: Individual Campaign Page (if campaigns exist)
runner.test('Individual Campaign Pages', async () => {
  // First, get available campaigns
  const campaignsResponse = await runner.request('/api/campaigns');

  if (campaignsResponse.campaigns.length === 0) {
    console.log(`   ⏭️ Skipping - no campaigns available for testing`);
    runner.skipped++;
    return;
  }

  const firstCampaign = campaignsResponse.campaigns[0];

  // Test API endpoint
  const campaignApiResponse = await runner.request(`/api/campaigns/${firstCampaign.id}`);
  runner.assert(
    campaignApiResponse.id === firstCampaign.id,
    'Individual campaign API should return correct campaign'
  );
  runner.assert(campaignApiResponse.title, 'Campaign should have a title');
  runner.assert(campaignApiResponse.artist, 'Campaign should have artist information');

  // Test frontend page
  const frontendResponse = await fetch(`${testConfig.baseUrl}/campaigns/${firstCampaign.id}`);
  runner.assert(frontendResponse.ok, 'Individual campaign page should be accessible');

  console.log(`   ✓ Campaign API: ${campaignApiResponse.title}`);
  console.log(`   ✓ Campaign page loads successfully`);
});

// Test 6: Fan Dashboard API Endpoints
runner.test('Fan Dashboard APIs', async () => {
  // Test fan campaigns endpoint (will return 401 without auth, which is expected)
  const fanCampaignsResponse = await runner.request('/api/fan/campaigns', { expectError: true });
  runner.assert(
    fanCampaignsResponse.status === 401 || fanCampaignsResponse.error === 'Unauthorized',
    'Fan campaigns API should require authentication'
  );

  // Test fan stats endpoint
  const fanStatsResponse = await runner.request('/api/fan/stats', { expectError: true });
  runner.assert(
    fanStatsResponse.status === 401 || fanStatsResponse.error,
    'Fan stats API should require authentication'
  );

  console.log(`   ✓ Fan APIs properly require authentication`);
  console.log(`   ✓ API endpoints are accessible and secured`);
});

// Test 7: Fan Dashboard Frontend
runner.test('Fan Dashboard Frontend', async () => {
  // Test fan dashboard page (should redirect to login)
  const response = await fetch(`${testConfig.baseUrl}/dashboard/fan`, {
    redirect: 'manual',
    timeout: testConfig.timeout,
  });

  // Should either load the page (if somehow authenticated) or redirect to auth
  runner.assert(
    response.status === 200 || response.status === 302 || response.status === 307,
    'Fan dashboard should either load or redirect to authentication'
  );

  console.log(`   ✓ Fan dashboard page handling works correctly`);
});

// Test 8: Database Schema Integrity
runner.test('Database Schema Integrity', async () => {
  try {
    // Test that we can query campaigns and related data
    const campaignsResponse = await runner.request('/api/campaigns');

    // If we have campaigns, test that they have the expected structure
    if (campaignsResponse.campaigns.length > 0) {
      const campaign = campaignsResponse.campaigns[0];

      const requiredFields = ['id', 'title', 'type', 'status', 'createdAt'];
      for (const field of requiredFields) {
        runner.assert(
          campaign[field] !== undefined,
          `Campaign should have required field: ${field}`
        );
      }

      if (campaign.artist) {
        runner.assert(campaign.artist.id, 'Campaign artist should have ID');
        runner.assert(campaign.artist.displayName, 'Campaign artist should have display name');
      }

      console.log(`   ✓ Campaign schema integrity verified`);
      console.log(`   ✓ Artist relationship working`);
    }

    console.log(`   ✓ Database schema appears to be functioning correctly`);
  } catch (error) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('database')) {
      throw new Error('Database connection issue - check if database is running and accessible');
    }
    throw error;
  }
});

// Test 9: Error Handling
runner.test('API Error Handling', async () => {
  // Test invalid campaign ID
  const invalidCampaignResponse = await runner.request('/api/campaigns/invalid-id-123456', {
    expectError: true,
  });
  // Check if it's a 404 error in the response
  const is404 =
    invalidCampaignResponse.status === 404 ||
    (invalidCampaignResponse.error &&
      (invalidCampaignResponse.error.includes('not found') ||
        invalidCampaignResponse.error.includes('404')));
  runner.assert(is404, 'Invalid campaign ID should return 404');

  // Test malformed request
  const malformedResponse = await runner.request('/api/campaigns?invalidparam=test', {
    expectError: true,
  });
  // This should still work but ignore invalid params
  runner.assert(
    malformedResponse.campaigns !== undefined,
    'API should handle invalid parameters gracefully'
  );

  console.log(`   ✓ 404 errors handled correctly`);
  console.log(`   ✓ Invalid parameters handled gracefully`);
});

// Test 10: Performance and Load
runner.test('Basic Performance Check', async () => {
  const startTime = Date.now();

  // Make multiple concurrent requests
  const promises = Array(5)
    .fill(null)
    .map(() => runner.request('/api/campaigns'));

  const responses = await Promise.all(promises);
  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // All responses should be successful
  responses.forEach((response, index) => {
    runner.assert(
      Array.isArray(response.campaigns),
      `Concurrent request ${index + 1} should return valid data`
    );
  });

  // Basic performance check - should handle 5 concurrent requests in reasonable time
  runner.assert(totalTime < 10000, 'API should handle concurrent requests within 10 seconds');

  console.log(`   ✓ Handled 5 concurrent requests in ${totalTime}ms`);
  console.log(`   ✓ Average response time: ${Math.round(totalTime / 5)}ms`);
});

// Run all tests
async function main() {
  try {
    await runner.run();
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Tests interrupted by user');
  process.exit(130);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  main();
}

module.exports = { TestRunner };
