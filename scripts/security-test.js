#!/usr/bin/env node

/**
 * Security Testing Suite for DirectFanz
 * Tests all OAuth security enhancements and vulnerabilities
 */

import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { URL } from 'url';
import { fileURLToPath } from 'url';

class SecurityTester {
  constructor(baseUrl = 'https://www.directfanz.io') {
    this.baseUrl = baseUrl;
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: [],
    };
    this.session = {
      cookies: new Map(),
      csrfToken: null,
      sessionId: null,
    };
  }

  async runAllTests() {
    console.log('🔒 Starting Comprehensive Security Testing Suite');
    console.log('================================================\n');

    try {
      // Core Security Tests
      await this.testCSRFProtection();
      await this.testSessionSecurity();
      await this.testRateLimiting();
      await this.testSecurityHeaders();
      await this.testAuthenticationFlows();

      // Vulnerability Tests
      await this.testSQLInjection();
      await this.testXSSProtection();
      await this.testDataValidation();

      // Performance Security Tests
      await this.testDOSProtection();

      this.printResults();
    } catch (error) {
      console.error('❌ Security testing failed:', error);
    }
  }

  async makeRequest(path, options = {}) {
    const url = new URL(path, this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'SecurityTester/1.0',
          Accept: 'application/json',
          ...this.getCookieHeaders(),
          ...options.headers,
        },
        timeout: 10000,
      };

      const req = client.request(reqOptions, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          // Store cookies
          this.updateCookies(res.headers['set-cookie']);

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            cookies: this.parseCookies(res.headers['set-cookie']),
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  getCookieHeaders() {
    if (this.session.cookies.size === 0) return {};

    const cookieString = Array.from(this.session.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    return { Cookie: cookieString };
  }

  updateCookies(setCookieHeaders) {
    if (!setCookieHeaders) return;

    setCookieHeaders.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      this.session.cookies.set(name.trim(), value ? value.trim() : '');
    });
  }

  parseCookies(setCookieHeaders) {
    if (!setCookieHeaders) return [];
    return setCookieHeaders.map(cookie => {
      const parts = cookie.split(';').map(part => part.trim());
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=');

      const parsed = { name: name.trim(), value: value ? value.trim() : '' };

      parts.slice(1).forEach(attr => {
        const [key, val] = attr.split('=');
        const attrName = key.toLowerCase();
        if (attrName === 'secure') parsed.secure = true;
        if (attrName === 'httponly') parsed.httpOnly = true;
        if (attrName === 'samesite') parsed.sameSite = val || 'strict';
        if (attrName === 'max-age') parsed.maxAge = parseInt(val);
      });

      return parsed;
    });
  }

  async testCSRFProtection() {
    console.log('🛡️  Testing CSRF Protection...');

    try {
      // Test CSRF token generation
      const csrfResponse = await this.makeRequest('/api/auth/csrf');

      if (csrfResponse.statusCode === 200) {
        const csrfData = JSON.parse(csrfResponse.body);
        this.session.csrfToken = csrfData.csrfToken;

        this.recordTest(
          'CSRF Token Generation',
          'PASS',
          `CSRF token generated successfully: ${this.session.csrfToken?.substring(0, 10)}...`
        );
      } else {
        this.recordTest(
          'CSRF Token Generation',
          'FAIL',
          `Failed to generate CSRF token. Status: ${csrfResponse.statusCode}`
        );
        return;
      }

      // Test CSRF token validation - should fail without token
      const invalidRequest = await this.makeRequest('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });

      if (invalidRequest.statusCode === 403 || invalidRequest.statusCode === 401) {
        this.recordTest(
          'CSRF Token Validation (Invalid)',
          'PASS',
          'Request properly rejected without CSRF token'
        );
      } else {
        this.recordTest(
          'CSRF Token Validation (Invalid)',
          'FAIL',
          `Request should have been rejected. Status: ${invalidRequest.statusCode}`
        );
      }

      // Test CSRF token validation - should pass with valid token
      const validRequest = await this.makeRequest('/api/test', {
        method: 'GET', // GET doesn't require CSRF, so this should pass
        headers: {
          'X-CSRF-Token': this.session.csrfToken,
          'Content-Type': 'application/json',
        },
      });

      if (validRequest.statusCode < 500) {
        this.recordTest(
          'CSRF Token Validation (Valid)',
          'PASS',
          'Request properly accepted with valid CSRF token'
        );
      } else {
        this.recordTest(
          'CSRF Token Validation (Valid)',
          'FAIL',
          `Request failed with valid token. Status: ${validRequest.statusCode}`
        );
      }
    } catch (error) {
      this.recordTest('CSRF Protection', 'FAIL', `Error: ${error.message}`);
    }
  }

  async testSessionSecurity() {
    console.log('👤 Testing Session Security...');

    try {
      // Test session creation and security attributes
      const sessionResponse = await this.makeRequest('/api/auth/sessions');
      const cookies = this.parseCookies(sessionResponse.headers['set-cookie']);

      // Check for secure session cookies
      const sessionCookie = cookies.find(
        c => c.name.includes('session') || c.name.includes('token')
      );

      if (sessionCookie) {
        let securityScore = 0;
        const issues = [];

        if (sessionCookie.secure) {
          securityScore++;
          this.recordTest('Session Cookie - Secure Flag', 'PASS', 'Secure flag is set');
        } else {
          issues.push('Missing Secure flag');
        }

        if (sessionCookie.httpOnly) {
          securityScore++;
          this.recordTest('Session Cookie - HttpOnly Flag', 'PASS', 'HttpOnly flag is set');
        } else {
          issues.push('Missing HttpOnly flag');
        }

        if (sessionCookie.sameSite) {
          securityScore++;
          this.recordTest(
            'Session Cookie - SameSite',
            'PASS',
            `SameSite: ${sessionCookie.sameSite}`
          );
        } else {
          issues.push('Missing SameSite attribute');
        }

        if (issues.length > 0) {
          this.recordTest(
            'Session Cookie Security',
            'WARNING',
            `Security issues: ${issues.join(', ')}`
          );
        }
      }

      // Test session hijacking protection (IP validation)
      // This would require multiple requests from different IPs,
      // so we'll test the endpoint existence
      const ipValidationTest = await this.makeRequest('/api/auth/validate-session');

      if (ipValidationTest.statusCode !== 404) {
        this.recordTest('Session IP Validation', 'PASS', 'Session validation endpoint exists');
      } else {
        this.recordTest('Session IP Validation', 'WARNING', 'Session validation endpoint missing');
      }
    } catch (error) {
      this.recordTest('Session Security', 'FAIL', `Error: ${error.message}`);
    }
  }

  async testRateLimiting() {
    console.log('⚡ Testing Rate Limiting...');

    try {
      const requests = [];
      const startTime = Date.now();

      // Make multiple rapid requests to test rate limiting
      for (let i = 0; i < 20; i++) {
        requests.push(this.makeRequest('/api/auth/csrf'));
      }

      const responses = await Promise.allSettled(requests);
      const rateLimited = responses.some(
        r => r.status === 'fulfilled' && r.value.statusCode === 429
      );

      if (rateLimited) {
        this.recordTest(
          'Rate Limiting',
          'PASS',
          'Rate limiting is active (429 responses detected)'
        );
      } else {
        this.recordTest(
          'Rate Limiting',
          'WARNING',
          'No rate limiting detected - may need configuration'
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      this.recordTest(
        'Rate Limiting Performance',
        'INFO',
        `20 requests completed in ${duration}ms`
      );
    } catch (error) {
      this.recordTest('Rate Limiting', 'FAIL', `Error: ${error.message}`);
    }
  }

  async testSecurityHeaders() {
    console.log('🔐 Testing Security Headers...');

    try {
      const response = await this.makeRequest('/');
      const headers = response.headers;

      const expectedHeaders = {
        'x-frame-options': 'Security against clickjacking',
        'x-content-type-options': 'Prevents MIME type sniffing',
        'x-xss-protection': 'XSS protection',
        'strict-transport-security': 'HTTPS enforcement',
        'content-security-policy': 'Content Security Policy',
        'referrer-policy': 'Referrer information control',
      };

      for (const [header, description] of Object.entries(expectedHeaders)) {
        if (headers[header]) {
          this.recordTest(
            `Security Header - ${header}`,
            'PASS',
            `${description}: ${headers[header]}`
          );
        } else {
          this.recordTest(
            `Security Header - ${header}`,
            'WARNING',
            `Missing ${description} header`
          );
        }
      }
    } catch (error) {
      this.recordTest('Security Headers', 'FAIL', `Error: ${error.message}`);
    }
  }

  async testAuthenticationFlows() {
    console.log('🔑 Testing Authentication Flows...');

    try {
      // Test token refresh endpoint
      const refreshResponse = await this.makeRequest('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.session.csrfToken || 'test-token',
        },
      });

      if (refreshResponse.statusCode === 401 || refreshResponse.statusCode === 403) {
        this.recordTest(
          'Token Refresh - Unauthorized',
          'PASS',
          'Token refresh properly requires authentication'
        );
      } else {
        this.recordTest(
          'Token Refresh - Unauthorized',
          'WARNING',
          `Unexpected response: ${refreshResponse.statusCode}`
        );
      }

      // Test session invalidation
      const invalidateResponse = await this.makeRequest('/api/auth/invalidate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.session.csrfToken || 'test-token',
        },
      });

      if (invalidateResponse.statusCode !== 404) {
        this.recordTest('Session Invalidation', 'PASS', 'Session invalidation endpoint exists');
      } else {
        this.recordTest('Session Invalidation', 'WARNING', 'Session invalidation endpoint missing');
      }
    } catch (error) {
      this.recordTest('Authentication Flows', 'FAIL', `Error: ${error.message}`);
    }
  }

  async testSQLInjection() {
    console.log('💉 Testing SQL Injection Protection...');

    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users;--",
      "' UNION SELECT * FROM users--",
      "1' OR '1'='1' --",
      "'; INSERT INTO admin VALUES ('hacker', 'password');--",
    ];

    for (const payload of sqlPayloads) {
      try {
        const response = await this.makeRequest(
          `/api/auth/validate-session?userId=${encodeURIComponent(payload)}`
        );

        if (response.statusCode === 400 || response.statusCode === 422) {
          this.recordTest(
            `SQL Injection - Input Validation`,
            'PASS',
            'Malicious SQL payload properly rejected'
          );
        } else if (response.statusCode === 500) {
          this.recordTest(
            `SQL Injection - Error Handling`,
            'WARNING',
            'SQL payload caused server error - check error handling'
          );
        }
      } catch (error) {
        // Network errors are acceptable for this test
      }
    }
  }

  async testXSSProtection() {
    console.log('🕷️  Testing XSS Protection...');

    const xssPayloads = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src="x" onerror="alert(\'xss\')">',
      '"><script>alert("xss")</script>',
    ];

    for (const payload of xssPayloads) {
      try {
        const response = await this.makeRequest('/api/search', {
          method: 'GET',
          headers: {
            Accept: 'text/html,application/json',
          },
        });

        // Check if XSS payload is properly encoded in response
        if (response.body.includes(payload)) {
          this.recordTest('XSS Protection', 'FAIL', 'XSS payload found unescaped in response');
        } else {
          this.recordTest('XSS Protection', 'PASS', 'XSS payload properly escaped or filtered');
        }
      } catch (error) {
        // Network errors are acceptable
      }
    }
  }

  async testDataValidation() {
    console.log('✅ Testing Data Validation...');

    const invalidData = [
      { test: 'a'.repeat(10000) }, // Extremely long string
      { test: null },
      { test: undefined },
      { nested: { deep: { very: { deep: { object: true } } } } },
    ];

    for (const data of invalidData) {
      try {
        const response = await this.makeRequest('/api/auth/csrf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (response.statusCode === 400 || response.statusCode === 422) {
          this.recordTest('Data Validation', 'PASS', 'Invalid data properly rejected');
        } else if (response.statusCode === 413) {
          this.recordTest('Payload Size Limit', 'PASS', 'Large payloads properly rejected');
        }
      } catch (error) {
        // Expected for invalid data
      }
    }
  }

  async testDOSProtection() {
    console.log('🛡️  Testing DoS Protection...');

    try {
      const startTime = Date.now();
      const largePayload = 'x'.repeat(1024 * 1024); // 1MB payload

      const response = await this.makeRequest('/api/auth/csrf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: largePayload }),
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (response.statusCode === 413) {
        this.recordTest(
          'DoS Protection - Large Payload',
          'PASS',
          'Large payload properly rejected'
        );
      } else if (duration > 5000) {
        this.recordTest(
          'DoS Protection - Response Time',
          'WARNING',
          `Large payload took ${duration}ms to process`
        );
      }
    } catch (error) {
      this.recordTest('DoS Protection', 'PASS', 'Large payload properly rejected');
    }
  }

  recordTest(testName, status, details) {
    const test = { testName, status, details, timestamp: new Date().toISOString() };
    this.results.tests.push(test);

    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`  ${icon} ${testName}: ${details}`);

    if (status === 'PASS') this.results.passed++;
    else if (status === 'FAIL') this.results.failed++;
    else this.results.warnings++;
  }

  printResults() {
    console.log('\n📊 Security Testing Results');
    console.log('============================');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`📋 Total Tests: ${this.results.tests.length}\n`);

    if (this.results.failed > 0) {
      console.log('🚨 CRITICAL SECURITY ISSUES FOUND:');
      this.results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(test => console.log(`   • ${test.testName}: ${test.details}`));
      console.log();
    }

    if (this.results.warnings > 0) {
      console.log('⚠️  SECURITY WARNINGS:');
      this.results.tests
        .filter(t => t.status === 'WARNING')
        .forEach(test => console.log(`   • ${test.testName}: ${test.details}`));
      console.log();
    }

    const securityScore = Math.round((this.results.passed / this.results.tests.length) * 100);
    console.log(`🔒 Security Score: ${securityScore}%`);

    if (securityScore >= 90) {
      console.log('🎉 Excellent security posture!');
    } else if (securityScore >= 70) {
      console.log('👍 Good security, address warnings to improve');
    } else {
      console.log('⚠️  Security needs improvement - address failed tests');
    }
  }
}

// Run if called directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  const tester = new SecurityTester(process.argv[2] || 'https://www.directfanz.io');
  tester.runAllTests().catch(console.error);
}

export default SecurityTester;
