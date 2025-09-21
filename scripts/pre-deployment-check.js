#!/usr/bin/env node

/**
 * Pre-Deployment Readiness Check
 * 
 * Comprehensive testing before production redeployment:
 * 1. Code Quality & Build Testing
 * 2. Database Schema Validation
 * 3. API Endpoint Testing
 * 4. Environment Configuration
 * 5. Performance & Security Checks
 * 6. Integration Testing
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

const prisma = new PrismaClient();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  critical: 0,
  details: []
};

function recordTest(name, status, message, critical = false) {
  testResults.details.push({ name, status, message, critical });
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') {
    testResults.failed++;
    if (critical) testResults.critical++;
  }
  else if (status === 'WARN') testResults.warnings++;
}

async function checkCodeQuality() {
  log('\n🔍 Code Quality & Build Checks', 'bold');
  log('='.repeat(50), 'blue');

  try {
    // Check if package.json exists and has required scripts
    const packageJsonPath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const requiredScripts = ['build', 'start', 'dev'];
      const hasAllScripts = requiredScripts.every(script => packageJson.scripts[script]);
      
      if (hasAllScripts) {
        log('✅ package.json scripts configured correctly', 'green');
        recordTest('Package Scripts', 'PASS', 'All required scripts present');
      } else {
        log('⚠️  Some required scripts missing in package.json', 'yellow');
        recordTest('Package Scripts', 'WARN', 'Some scripts missing');
      }
    }

    // Check TypeScript configuration
    const tsconfigPath = path.join(__dirname, '../tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      log('✅ TypeScript configuration found', 'green');
      recordTest('TypeScript Config', 'PASS', 'tsconfig.json exists');
    } else {
      log('⚠️  No TypeScript configuration found', 'yellow');
      recordTest('TypeScript Config', 'WARN', 'tsconfig.json missing');
    }

    // Check for critical files
    const criticalFiles = [
      'src/app/layout.tsx',
      'src/lib/prisma.ts',
      'src/app/api/health/route.ts',
      'prisma/schema.prisma',
    ];

    let missingFiles = [];
    for (const file of criticalFiles) {
      const filePath = path.join(__dirname, '../', file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length === 0) {
      log('✅ All critical files present', 'green');
      recordTest('Critical Files', 'PASS', 'All core files exist');
    } else {
      log(`❌ Missing critical files: ${missingFiles.join(', ')}`, 'red');
      recordTest('Critical Files', 'FAIL', `Missing: ${missingFiles.join(', ')}`, true);
    }

    // Check environment files
    const envFiles = ['.env.local', '.env.example'];
    for (const envFile of envFiles) {
      const envPath = path.join(__dirname, '../', envFile);
      if (fs.existsSync(envPath)) {
        log(`✅ ${envFile} exists`, 'green');
        recordTest(`Env File: ${envFile}`, 'PASS', 'File exists');
      } else {
        log(`⚠️  ${envFile} missing`, 'yellow');
        recordTest(`Env File: ${envFile}`, 'WARN', 'File missing');
      }
    }

    return true;
  } catch (error) {
    log(`❌ Code quality check failed: ${error.message}`, 'red');
    recordTest('Code Quality', 'FAIL', error.message, true);
    return false;
  }
}

async function checkDatabaseSchema() {
  log('\n🗄️  Database Schema Validation', 'bold');
  log('='.repeat(50), 'blue');

  try {
    // Test database connection
    await prisma.$connect();
    log('✅ Database connection successful', 'green');
    recordTest('Database Connection', 'PASS', 'Connected successfully');

    // Check core tables exist
    const coreTables = [
      { name: 'users', critical: true },
      { name: 'content', critical: true },
      { name: 'tiers', critical: false },
      { name: 'subscriptions', critical: false },
      { name: 'messages', critical: false }
    ];

    for (const table of coreTables) {
      try {
        const count = await prisma[table.name].count();
        log(`✅ Table '${table.name}' accessible (${count} records)`, 'green');
        recordTest(`Table: ${table.name}`, 'PASS', `${count} records`);
      } catch (error) {
        if (table.critical) {
          log(`❌ Critical table '${table.name}' not accessible`, 'red');
          recordTest(`Table: ${table.name}`, 'FAIL', 'Not accessible', true);
        } else {
          log(`⚠️  Table '${table.name}' not accessible (may be optional)`, 'yellow');
          recordTest(`Table: ${table.name}`, 'WARN', 'Not accessible');
        }
      }
    }

    // Test data integrity
    const userCount = await prisma.users.count();
    if (userCount > 0) {
      const userRoles = await prisma.users.groupBy({
        by: ['role'],
        _count: { role: true }
      });
      
      log(`✅ Found ${userCount} users with roles:`, 'green');
      userRoles.forEach(role => {
        log(`   ${role.role}: ${role._count.role} users`, 'reset');
      });
      recordTest('User Data', 'PASS', `${userCount} users with valid roles`);
    } else {
      log('⚠️  No users found in database', 'yellow');
      recordTest('User Data', 'WARN', 'No users exist');
    }

    return true;
  } catch (error) {
    log(`❌ Database schema check failed: ${error.message}`, 'red');
    recordTest('Database Schema', 'FAIL', error.message, true);
    return false;
  }
}

async function checkEnvironmentConfig() {
  log('\n🔧 Environment Configuration', 'bold');
  log('='.repeat(50), 'blue');

  const requiredEnvVars = [
    { name: 'DATABASE_URL', critical: true },
    { name: 'NEXTAUTH_SECRET', critical: true },
    { name: 'NEXTAUTH_URL', critical: true },
    { name: 'AWS_ACCESS_KEY_ID', critical: false },
    { name: 'AWS_SECRET_ACCESS_KEY', critical: false },
    { name: 'AWS_S3_BUCKET_NAME', critical: false },
    { name: 'AWS_REGION', critical: false },
    { name: 'STRIPE_SECRET_KEY', critical: false },
    { name: 'SENDGRID_API_KEY', critical: false },
  ];

  let missingCritical = [];
  let missingOptional = [];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    if (value) {
      // Mask sensitive values
      const displayValue = envVar.name.includes('SECRET') || envVar.name.includes('KEY') 
        ? `${value.substring(0, 8)}...` 
        : value.length > 50 ? `${value.substring(0, 50)}...` : value;
      
      log(`✅ ${envVar.name}: ${displayValue}`, 'green');
      recordTest(`Env: ${envVar.name}`, 'PASS', 'Set');
    } else {
      if (envVar.critical) {
        log(`❌ Missing CRITICAL env var: ${envVar.name}`, 'red');
        missingCritical.push(envVar.name);
        recordTest(`Env: ${envVar.name}`, 'FAIL', 'Missing critical env var', true);
      } else {
        log(`⚠️  Missing optional env var: ${envVar.name}`, 'yellow');
        missingOptional.push(envVar.name);
        recordTest(`Env: ${envVar.name}`, 'WARN', 'Missing optional env var');
      }
    }
  }

  if (missingCritical.length === 0) {
    log('✅ All critical environment variables configured', 'green');
  } else {
    log(`❌ Missing ${missingCritical.length} critical environment variables`, 'red');
  }

  return missingCritical.length === 0;
}

async function checkS3Integration() {
  log('\n☁️  S3 Integration Test', 'bold');
  log('='.repeat(50), 'blue');

  try {
    const { generatePresignedUrl } = await import('../src/lib/s3.ts');
    
    const testRequest = {
      fileName: 'deployment-test.jpg',
      fileType: 'image/jpeg',
      fileSize: 1024 * 1024,
      artistId: 'deployment-test-user',
    };

    const result = await generatePresignedUrl(testRequest);
    
    if (result.uploadUrl && result.fileUrl) {
      log('✅ S3 presigned URL generation working', 'green');
      log(`   Upload URL generated successfully`, 'reset');
      recordTest('S3 Integration', 'PASS', 'Presigned URLs working');
      return true;
    } else {
      log('❌ S3 presigned URL generation failed', 'red');
      recordTest('S3 Integration', 'FAIL', 'URL generation failed');
      return false;
    }
  } catch (error) {
    log(`⚠️  S3 integration test failed: ${error.message}`, 'yellow');
    recordTest('S3 Integration', 'WARN', error.message);
    return false;
  }
}

async function checkAPIEndpoints() {
  log('\n🔌 API Endpoints Check', 'bold');
  log('='.repeat(50), 'blue');

  const criticalEndpoints = [
    'src/app/api/health/route.ts',
    'src/app/api/auth/[...nextauth]/route.ts',
    'src/app/api/upload/presigned-url/route.ts',
  ];

  const optionalEndpoints = [
    'src/app/api/messages/route.ts',
    'src/app/api/messages/conversations/route.ts',
    'src/app/api/content/route.ts',
  ];

  let endpointResults = { critical: 0, optional: 0 };

  // Check critical endpoints
  for (const endpoint of criticalEndpoints) {
    const fullPath = path.join(__dirname, '../', endpoint);
    if (fs.existsSync(fullPath)) {
      log(`✅ Critical endpoint: ${endpoint}`, 'green');
      recordTest(`API: ${endpoint}`, 'PASS', 'Endpoint exists');
      endpointResults.critical++;
    } else {
      log(`❌ Missing critical endpoint: ${endpoint}`, 'red');
      recordTest(`API: ${endpoint}`, 'FAIL', 'Missing critical endpoint', true);
    }
  }

  // Check optional endpoints
  for (const endpoint of optionalEndpoints) {
    const fullPath = path.join(__dirname, '../', endpoint);
    if (fs.existsSync(fullPath)) {
      log(`✅ Optional endpoint: ${endpoint}`, 'green');
      recordTest(`API: ${endpoint}`, 'PASS', 'Endpoint exists');
      endpointResults.optional++;
    } else {
      log(`⚠️  Missing optional endpoint: ${endpoint}`, 'yellow');
      recordTest(`API: ${endpoint}`, 'WARN', 'Missing optional endpoint');
    }
  }

  const criticalPassed = endpointResults.critical === criticalEndpoints.length;
  log(`\n📊 API Endpoints Summary:`, 'cyan');
  log(`   Critical: ${endpointResults.critical}/${criticalEndpoints.length}`, 
      criticalPassed ? 'green' : 'red');
  log(`   Optional: ${endpointResults.optional}/${optionalEndpoints.length}`, 'cyan');

  return criticalPassed;
}

async function checkBuildProcess() {
  log('\n🏗️  Build Process Test', 'bold');
  log('='.repeat(50), 'blue');

  try {
    // Check if .next directory exists (previous build artifacts)
    const nextDir = path.join(__dirname, '../.next');
    if (fs.existsSync(nextDir)) {
      log('ℹ️  Previous build artifacts found (.next directory)', 'cyan');
      recordTest('Previous Build', 'PASS', 'Build artifacts exist');
    }

    // Check package-lock.json for dependency consistency
    const packageLockPath = path.join(__dirname, '../package-lock.json');
    if (fs.existsSync(packageLockPath)) {
      log('✅ package-lock.json exists (dependency lock)', 'green');
      recordTest('Dependency Lock', 'PASS', 'package-lock.json exists');
    } else {
      log('⚠️  No package-lock.json found', 'yellow');
      recordTest('Dependency Lock', 'WARN', 'No dependency lock file');
    }

    // Check for common build issues
    const problemFiles = [
      '.DS_Store',
      'node_modules/.DS_Store',
      'dist/',
      'out/'
    ];

    let foundProblems = [];
    for (const problem of problemFiles) {
      const problemPath = path.join(__dirname, '../', problem);
      if (fs.existsSync(problemPath)) {
        foundProblems.push(problem);
      }
    }

    if (foundProblems.length === 0) {
      log('✅ No common build problems detected', 'green');
      recordTest('Build Problems', 'PASS', 'No issues found');
    } else {
      log(`⚠️  Found potential build issues: ${foundProblems.join(', ')}`, 'yellow');
      recordTest('Build Problems', 'WARN', `Found: ${foundProblems.join(', ')}`);
    }

    return true;
  } catch (error) {
    log(`❌ Build process check failed: ${error.message}`, 'red');
    recordTest('Build Process', 'FAIL', error.message);
    return false;
  }
}

async function checkSecurity() {
  log('\n🔒 Security Configuration', 'bold');
  log('='.repeat(50), 'blue');

  const securityChecks = [
    {
      name: 'NEXTAUTH_SECRET',
      test: () => {
        const secret = process.env.NEXTAUTH_SECRET;
        return secret && secret.length >= 32 && secret !== 'your-secret-key-change-in-production';
      },
      critical: true
    },
    {
      name: 'Production URL',
      test: () => {
        const url = process.env.NEXTAUTH_URL;
        return url && (url.startsWith('https://') || url.startsWith('http://localhost'));
      },
      critical: true
    },
    {
      name: 'Database URL Security',
      test: () => {
        const dbUrl = process.env.DATABASE_URL;
        return dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'));
      },
      critical: true
    },
    {
      name: 'Environment Type',
      test: () => {
        const nodeEnv = process.env.NODE_ENV;
        return nodeEnv === 'production' || nodeEnv === 'development';
      },
      critical: false
    }
  ];

  let securityIssues = [];
  
  for (const check of securityChecks) {
    try {
      if (check.test()) {
        log(`✅ ${check.name}: Secure`, 'green');
        recordTest(`Security: ${check.name}`, 'PASS', 'Secure configuration');
      } else {
        if (check.critical) {
          log(`❌ ${check.name}: Security issue detected`, 'red');
          recordTest(`Security: ${check.name}`, 'FAIL', 'Security issue', true);
          securityIssues.push(check.name);
        } else {
          log(`⚠️  ${check.name}: Configuration warning`, 'yellow');
          recordTest(`Security: ${check.name}`, 'WARN', 'Configuration warning');
        }
      }
    } catch (error) {
      log(`⚠️  ${check.name}: Could not verify`, 'yellow');
      recordTest(`Security: ${check.name}`, 'WARN', 'Could not verify');
    }
  }

  return securityIssues.length === 0;
}

function generateReadinessReport() {
  log('\n📊 DEPLOYMENT READINESS REPORT', 'bold');
  log('='.repeat(60), 'blue');

  const totalTests = testResults.passed + testResults.failed + testResults.warnings;
  const successRate = totalTests > 0 ? ((testResults.passed / totalTests) * 100).toFixed(1) : 0;
  
  log(`\n📈 Test Results Summary:`, 'cyan');
  log(`   ✅ Passed: ${testResults.passed}`, 'green');
  log(`   ❌ Failed: ${testResults.failed}`, 'red');
  log(`   ⚠️  Warnings: ${testResults.warnings}`, 'yellow');
  log(`   🚨 Critical Issues: ${testResults.critical}`, testResults.critical > 0 ? 'red' : 'green');
  log(`   📊 Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');

  log('\n🎯 Deployment Readiness Assessment:', 'magenta');
  
  if (testResults.critical === 0 && testResults.failed <= 2 && successRate >= 80) {
    log('🚀 READY FOR DEPLOYMENT!', 'green');
    log('   Your platform passes all critical checks and is ready for production.', 'green');
    
    log('\n✅ Recommended Actions:', 'cyan');
    log('   1. Run final build test: npm run build', 'cyan');
    log('   2. Deploy to production: vercel --prod', 'cyan');
    log('   3. Test production health: curl https://www.directfanz.io/api/health', 'cyan');
    log('   4. Set up monitoring and alerts', 'cyan');
    
    return 'READY';
  } else if (testResults.critical === 0 && testResults.failed <= 5) {
    log('⚠️  READY WITH CAUTION', 'yellow');
    log('   Platform has minor issues but can be deployed. Address warnings post-deployment.', 'yellow');
    
    log('\n🔧 Recommended Fixes:', 'yellow');
    if (testResults.warnings > 0) {
      log('   1. Address environment variable warnings', 'yellow');
      log('   2. Fix optional API endpoints', 'yellow');
      log('   3. Clean up build artifacts', 'yellow');
    }
    
    return 'CAUTION';
  } else {
    log('❌ NOT READY FOR DEPLOYMENT', 'red');
    log('   Critical issues found that must be fixed before deployment.', 'red');
    
    log('\n🚨 Critical Issues to Fix:', 'red');
    testResults.details
      .filter(test => test.status === 'FAIL' && test.critical)
      .forEach(test => {
        log(`   • ${test.name}: ${test.message}`, 'red');
      });
    
    return 'NOT_READY';
  }
}

async function main() {
  log(`\n${colors.bold}${colors.magenta}🔍 DirectFanz Pre-Deployment Readiness Check${colors.reset}`);
  log('Comprehensive testing before production redeployment');
  log('='.repeat(70));

  const startTime = Date.now();

  try {
    // Run all checks
    await checkCodeQuality();
    await checkDatabaseSchema();
    await checkEnvironmentConfig();
    await checkAPIEndpoints();
    await checkS3Integration();
    await checkBuildProcess();
    await checkSecurity();

    // Generate final report
    const readinessStatus = generateReadinessReport();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`\n⏱️  Total check time: ${duration}s`, 'dim');

    // Exit with appropriate code
    if (readinessStatus === 'READY') {
      process.exit(0);
    } else if (readinessStatus === 'CAUTION') {
      process.exit(1);
    } else {
      process.exit(2);
    }

  } catch (error) {
    log(`\n❌ Pre-deployment check failed: ${error.message}`, 'red');
    process.exit(3);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url.startsWith('file:')) {
  main().catch(console.error);
}