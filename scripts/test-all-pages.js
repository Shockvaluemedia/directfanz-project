#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Define all the routes to test
const routes = {
  'Core Pages': [
    '/',
    '/page-simple',
  ],
  'Authentication': [
    '/auth/signin',
    '/auth/signup',
    '/auth-debug',
    '/test-auth',
    '/test-auth-simple',
    '/test-signin',
    '/simple-signin'
  ],
  'Dashboard & Profile': [
    '/dashboard',
    '/profile',
  ],
  'Creator Studio': [
    '/studio',
    '/upload',
    '/upload-simple',
    '/analytics',
    '/content',
  ],
  'Fan Experience': [
    '/discover',
    '/stream',
    '/streams',
    '/player',
    '/search',
    '/playlists'
  ],
  'Communication': [
    '/messages',
    '/chat'
  ],
  'Admin & Settings': [
    '/admin',
    '/settings'
  ],
  'Feature Pages': [
    '/features',
    '/features-demo',
    '/campaigns',
    '/artist'
  ],
  'Demo & Test Pages': [
    '/home-demo',
    '/simple-demo',
    '/ui-showcase',
    '/css-test',
    '/minimal-test',
    '/test',
    '/test-simple',
    '/test-minimal',
    '/test-js'
  ],
  'S3 & Upload Tests': [
    '/s3-upload-test'
  ]
};

class PageTester {
  constructor() {
    this.results = [];
    this.stats = {
      total: 0,
      success: 0,
      error: 0,
      timeout: 0
    };
  }

  async testRoute(route) {
    const url = `${BASE_URL}${route}`;
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
      
      const response = await fetch(url, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'User-Agent': 'DirectFanz Page Tester'
        }
      });
      
      clearTimeout(timeoutId);
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      const result = {
        route,
        url,
        status: response.status,
        statusText: response.statusText,
        loadTime,
        success: response.status < 400,
        contentLength: response.headers.get('content-length') || 'unknown',
        contentType: response.headers.get('content-type') || 'unknown'
      };

      if (response.status >= 200 && response.status < 300) {
        this.stats.success++;
      } else {
        this.stats.error++;
      }

      return result;
      
    } catch (error) {
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      if (error.name === 'AbortError') {
        this.stats.timeout++;
        return {
          route,
          url,
          status: 'TIMEOUT',
          statusText: 'Request timed out',
          loadTime,
          success: false,
          error: 'Timeout after 10 seconds'
        };
      } else {
        this.stats.error++;
        return {
          route,
          url,
          status: 'ERROR',
          statusText: error.message,
          loadTime,
          success: false,
          error: error.message
        };
      }
    }
  }

  printResult(result) {
    const statusColor = result.success ? colors.green : colors.red;
    const loadTimeColor = result.loadTime < 1000 ? colors.green : 
                         result.loadTime < 3000 ? colors.yellow : colors.red;
    
    console.log(
      `${statusColor}${result.status}${colors.reset} ` +
      `${colors.cyan}${result.route.padEnd(25)}${colors.reset} ` +
      `${loadTimeColor}${result.loadTime}ms${colors.reset} ` +
      `${result.statusText}`
    );
    
    if (result.error) {
      console.log(`     ${colors.red}Error: ${result.error}${colors.reset}`);
    }
  }

  async testAllRoutes() {
    console.log(`${colors.bold}${colors.blue}🚀 DirectFanz Page Testing Started${colors.reset}\\n`);
    console.log(`Testing against: ${BASE_URL}\\n`);
    
    for (const [category, routeList] of Object.entries(routes)) {
      console.log(`${colors.bold}${colors.cyan}📁 ${category}${colors.reset}`);
      console.log('─'.repeat(60));
      
      for (const route of routeList) {
        this.stats.total++;
        const result = await this.testRoute(route);
        this.results.push(result);
        this.printResult(result);
      }
      
      console.log(''); // Empty line between categories
    }
    
    this.printSummary();
    await this.saveResults();
  }

  printSummary() {
    console.log(`${colors.bold}${colors.blue}📊 Testing Summary${colors.reset}`);
    console.log('='.repeat(60));
    console.log(`Total routes tested: ${colors.bold}${this.stats.total}${colors.reset}`);
    console.log(`${colors.green}✅ Successful: ${this.stats.success}${colors.reset}`);
    console.log(`${colors.red}❌ Errors: ${this.stats.error}${colors.reset}`);
    console.log(`${colors.yellow}⏰ Timeouts: ${this.stats.timeout}${colors.reset}`);
    
    const successRate = ((this.stats.success / this.stats.total) * 100).toFixed(1);
    const rateColor = successRate >= 90 ? colors.green : 
                     successRate >= 70 ? colors.yellow : colors.red;
    console.log(`${colors.bold}Success Rate: ${rateColor}${successRate}%${colors.reset}`);
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `page-test-results-${timestamp}.json`;
    const filepath = path.join('test-results', filename);
    
    // Ensure test-results directory exists
    await fs.mkdir('test-results', { recursive: true });
    
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      stats: this.stats,
      results: this.results
    };
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`\\n${colors.cyan}📄 Results saved to: ${filepath}${colors.reset}`);
  }
}

// Main execution
async function main() {
  const tester = new PageTester();
  await tester.testAllRoutes();
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PageTester };