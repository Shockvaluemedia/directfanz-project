#!/usr/bin/env node

/**
 * Pre-Migration Testing Master Script
 * 
 * This script implements Task 13: Checkpoint - Pre-Migration Testing
 * from the AWS conversion implementation plan.
 * 
 * It orchestrates comprehensive testing to ensure all AWS infrastructure
 * is ready for migration by running:
 * 
 * 1. Infrastructure validation tests
 * 2. Network connectivity tests  
 * 3. AWS services functionality tests
 * 4. Property-based infrastructure tests
 * 5. Integration verification tests
 * 
 * This checkpoint must pass before proceeding to data migration.
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PreMigrationTester {
  constructor() {
    this.results = {
      infrastructureValidation: null,
      networkConnectivity: null,
      servicesFunctionality: null,
      propertyBasedTests: null,
      integrationVerification: null,
      stagingEnvironmentVerification: null,
      startTime: new Date(),
      endTime: null,
      testDetails: []
    };
    
    this.propertyTestResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '🎉' : '📋';
    console.log(`${timestamp} ${prefix} ${message}`);
    
    this.results.testDetails.push({
      timestamp,
      type,
      message
    });
  }

  async runScript(scriptPath, description, timeout = 300000) {
    this.log(`Starting ${description}...`);
    
    return new Promise((resolve) => {
      const child = spawn('node', [scriptPath], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        this.log(`${description} timed out after ${timeout/1000} seconds`, 'error');
        resolve(false);
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          this.log(`${description} completed successfully`, 'success');
          resolve(true);
        } else {
          this.log(`${description} failed with exit code ${code}`, 'error');
          resolve(false);
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        this.log(`${description} failed to start: ${error.message}`, 'error');
        resolve(false);
      });
    });
  }

  async runJestTests(testPattern, description, timeout = 600000) {
    this.log(`Starting ${description}...`);
    
    return new Promise((resolve) => {
      const child = spawn('npx', ['jest', testPattern, '--verbose', '--runInBand'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Stream output in real-time
        process.stdout.write(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        this.log(`${description} timed out after ${timeout/1000} seconds`, 'error');
        resolve({ success: false, output, errorOutput });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        
        // Parse Jest output for test results
        const testResults = this.parseJestOutput(output);
        this.propertyTestResults.push(...testResults);
        
        if (code === 0) {
          this.log(`${description} completed successfully`, 'success');
          resolve({ success: true, output, errorOutput, testResults });
        } else {
          this.log(`${description} failed with exit code ${code}`, 'error');
          resolve({ success: false, output, errorOutput, testResults });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        this.log(`${description} failed to start: ${error.message}`, 'error');
        resolve({ success: false, output: '', errorOutput: error.message });
      });
    });
  }

  parseJestOutput(output) {
    const results = [];
    const lines = output.split('\n');
    
    let currentTest = null;
    for (const line of lines) {
      // Match test names
      const testMatch = line.match(/^\s*✓\s+(.+?)\s+\(\d+ms\)/) || line.match(/^\s*✗\s+(.+?)$/);
      if (testMatch) {
        if (currentTest) {
          results.push(currentTest);
        }
        currentTest = {
          name: testMatch[1].trim(),
          status: line.includes('✓') ? 'PASSED' : 'FAILED',
          duration: line.match(/\((\d+)ms\)/) ? parseInt(line.match(/\((\d+)ms\)/)[1]) : 0,
          error: null
        };
      }
      
      // Match error messages
      if (currentTest && currentTest.status === 'FAILED' && line.trim().startsWith('Error:')) {
        currentTest.error = line.trim();
      }
    }
    
    if (currentTest) {
      results.push(currentTest);
    }
    
    return results;
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites for pre-migration testing...');
    
    // Check if AWS CLI is configured
    try {
      execSync('aws sts get-caller-identity', { stdio: 'pipe' });
      this.log('AWS credentials are configured');
    } catch (error) {
      this.log('AWS credentials not configured or AWS CLI not available', 'error');
      this.log('Please run: aws configure', 'error');
      return false;
    }

    // Check required environment variables
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

    // Check Node.js dependencies
    try {
      await import('aws-sdk');
      this.log('AWS SDK is available');
    } catch (error) {
      this.log('AWS SDK not found. Please run: npm install aws-sdk', 'error');
      return false;
    }

    // Check Jest for property-based tests
    try {
      execSync('npx jest --version', { stdio: 'pipe' });
      this.log('Jest testing framework is available');
    } catch (error) {
      this.log('Jest not found. Please run: npm install --save-dev jest', 'error');
      return false;
    }

    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      this.log('Created logs directory');
    }

    // Check if infrastructure validation scripts exist
    const requiredScripts = [
      'infrastructure-validation.js',
      'network-connectivity-test.js',
      'aws-services-functionality-test.js'
    ];

    for (const script of requiredScripts) {
      const scriptPath = path.join(__dirname, script);
      if (!fs.existsSync(scriptPath)) {
        this.log(`Required script not found: ${script}`, 'error');
        return false;
      }
    }

    // Check if property-based test files exist
    const testDir = path.join(__dirname, '..', 'tests', 'infrastructure');
    if (!fs.existsSync(testDir)) {
      this.log('Infrastructure tests directory not found', 'error');
      return false;
    }

    const testFiles = fs.readdirSync(testDir).filter(file => file.endsWith('.test.js'));
    this.log(`Found ${testFiles.length} property-based test files`);

    if (testFiles.length === 0) {
      this.log('No property-based test files found', 'warning');
    }

    return true;
  }

  async runInfrastructureValidation() {
    const scriptPath = path.join(__dirname, 'infrastructure-validation.js');
    const result = await this.runScript(scriptPath, 'Infrastructure Component Validation', 600000);
    this.results.infrastructureValidation = result;
    return result;
  }

  async runNetworkConnectivityTest() {
    const scriptPath = path.join(__dirname, 'network-connectivity-test.js');
    const result = await this.runScript(scriptPath, 'Network Connectivity Testing', 300000);
    this.results.networkConnectivity = result;
    return result;
  }

  async runServicesFunctionalityTest() {
    const scriptPath = path.join(__dirname, 'aws-services-functionality-test.js');
    const result = await this.runScript(scriptPath, 'AWS Services Functionality Testing', 600000);
    this.results.servicesFunctionality = result;
    return result;
  }

  async runPropertyBasedTests() {
    this.log('Running property-based infrastructure tests...');
    
    // Run all infrastructure property tests
    const testPattern = 'tests/infrastructure/*.test.js';
    const result = await this.runJestTests(testPattern, 'Property-Based Infrastructure Tests', 1200000);
    
    this.results.propertyBasedTests = result.success;
    return result.success;
  }

  async runIntegrationVerification() {
    const scriptPath = path.join(__dirname, 'integration-verification.js');
    const result = await this.runScript(scriptPath, 'Integration Verification Testing', 600000);
    this.results.integrationVerification = result;
    return result;
  }

  async runStagingEnvironmentVerification() {
    const scriptPath = path.join(__dirname, 'staging-environment-verification.js');
    const result = await this.runScript(scriptPath, 'Staging Environment Verification', 300000);
    this.results.stagingEnvironmentVerification = result;
    return result;
  }

  generateComprehensiveReport() {
    this.results.endTime = new Date();
    const duration = (this.results.endTime - this.results.startTime) / 1000;

    const report = {
      checkpoint: 'Pre-Migration Testing',
      timestamp: this.results.endTime.toISOString(),
      duration: `${duration.toFixed(2)} seconds`,
      project: process.env.PROJECT_NAME || 'direct-fan-platform',
      environment: process.env.ENVIRONMENT || 'prod',
      region: process.env.AWS_REGION || 'us-east-1',
      testResults: {
        infrastructureValidation: this.results.infrastructureValidation,
        networkConnectivity: this.results.networkConnectivity,
        servicesFunctionality: this.results.servicesFunctionality,
        propertyBasedTests: this.results.propertyBasedTests,
        integrationVerification: this.results.integrationVerification,
        stagingEnvironmentVerification: this.results.stagingEnvironmentVerification
      },
      propertyTestDetails: this.propertyTestResults,
      summary: {
        totalTestSuites: 6,
        passedTestSuites: Object.values(this.results).filter(r => r === true).length,
        failedTestSuites: Object.values(this.results).filter(r => r === false).length,
        overallResult: Object.values(this.results).every(r => r === true),
        readyForMigration: null // Will be set based on overall result
      },
      recommendations: [],
      testDetails: this.results.testDetails
    };

    // Set migration readiness
    report.summary.readyForMigration = report.summary.overallResult;

    // Generate recommendations based on failures
    if (!report.summary.overallResult) {
      if (!this.results.infrastructureValidation) {
        report.recommendations.push('Fix infrastructure component issues before proceeding with migration');
      }
      if (!this.results.networkConnectivity) {
        report.recommendations.push('Resolve network connectivity issues - check security groups and routing');
      }
      if (!this.results.servicesFunctionality) {
        report.recommendations.push('Address AWS services functionality issues');
      }
      if (!this.results.propertyBasedTests) {
        report.recommendations.push('Fix failing property-based tests - these ensure correctness properties');
      }
      if (!this.results.integrationVerification) {
        report.recommendations.push('Resolve integration issues between services');
      }
      if (!this.results.stagingEnvironmentVerification) {
        report.recommendations.push('Fix staging environment configuration issues');
      }
    } else {
      report.recommendations.push('All tests passed - infrastructure is ready for migration');
      report.recommendations.push('Proceed to Task 14: Data Migration Execution');
    }

    // Save report to file
    const reportPath = path.join(__dirname, '..', 'logs', `pre-migration-testing-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return { report, reportPath };
  }

  displayComprehensiveSummary(report, reportPath) {
    this.log('');
    this.log('='.repeat(80));
    this.log('PRE-MIGRATION TESTING CHECKPOINT SUMMARY');
    this.log('='.repeat(80));
    this.log(`Project: ${report.project}`);
    this.log(`Environment: ${report.environment}`);
    this.log(`Region: ${report.region}`);
    this.log(`Duration: ${report.duration}`);
    this.log('');
    
    this.log('Test Suite Results:');
    this.log(`  Infrastructure Validation:     ${report.testResults.infrastructureValidation ? '✅ PASSED' : '❌ FAILED'}`);
    this.log(`  Network Connectivity:          ${report.testResults.networkConnectivity ? '✅ PASSED' : '❌ FAILED'}`);
    this.log(`  Services Functionality:        ${report.testResults.servicesFunctionality ? '✅ PASSED' : '❌ FAILED'}`);
    this.log(`  Property-Based Tests:          ${report.testResults.propertyBasedTests ? '✅ PASSED' : '❌ FAILED'}`);
    this.log(`  Integration Verification:      ${report.testResults.integrationVerification ? '✅ PASSED' : '❌ FAILED'}`);
    this.log(`  Staging Environment:           ${report.testResults.stagingEnvironmentVerification ? '✅ PASSED' : '❌ FAILED'}`);
    this.log('');

    if (this.propertyTestResults.length > 0) {
      this.log('Property Test Details:');
      const passedTests = this.propertyTestResults.filter(t => t.status === 'PASSED');
      const failedTests = this.propertyTestResults.filter(t => t.status === 'FAILED');
      
      this.log(`  Total Property Tests: ${this.propertyTestResults.length}`);
      this.log(`  Passed: ${passedTests.length}`);
      this.log(`  Failed: ${failedTests.length}`);
      
      if (failedTests.length > 0) {
        this.log('  Failed Tests:');
        failedTests.forEach(test => {
          this.log(`    - ${test.name}`, 'error');
          if (test.error) {
            this.log(`      ${test.error}`, 'error');
          }
        });
      }
      this.log('');
    }
    
    this.log(`Overall Result: ${report.summary.passedTestSuites}/${report.summary.totalTestSuites} test suites passed`);
    this.log('');
    
    if (report.summary.readyForMigration) {
      this.log('🎉 CHECKPOINT PASSED - Infrastructure is ready for migration!', 'success');
      this.log('✅ All AWS infrastructure components are validated and functional', 'success');
      this.log('✅ Network connectivity is properly configured', 'success');
      this.log('✅ All AWS services are functioning correctly', 'success');
      this.log('✅ Property-based tests confirm correctness properties', 'success');
      this.log('✅ Service integrations are working properly', 'success');
      this.log('✅ Staging environment is properly configured', 'success');
      this.log('');
      this.log('🚀 Ready to proceed to Task 14: Data Migration Execution', 'success');
    } else {
      this.log('❌ CHECKPOINT FAILED - Infrastructure is NOT ready for migration', 'error');
      this.log('');
      this.log('Recommendations:');
      report.recommendations.forEach(rec => {
        this.log(`  • ${rec}`, 'warning');
      });
      this.log('');
      this.log('⚠️  DO NOT proceed with migration until all issues are resolved', 'error');
    }
    
    this.log('');
    this.log(`Detailed report saved to: ${reportPath}`);
    this.log('='.repeat(80));
  }

  async run() {
    this.log('🚀 Starting Pre-Migration Testing Checkpoint');
    this.log('This checkpoint validates that all AWS infrastructure is ready for migration');
    this.log(`Timestamp: ${this.results.startTime.toISOString()}`);
    this.log('');

    // Check prerequisites
    const prerequisitesOk = await this.checkPrerequisites();
    if (!prerequisitesOk) {
      this.log('Prerequisites check failed. Cannot proceed with testing.', 'error');
      process.exit(1);
    }

    this.log('Prerequisites check passed');
    this.log('');

    // Run all test suites in sequence
    const testSuites = [
      { 
        name: 'Infrastructure Component Validation', 
        fn: () => this.runInfrastructureValidation(),
        description: 'Validates all AWS infrastructure components are deployed and configured correctly'
      },
      { 
        name: 'Network Connectivity Testing', 
        fn: () => this.runNetworkConnectivityTest(),
        description: 'Tests network connectivity between all infrastructure components'
      },
      { 
        name: 'AWS Services Functionality Testing', 
        fn: () => this.runServicesFunctionalityTest(),
        description: 'Verifies all AWS services are functioning correctly with basic operations'
      },
      { 
        name: 'Property-Based Infrastructure Tests', 
        fn: () => this.runPropertyBasedTests(),
        description: 'Runs comprehensive property-based tests to verify correctness properties'
      },
      { 
        name: 'Integration Verification', 
        fn: () => this.runIntegrationVerification(),
        description: 'Verifies all services can communicate and integrate properly'
      },
      { 
        name: 'Staging Environment Verification', 
        fn: () => this.runStagingEnvironmentVerification(),
        description: 'Verifies staging environment is properly configured for migration testing'
      }
    ];

    for (const testSuite of testSuites) {
      this.log(`\n${'='.repeat(60)}`);
      this.log(`RUNNING: ${testSuite.name.toUpperCase()}`);
      this.log(`Description: ${testSuite.description}`);
      this.log('='.repeat(60));
      
      try {
        await testSuite.fn();
      } catch (error) {
        this.log(`Fatal error in ${testSuite.name}: ${error.message}`, 'error');
      }
      
      this.log('='.repeat(60));
    }

    // Generate and display comprehensive summary
    const { report, reportPath } = this.generateComprehensiveReport();
    this.displayComprehensiveSummary(report, reportPath);

    // Exit with appropriate code
    process.exit(report.summary.readyForMigration ? 0 : 1);
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
  
  const tester = new PreMigrationTester();
  await tester.run();
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Pre-migration testing interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Pre-migration testing terminated');
  process.exit(143);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default PreMigrationTester;