#!/usr/bin/env node

/**
 * Infrastructure Checkpoint Master Script
 * 
 * This script runs all infrastructure validation tests as part of the
 * AWS conversion checkpoint. It orchestrates the execution of:
 * 
 * 1. Infrastructure component validation
 * 2. Network connectivity testing
 * 3. AWS services functionality testing
 * 
 * This corresponds to Task 6 in the AWS conversion implementation plan.
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class InfrastructureCheckpoint {
  constructor() {
    this.results = {
      infrastructureValidation: null,
      networkConnectivity: null,
      servicesFunctionality: null,
      startTime: new Date(),
      endTime: null
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '🎉' : '📋';
    console.log(`${timestamp} ${prefix} ${message}`);
  }

  async runScript(scriptPath, description) {
    this.log(`Starting ${description}...`);
    
    return new Promise((resolve) => {
      const child = spawn('node', [scriptPath], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.log(`${description} completed successfully`, 'success');
          resolve(true);
        } else {
          this.log(`${description} failed with exit code ${code}`, 'error');
          resolve(false);
        }
      });

      child.on('error', (error) => {
        this.log(`${description} failed to start: ${error.message}`, 'error');
        resolve(false);
      });
    });
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites...');
    
    // Check if AWS CLI is configured
    try {
      execSync('aws sts get-caller-identity', { stdio: 'pipe' });
      this.log('AWS credentials are configured');
    } catch (error) {
      this.log('AWS credentials not configured or AWS CLI not available', 'error');
      this.log('Please run: aws configure', 'error');
      return false;
    }

    // Check if required environment variables are set
    const requiredEnvVars = ['AWS_REGION'];
    const optionalEnvVars = ['PROJECT_NAME', 'ENVIRONMENT'];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        this.log(`Required environment variable ${envVar} is not set`, 'error');
        return false;
      }
    }

    for (const envVar of optionalEnvVars) {
      if (!process.env[envVar]) {
        this.log(`Optional environment variable ${envVar} is not set (using default)`, 'warning');
      }
    }

    // Check if Node.js dependencies are available
    try {
      await import('aws-sdk');
      this.log('AWS SDK is available');
    } catch (error) {
      this.log('AWS SDK not found. Please run: npm install aws-sdk', 'error');
      return false;
    }

    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      this.log('Created logs directory');
    }

    return true;
  }

  async runInfrastructureValidation() {
    const scriptPath = path.join(__dirname, 'infrastructure-validation.js');
    const result = await this.runScript(scriptPath, 'Infrastructure Validation');
    this.results.infrastructureValidation = result;
    return result;
  }

  async runNetworkConnectivityTest() {
    const scriptPath = path.join(__dirname, 'network-connectivity-test.js');
    const result = await this.runScript(scriptPath, 'Network Connectivity Test');
    this.results.networkConnectivity = result;
    return result;
  }

  async runServicesFunctionalityTest() {
    const scriptPath = path.join(__dirname, 'aws-services-functionality-test.js');
    const result = await this.runScript(scriptPath, 'AWS Services Functionality Test');
    this.results.servicesFunctionality = result;
    return result;
  }

  generateSummaryReport() {
    this.results.endTime = new Date();
    const duration = (this.results.endTime - this.results.startTime) / 1000;

    const report = {
      checkpoint: 'Infrastructure Validation',
      timestamp: this.results.endTime.toISOString(),
      duration: `${duration.toFixed(2)} seconds`,
      project: process.env.PROJECT_NAME || 'direct-fan-platform',
      environment: process.env.ENVIRONMENT || 'prod',
      region: process.env.AWS_REGION || 'us-east-1',
      results: {
        infrastructureValidation: this.results.infrastructureValidation,
        networkConnectivity: this.results.networkConnectivity,
        servicesFunctionality: this.results.servicesFunctionality
      },
      summary: {
        totalTests: 3,
        passed: Object.values(this.results).filter(r => r === true).length,
        failed: Object.values(this.results).filter(r => r === false).length,
        overall: Object.values(this.results).every(r => r === true)
      }
    };

    // Save report to file
    const reportPath = path.join(__dirname, '..', 'logs', `infrastructure-checkpoint-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return { report, reportPath };
  }

  displaySummary(report, reportPath) {
    this.log('');
    this.log('='.repeat(60));
    this.log('INFRASTRUCTURE CHECKPOINT SUMMARY');
    this.log('='.repeat(60));
    this.log(`Project: ${report.project}`);
    this.log(`Environment: ${report.environment}`);
    this.log(`Region: ${report.region}`);
    this.log(`Duration: ${report.duration}`);
    this.log('');
    
    this.log('Test Results:');
    this.log(`  Infrastructure Validation: ${report.results.infrastructureValidation ? '✅ PASSED' : '❌ FAILED'}`);
    this.log(`  Network Connectivity: ${report.results.networkConnectivity ? '✅ PASSED' : '❌ FAILED'}`);
    this.log(`  Services Functionality: ${report.results.servicesFunctionality ? '✅ PASSED' : '❌ FAILED'}`);
    this.log('');
    
    this.log(`Overall Result: ${report.summary.passed}/${report.summary.totalTests} tests passed`);
    
    if (report.summary.overall) {
      this.log('🎉 CHECKPOINT PASSED - Infrastructure is ready for next phase!', 'success');
    } else {
      this.log('❌ CHECKPOINT FAILED - Please address the issues above before proceeding', 'error');
    }
    
    this.log('');
    this.log(`Detailed report saved to: ${reportPath}`);
    this.log('='.repeat(60));
  }

  async run() {
    this.log('🚀 Starting Infrastructure Validation Checkpoint');
    this.log(`Timestamp: ${this.results.startTime.toISOString()}`);
    this.log('');

    // Check prerequisites
    const prerequisitesOk = await this.checkPrerequisites();
    if (!prerequisitesOk) {
      this.log('Prerequisites check failed. Cannot proceed.', 'error');
      process.exit(1);
    }

    this.log('Prerequisites check passed');
    this.log('');

    // Run all validation tests
    const tests = [
      { name: 'Infrastructure Validation', fn: () => this.runInfrastructureValidation() },
      { name: 'Network Connectivity Test', fn: () => this.runNetworkConnectivityTest() },
      { name: 'Services Functionality Test', fn: () => this.runServicesFunctionalityTest() }
    ];

    for (const test of tests) {
      this.log(`\n${'='.repeat(50)}`);
      this.log(`RUNNING: ${test.name.toUpperCase()}`);
      this.log('='.repeat(50));
      
      try {
        await test.fn();
      } catch (error) {
        this.log(`Fatal error in ${test.name}: ${error.message}`, 'error');
      }
      
      this.log('='.repeat(50));
    }

    // Generate and display summary
    const { report, reportPath } = this.generateSummaryReport();
    this.displaySummary(report, reportPath);

    // Exit with appropriate code
    process.exit(report.summary.overall ? 0 : 1);
  }
}

// Environment setup helper
function setupEnvironment() {
  // Set default values if not provided
  if (!process.env.AWS_REGION) {
    process.env.AWS_REGION = 'us-east-1';
  }
  
  if (!process.env.PROJECT_NAME) {
    process.env.PROJECT_NAME = 'direct-fan-platform';
  }
  
  if (!process.env.ENVIRONMENT) {
    process.env.ENVIRONMENT = 'prod';
  }
}

// Main execution
async function main() {
  setupEnvironment();
  
  const checkpoint = new InfrastructureCheckpoint();
  await checkpoint.run();
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Infrastructure checkpoint interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Infrastructure checkpoint terminated');
  process.exit(143);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default InfrastructureCheckpoint;