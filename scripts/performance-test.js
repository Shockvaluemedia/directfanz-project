/**
 * Performance testing script for the Direct Fan Platform
 * 
 * This script runs a series of tests to measure the performance of key API endpoints
 * and database operations with and without caching. It also includes production monitoring
 * capabilities for continuous performance tracking.
 * 
 * Usage: 
 *   - Development: node scripts/performance-test.js
 *   - Production: APP_URL=https://your-app.com node scripts/performance-test.js
 */

const { performance } = require('perf_hooks');
const fetch = require('node-fetch');
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_ITERATIONS = process.env.NODE_ENV === 'production' ? 20 : 10;
const PERFORMANCE_THRESHOLD_MS = 300; // Maximum acceptable response time
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || API_BASE_URL.includes('vercel.app');
const RESULTS_DIR = path.join(__dirname, '../performance-results');

// Test endpoints
const TEST_ENDPOINTS = [
  '/api/artist/analytics',
  '/api/fan/artists',
  '/api/fan/content/1', // Replace with actual artist ID for testing
  '/api/artist/tiers',
  '/api/health',
  '/api/billing/invoices',
];

// Redis client for cache testing
let redisClient;

/**
 * Initialize Redis client
 */
async function initRedis() {
  try {
    redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    process.exit(1);
  }
}

/**
 * Clear Redis cache
 */
async function clearCache() {
  try {
    await redisClient.flushDb();
    console.log('Redis cache cleared');
  } catch (error) {
    console.error('Failed to clear Redis cache:', error);
  }
}

/**
 * Measure API endpoint performance
 * @param {string} endpoint API endpoint to test
 * @param {boolean} withCache Whether to use cache
 * @returns {Promise<number>} Average response time in ms
 */
async function measureEndpoint(endpoint, withCache = true) {
  const durations = [];
  
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const start = performance.now();
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Cache-Control': withCache ? 'default' : 'no-cache',
        },
      });
      
      await response.json();
    } catch (error) {
      console.error(`Error testing ${endpoint}:`, error);
    }
    
    const duration = performance.now() - start;
    durations.push(duration);
  }
  
  // Calculate average duration
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  return avgDuration;
}

/**
 * Save performance results to a file for historical tracking
 * @param {Object} results Performance test results
 */
async function saveResults(results) {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `${timestamp}-performance.json`;
  const filePath = path.join(RESULTS_DIR, filename);

  try {
    fs.writeFileSync(filePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: IS_PRODUCTION ? 'production' : 'development',
      baseUrl: API_BASE_URL,
      results,
    }, null, 2));
    console.log(`Results saved to ${filePath}`);
  } catch (error) {
    console.error('Failed to save results:', error);
  }
}

/**
 * Check if performance meets thresholds
 * @param {Object} results Performance test results
 * @returns {boolean} Whether all tests passed thresholds
 */
function checkPerformanceThresholds(results) {
  let allPassed = true;
  const failures = [];

  Object.entries(results).forEach(([endpoint, data]) => {
    if (data.withCache > PERFORMANCE_THRESHOLD_MS) {
      allPassed = false;
      failures.push({
        endpoint,
        expected: PERFORMANCE_THRESHOLD_MS,
        actual: data.withCache,
      });
    }
  });

  if (!allPassed) {
    console.error('❌ Performance threshold failures:');
    failures.forEach(failure => {
      console.error(`  - ${failure.endpoint}: ${failure.actual.toFixed(2)}ms (threshold: ${failure.expected}ms)`);
    });
  } else {
    console.log('✅ All performance tests passed thresholds');
  }

  return allPassed;
}

/**
 * Compare current results with historical data
 * @param {Object} currentResults Current test results
 */
function compareWithHistorical(currentResults) {
  if (!fs.existsSync(RESULTS_DIR)) {
    console.log('No historical data available for comparison');
    return;
  }

  try {
    // Get the most recent result file (excluding the current one)
    const files = fs.readdirSync(RESULTS_DIR)
      .filter(file => file.endsWith('-performance.json'))
      .sort()
      .reverse()
      .slice(1, 2); // Get the second most recent (most recent is current)

    if (files.length === 0) {
      console.log('No previous results found for comparison');
      return;
    }

    const previousResultPath = path.join(RESULTS_DIR, files[0]);
    const previousResults = JSON.parse(fs.readFileSync(previousResultPath, 'utf8'));

    console.log('\nPerformance Comparison with Previous Run:');
    console.log('='.repeat(50));

    Object.entries(currentResults).forEach(([endpoint, data]) => {
      if (previousResults.results[endpoint]) {
        const previous = previousResults.results[endpoint].withCache;
        const current = data.withCache;
        const change = ((current - previous) / previous) * 100;
        const changeStr = change > 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
        const changeSymbol = change > 5 ? '⚠️' : change < -5 ? '✅' : '➖';
        
        console.log(`${endpoint}: ${previous.toFixed(2)}ms → ${current.toFixed(2)}ms (${changeStr}) ${changeSymbol}`);
      }
    });
  } catch (error) {
    console.error('Error comparing with historical data:', error);
  }
}

/**
 * Run performance tests
 */
async function runTests() {
  console.log(`Starting performance tests on ${API_BASE_URL}...`);
  console.log(`Environment: ${IS_PRODUCTION ? 'Production' : 'Development'}`);
  console.log('='.repeat(50));
  
  // Initialize Redis if not in production mode
  if (!IS_PRODUCTION) {
    await initRedis();
  }
  
  const results = {};
  
  // Test each endpoint with and without cache
  for (const endpoint of TEST_ENDPOINTS) {
    console.log(`Testing endpoint: ${endpoint}`);
    
    // Clear cache before tests if not in production
    if (!IS_PRODUCTION) {
      await clearCache();
    }
    
    // Test without cache
    console.log('  Testing without cache...');
    const noCacheDuration = await measureEndpoint(endpoint, false);
    
    // Test with cache
    console.log('  Testing with cache (first request)...');
    const firstCacheDuration = await measureEndpoint(endpoint, true);
    
    console.log('  Testing with cache (subsequent requests)...');
    const withCacheDuration = await measureEndpoint(endpoint, true);
    
    // Calculate improvement
    const improvement = ((noCacheDuration - withCacheDuration) / noCacheDuration) * 100;
    
    // Store results
    results[endpoint] = {
      withoutCache: noCacheDuration,
      firstCacheRequest: firstCacheDuration,
      withCache: withCacheDuration,
      improvement: improvement,
    };
    
    console.log('  Results:');
    console.log(`    Without cache: ${noCacheDuration.toFixed(2)}ms`);
    console.log(`    First cached request: ${firstCacheDuration.toFixed(2)}ms`);
    console.log(`    With cache: ${withCacheDuration.toFixed(2)}ms`);
    console.log(`    Improvement: ${improvement.toFixed(2)}%`);
    console.log('-'.repeat(50));
  }
  
  // Close Redis connection if not in production
  if (!IS_PRODUCTION && redisClient) {
    await redisClient.quit();
  }
  
  // Save results for historical tracking
  await saveResults(results);
  
  // Check if performance meets thresholds
  const thresholdsPassed = checkPerformanceThresholds(results);
  
  // Compare with historical data
  compareWithHistorical(results);
  
  console.log('\nPerformance tests completed');
  
  // Exit with appropriate code in production
  if (IS_PRODUCTION && !thresholdsPassed) {
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});