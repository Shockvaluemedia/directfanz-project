#!/usr/bin/env node

/**
 * Staging Environment Health Monitoring Script
 * Monitors the staging environment and reports on availability, performance, and security
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const STAGING_URL = process.env.STAGING_URL || 'https://directfanz-project-staging.vercel.app';
const MONITORING_INTERVAL = process.env.MONITORING_INTERVAL || 300000; // 5 minutes
const LOG_FILE = path.join(process.cwd(), 'logs', 'staging-health.log');
const REPORT_FILE = path.join(process.cwd(), 'monitoring', 'staging', 'health-report.json');

// Health check endpoints
const HEALTH_ENDPOINTS = [
  { name: 'homepage', path: '/', expectedStatus: 200, critical: true },
  { name: 'api_health', path: '/api/health', expectedStatus: 200, critical: true },
  { name: 'auth_signin', path: '/api/auth/signin', expectedStatus: [200, 405], critical: true },
  { name: 'dashboard', path: '/dashboard', expectedStatus: [200, 302], critical: false },
  { name: 'admin', path: '/admin', expectedStatus: [200, 302, 403], critical: false },
];

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  excellent: 200,
  good: 500,
  acceptable: 1000,
  poor: 2000
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class StagingHealthMonitor {
  constructor() {
    this.healthHistory = [];
    this.lastReport = null;
    this.setupDirectories();
  }

  setupDirectories() {
    const dirs = [
      path.dirname(LOG_FILE),
      path.dirname(REPORT_FILE)
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  log(message, level = 'INFO', color = colors.reset) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    
    // Console output with color
    console.log(`${color}${logEntry}${colors.reset}`);
    
    // File output
    fs.appendFileSync(LOG_FILE, logEntry + '\n');
  }

  async checkEndpoint(endpoint) {
    const url = `${STAGING_URL}${endpoint.path}`;
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'DirectFanZ-Staging-Health-Monitor/1.0',
        }
      });

      const responseTime = Date.now() - startTime;
      const status = response.status;
      
      // Check if status is in expected range
      const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
        ? endpoint.expectedStatus 
        : [endpoint.expectedStatus];
      
      const statusOk = expectedStatuses.includes(status);

      return {
        name: endpoint.name,
        url,
        status,
        responseTime,
        success: statusOk,
        critical: endpoint.critical,
        error: null,
        headers: Object.fromEntries([...response.headers.entries()]),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: endpoint.name,
        url,
        status: 0,
        responseTime,
        success: false,
        critical: endpoint.critical,
        error: error.message,
        headers: {},
        timestamp: new Date().toISOString()
      };
    }
  }

  async performHealthCheck() {
    this.log('🏥 Starting staging environment health check', 'INFO', colors.cyan);
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      staging_url: STAGING_URL,
      overall_status: 'unknown',
      endpoints: [],
      performance: {
        average_response_time: 0,
        fastest_endpoint: null,
        slowest_endpoint: null,
        performance_grade: 'unknown'
      },
      security: {
        ssl_enabled: false,
        security_headers: [],
        missing_headers: []
      },
      summary: {
        total_endpoints: HEALTH_ENDPOINTS.length,
        successful: 0,
        failed: 0,
        critical_failures: 0
      }
    };

    // Check all endpoints
    for (const endpoint of HEALTH_ENDPOINTS) {
      this.log(`Checking ${endpoint.name} (${endpoint.path})...`, 'INFO', colors.blue);
      
      const result = await this.checkEndpoint(endpoint);
      healthCheck.endpoints.push(result);
      
      if (result.success) {
        healthCheck.summary.successful++;
        this.log(`✅ ${endpoint.name}: ${result.status} (${result.responseTime}ms)`, 'INFO', colors.green);
      } else {
        healthCheck.summary.failed++;
        if (result.critical) {
          healthCheck.summary.critical_failures++;
        }
        this.log(`❌ ${endpoint.name}: ${result.status} (${result.error || 'Failed'})`, 'ERROR', colors.red);
      }
    }

    // Calculate performance metrics
    const responseTimes = healthCheck.endpoints
      .filter(e => e.success)
      .map(e => e.responseTime);

    if (responseTimes.length > 0) {
      healthCheck.performance.average_response_time = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      
      const fastestEndpoint = healthCheck.endpoints.reduce((prev, current) => 
        (current.success && current.responseTime < prev.responseTime) ? current : prev
      );
      const slowestEndpoint = healthCheck.endpoints.reduce((prev, current) => 
        (current.success && current.responseTime > prev.responseTime) ? current : prev
      );
      
      healthCheck.performance.fastest_endpoint = {
        name: fastestEndpoint.name,
        responseTime: fastestEndpoint.responseTime
      };
      
      healthCheck.performance.slowest_endpoint = {
        name: slowestEndpoint.name,
        responseTime: slowestEndpoint.responseTime
      };

      // Determine performance grade
      const avgTime = healthCheck.performance.average_response_time;
      if (avgTime <= PERFORMANCE_THRESHOLDS.excellent) {
        healthCheck.performance.performance_grade = 'excellent';
      } else if (avgTime <= PERFORMANCE_THRESHOLDS.good) {
        healthCheck.performance.performance_grade = 'good';
      } else if (avgTime <= PERFORMANCE_THRESHOLDS.acceptable) {
        healthCheck.performance.performance_grade = 'acceptable';
      } else {
        healthCheck.performance.performance_grade = 'poor';
      }
    }

    // Analyze security headers (from homepage response)
    const homepageResult = healthCheck.endpoints.find(e => e.name === 'homepage');
    if (homepageResult && homepageResult.success) {
      const headers = homepageResult.headers;
      
      // Check for SSL
      healthCheck.security.ssl_enabled = STAGING_URL.startsWith('https://');
      
      // Required security headers
      const requiredHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'strict-transport-security',
        'content-security-policy',
        'x-xss-protection',
        'referrer-policy'
      ];

      requiredHeaders.forEach(header => {
        if (headers[header] || headers[header.toLowerCase()]) {
          healthCheck.security.security_headers.push({
            name: header,
            value: headers[header] || headers[header.toLowerCase()],
            present: true
          });
        } else {
          healthCheck.security.missing_headers.push(header);
        }
      });
    }

    // Determine overall status
    if (healthCheck.summary.critical_failures > 0) {
      healthCheck.overall_status = 'critical';
    } else if (healthCheck.summary.failed > 0) {
      healthCheck.overall_status = 'warning';
    } else {
      healthCheck.overall_status = 'healthy';
    }

    return healthCheck;
  }

  generateHealthReport(healthCheck) {
    const report = {
      ...healthCheck,
      generated_at: new Date().toISOString(),
      next_check: new Date(Date.now() + MONITORING_INTERVAL).toISOString(),
      monitoring_interval_ms: MONITORING_INTERVAL,
      recommendations: []
    };

    // Generate recommendations
    if (report.summary.critical_failures > 0) {
      report.recommendations.push('🚨 Critical endpoints are failing - immediate attention required');
    }

    if (report.performance.performance_grade === 'poor') {
      report.recommendations.push('⚡ Performance is poor - consider optimization');
    } else if (report.performance.performance_grade === 'acceptable') {
      report.recommendations.push('📈 Performance could be improved');
    }

    if (report.security.missing_headers.length > 0) {
      report.recommendations.push(`🔒 Missing security headers: ${report.security.missing_headers.join(', ')}`);
    }

    if (!report.security.ssl_enabled) {
      report.recommendations.push('🔐 SSL should be enabled for security');
    }

    if (report.summary.failed === 0) {
      report.recommendations.push('✅ All systems operating normally');
    }

    return report;
  }

  async saveReport(report) {
    try {
      fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
      this.log(`📊 Health report saved to ${REPORT_FILE}`, 'INFO', colors.green);
    } catch (error) {
      this.log(`❌ Failed to save report: ${error.message}`, 'ERROR', colors.red);
    }
  }

  displaySummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.cyan}🏥 STAGING HEALTH CHECK SUMMARY${colors.reset}`);
    console.log('='.repeat(60));
    
    // Overall status
    const statusColor = report.overall_status === 'healthy' ? colors.green :
                       report.overall_status === 'warning' ? colors.yellow : colors.red;
    console.log(`${colors.blue}Overall Status:${colors.reset} ${statusColor}${report.overall_status.toUpperCase()}${colors.reset}`);
    
    // Endpoint summary
    console.log(`${colors.blue}Endpoints:${colors.reset} ${colors.green}${report.summary.successful} successful${colors.reset}, ${colors.red}${report.summary.failed} failed${colors.reset}`);
    
    // Performance summary
    const perfColor = report.performance.performance_grade === 'excellent' ? colors.green :
                     report.performance.performance_grade === 'good' ? colors.green :
                     report.performance.performance_grade === 'acceptable' ? colors.yellow : colors.red;
    console.log(`${colors.blue}Performance:${colors.reset} ${perfColor}${report.performance.performance_grade.toUpperCase()}${colors.reset} (avg: ${Math.round(report.performance.average_response_time)}ms)`);
    
    // Security summary
    console.log(`${colors.blue}Security:${colors.reset} ${colors.green}${report.security.security_headers.length} headers present${colors.reset}, ${colors.red}${report.security.missing_headers.length} missing${colors.reset}`);
    
    // Recommendations
    if (report.recommendations.length > 0) {
      console.log(`\n${colors.magenta}Recommendations:${colors.reset}`);
      report.recommendations.forEach(rec => console.log(`  ${rec}`));
    }
    
    console.log('='.repeat(60));
    console.log(`${colors.blue}Next check:${colors.reset} ${new Date(report.next_check).toLocaleString()}`);
    console.log('='.repeat(60) + '\n');
  }

  async runOnce() {
    try {
      const healthCheck = await this.performHealthCheck();
      const report = this.generateHealthReport(healthCheck);
      
      await this.saveReport(report);
      this.displaySummary(report);
      
      this.lastReport = report;
      return report;
    } catch (error) {
      this.log(`❌ Health check failed: ${error.message}`, 'ERROR', colors.red);
      throw error;
    }
  }

  async startMonitoring() {
    this.log('🚀 Starting continuous staging health monitoring', 'INFO', colors.cyan);
    this.log(`Monitoring URL: ${STAGING_URL}`, 'INFO', colors.blue);
    this.log(`Check interval: ${MONITORING_INTERVAL / 1000} seconds`, 'INFO', colors.blue);
    
    // Initial check
    await this.runOnce();
    
    // Set up interval
    const intervalId = setInterval(async () => {
      try {
        await this.runOnce();
      } catch (error) {
        this.log(`⚠️ Scheduled health check failed: ${error.message}`, 'ERROR', colors.red);
      }
    }, MONITORING_INTERVAL);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.log('📴 Shutting down health monitoring...', 'INFO', colors.yellow);
      clearInterval(intervalId);
      process.exit(0);
    });

    // Keep process alive
    return new Promise(() => {}); // Never resolves, runs until killed
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new StagingHealthMonitor();
  
  const command = process.argv[2] || 'once';
  
  switch (command) {
    case 'once':
      monitor.runOnce()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
    
    case 'monitor':
      monitor.startMonitoring()
        .catch(error => {
          console.error('Monitoring failed:', error);
          process.exit(1);
        });
      break;
    
    case 'help':
      console.log('DirectFanZ Staging Health Monitor');
      console.log('');
      console.log('Usage: node staging-health.js [command]');
      console.log('');
      console.log('Commands:');
      console.log('  once     Run health check once and exit (default)');
      console.log('  monitor  Start continuous monitoring');
      console.log('  help     Show this help message');
      console.log('');
      console.log('Environment Variables:');
      console.log('  STAGING_URL            Staging environment URL');
      console.log('  MONITORING_INTERVAL    Check interval in milliseconds (default: 300000)');
      break;
    
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Use "help" for usage information');
      process.exit(1);
  }
}

export default StagingHealthMonitor;