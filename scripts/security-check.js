#!/usr/bin/env node

/**
 * Security check script for Direct Fan Platform
 * This script performs basic security checks on the codebase
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

// Configuration
const config = {
  // Directories to scan
  scanDirs: ['src', 'prisma', 'scripts'],

  // Files to exclude
  excludeFiles: ['.git', 'node_modules', '.next', 'public/assets'],

  // Patterns to check for
  patterns: {
    secrets: [
      /(['"])(?:api|jwt|token|secret|password|passwd|pwd|key).*?\1\s*(?::|=>|=)\s*(['"])(?!process\.env)[^'"\s]+\2/gi,
      /const\s+(?:api|jwt|token|secret|password|passwd|pwd|key).*?=\s*(['"])(?!process\.env)[^'"\s]+\1/gi,
    ],
    sql_injection: [
      /execute\(\s*['"].*?\$\{.*?\}/gi,
      /query\(\s*['"].*?\$\{.*?\}/gi,
      /executeQuery\(\s*['"].*?\$\{.*?\}/gi,
    ],
    xss: [/innerHTML\s*=/g, /document\.write/g],
    insecure_cookies: [/cookie.*?secure:\s*false/gi, /cookie.*?httpOnly:\s*false/gi],
    eval_usage: [
      /eval\(/g,
      /new Function\(/g,
      /setTimeout\(\s*['"`][^'"`]+['"`]/g,
      /setInterval\(\s*['"`][^'"`]+['"`]/g,
    ],
    insecure_random: [/Math\.random\(\)/g],
  },

  // Dependencies to check
  dependencyCheck: true,
};

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

// Results storage
const results = {
  issues: [],
  warnings: [],
  passed: [],
};

// Helper functions
function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function scanFile(filePath, patterns) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileIssues = [];

  // Check each pattern
  Object.entries(patterns).forEach(([type, regexList]) => {
    regexList.forEach(regex => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        const matchedText = match[0];

        fileIssues.push({
          type,
          file: filePath,
          line,
          match: matchedText,
        });
      }
    });
  });

  return fileIssues;
}

function walkDir(dir, callback) {
  if (config.excludeFiles.some(exclude => dir.includes(exclude))) {
    return;
  }

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else {
      callback(filePath);
    }
  });
}

function checkDependencies() {
  log('\n🔍 Checking dependencies for vulnerabilities...', colors.cyan);

  try {
    // Run npm audit
    const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
    const auditData = JSON.parse(auditOutput);

    if (auditData.metadata.vulnerabilities.total > 0) {
      const vulnCount = auditData.metadata.vulnerabilities;
      log(
        `⚠️  Found vulnerabilities: ${vulnCount.total} (${vulnCount.critical} critical, ${vulnCount.high} high, ${vulnCount.moderate} moderate, ${vulnCount.low} low)`,
        colors.yellow
      );

      // Add to results
      results.warnings.push({
        type: 'dependencies',
        message: `Found ${auditData.metadata.vulnerabilities.total} vulnerabilities in dependencies`,
        details: auditData.metadata.vulnerabilities,
      });

      // Show critical and high vulnerabilities
      if (auditData.vulnerabilities) {
        Object.values(auditData.vulnerabilities)
          .filter(vuln => ['critical', 'high'].includes(vuln.severity))
          .forEach(vuln => {
            log(
              `  - ${vuln.name}@${vuln.version}: ${vuln.severity} - ${vuln.title}`,
              colors.yellow
            );
          });
      }

      log('\nRun npm audit fix to attempt automatic fixes', colors.white);
    } else {
      log('✅ No vulnerabilities found in dependencies', colors.green);
      results.passed.push({
        type: 'dependencies',
        message: 'No vulnerabilities found in dependencies',
      });
    }
  } catch (error) {
    log('❌ Error checking dependencies: ' + error.message, colors.red);
    results.issues.push({
      type: 'dependencies',
      message: 'Error checking dependencies',
      details: error.message,
    });
  }
}

function checkEnvFile() {
  log('\n🔍 Checking environment files...', colors.cyan);

  const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];

  envFiles.forEach(envFile => {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      const lines = content.split('\n');

      // Check for actual secrets (not placeholders)
      const secretLines = lines.filter(line => {
        // Skip comments and empty lines
        if (line.startsWith('#') || line.trim() === '') return false;

        // Check if it contains a value that's not a placeholder
        const parts = line.split('=');
        if (parts.length < 2) return false;

        const value = parts.slice(1).join('=').trim();
        // Check if it's not a placeholder (placeholders often contain words like PLACEHOLDER, YOUR, or <>)
        return (
          value.length > 0 &&
          !value.includes('PLACEHOLDER') &&
          !value.includes('YOUR_') &&
          !value.includes('<') &&
          !value.includes('>')
        );
      });

      if (secretLines.length > 0 && !envFile.endsWith('.example')) {
        log(`⚠️  Found ${secretLines.length} potential secrets in ${envFile}`, colors.yellow);
        results.warnings.push({
          type: 'env_file',
          file: envFile,
          message: `Found ${secretLines.length} potential secrets in ${envFile}`,
        });
      }
    }
  });

  // Check if .env.example exists
  if (!fs.existsSync('.env.example') && !fs.existsSync('.env.local.example')) {
    log(
      '⚠️  No .env.example file found. Consider creating one with placeholder values.',
      colors.yellow
    );
    results.warnings.push({
      type: 'env_file',
      message: 'No .env.example file found',
    });
  } else {
    log('✅ Environment example file exists', colors.green);
    results.passed.push({
      type: 'env_file',
      message: 'Environment example file exists',
    });
  }
}

function checkSecurityHeaders() {
  log('\n🔍 Checking for security headers...', colors.cyan);

  const layoutFile = 'src/app/layout.tsx';
  const middlewareFile = 'src/middleware.ts';

  let hasSecurityHeaders = false;
  let hasCSP = false;

  if (fs.existsSync(layoutFile)) {
    const content = fs.readFileSync(layoutFile, 'utf8');
    hasSecurityHeaders =
      content.includes('X-Content-Type-Options') ||
      content.includes('X-Frame-Options') ||
      content.includes('Referrer-Policy');
    hasCSP = content.includes('Content-Security-Policy');
  }

  if (fs.existsSync(middlewareFile)) {
    const content = fs.readFileSync(middlewareFile, 'utf8');
    hasSecurityHeaders =
      hasSecurityHeaders ||
      content.includes('X-Content-Type-Options') ||
      content.includes('X-Frame-Options') ||
      content.includes('Referrer-Policy');
    hasCSP = hasCSP || content.includes('Content-Security-Policy');
  }

  if (!hasSecurityHeaders) {
    log('❌ Security headers not found in layout or middleware', colors.red);
    results.issues.push({
      type: 'security_headers',
      message: 'Security headers not found in layout or middleware',
    });
  } else {
    log('✅ Security headers found', colors.green);
    results.passed.push({
      type: 'security_headers',
      message: 'Security headers found',
    });
  }

  if (!hasCSP) {
    log('⚠️  Content Security Policy (CSP) not found', colors.yellow);
    results.warnings.push({
      type: 'csp',
      message: 'Content Security Policy (CSP) not found',
    });
  } else {
    log('✅ Content Security Policy (CSP) found', colors.green);
    results.passed.push({
      type: 'csp',
      message: 'Content Security Policy (CSP) found',
    });
  }
}

function checkAuthImplementation() {
  log('\n🔍 Checking authentication implementation...', colors.cyan);

  const authFiles = ['src/lib/auth.ts', 'src/app/api/auth', 'src/components/auth'];

  let hasAuthImplementation = false;
  let hasRBAC = false;

  authFiles.forEach(file => {
    if (fs.existsSync(file)) {
      hasAuthImplementation = true;

      // Check for RBAC
      if (fs.statSync(file).isDirectory()) {
        walkDir(file, filePath => {
          const content = fs.readFileSync(filePath, 'utf8');
          if (
            content.includes('role') &&
            (content.includes('permission') || content.includes('authorize'))
          ) {
            hasRBAC = true;
          }
        });
      } else {
        const content = fs.readFileSync(file, 'utf8');
        if (
          content.includes('role') &&
          (content.includes('permission') || content.includes('authorize'))
        ) {
          hasRBAC = true;
        }
      }
    }
  });

  if (!hasAuthImplementation) {
    log('❌ Authentication implementation not found', colors.red);
    results.issues.push({
      type: 'authentication',
      message: 'Authentication implementation not found',
    });
  } else {
    log('✅ Authentication implementation found', colors.green);
    results.passed.push({
      type: 'authentication',
      message: 'Authentication implementation found',
    });
  }

  if (!hasRBAC && hasAuthImplementation) {
    log('⚠️  Role-Based Access Control (RBAC) not found', colors.yellow);
    results.warnings.push({
      type: 'rbac',
      message: 'Role-Based Access Control (RBAC) not found',
    });
  } else if (hasRBAC) {
    log('✅ Role-Based Access Control (RBAC) found', colors.green);
    results.passed.push({
      type: 'rbac',
      message: 'Role-Based Access Control (RBAC) found',
    });
  }
}

function checkGDPRCompliance() {
  log('\n🔍 Checking GDPR compliance...', colors.cyan);

  const gdprFiles = ['src/components/ui/gdpr-consent.tsx', 'src/app/api/user/gdpr'];

  let hasGDPRConsent = false;
  let hasDataExport = false;
  let hasDataDeletion = false;

  gdprFiles.forEach(file => {
    if (fs.existsSync(file)) {
      if (file.includes('gdpr-consent')) {
        hasGDPRConsent = true;
      }

      if (fs.statSync(file).isDirectory()) {
        const files = fs.readdirSync(file);
        hasDataExport = hasDataExport || files.some(f => f.includes('export'));
        hasDataDeletion = hasDataDeletion || files.some(f => f.includes('delete'));
      }
    }
  });

  if (!hasGDPRConsent) {
    log('❌ GDPR consent component not found', colors.red);
    results.issues.push({
      type: 'gdpr',
      message: 'GDPR consent component not found',
    });
  } else {
    log('✅ GDPR consent component found', colors.green);
    results.passed.push({
      type: 'gdpr',
      message: 'GDPR consent component found',
    });
  }

  if (!hasDataExport) {
    log('⚠️  GDPR data export functionality not found', colors.yellow);
    results.warnings.push({
      type: 'gdpr',
      message: 'GDPR data export functionality not found',
    });
  } else {
    log('✅ GDPR data export functionality found', colors.green);
    results.passed.push({
      type: 'gdpr',
      message: 'GDPR data export functionality found',
    });
  }

  if (!hasDataDeletion) {
    log('⚠️  GDPR data deletion functionality not found', colors.yellow);
    results.warnings.push({
      type: 'gdpr',
      message: 'GDPR data deletion functionality not found',
    });
  } else {
    log('✅ GDPR data deletion functionality found', colors.green);
    results.passed.push({
      type: 'gdpr',
      message: 'GDPR data deletion functionality found',
    });
  }
}

// Main execution
function main() {
  log('\n🔒 Starting security check for Direct Fan Platform', colors.bold + colors.blue);
  log('=============================================\n', colors.blue);

  // Scan files for security issues
  log('🔍 Scanning files for security issues...', colors.cyan);

  let totalFiles = 0;
  let issuesFound = 0;

  config.scanDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      walkDir(dir, filePath => {
        totalFiles++;
        const fileIssues = scanFile(filePath, config.patterns);

        if (fileIssues.length > 0) {
          issuesFound += fileIssues.length;
          results.issues.push(...fileIssues);
        }
      });
    }
  });

  log(
    `Scanned ${totalFiles} files, found ${issuesFound} potential issues`,
    issuesFound > 0 ? colors.yellow : colors.green
  );

  // Check for hardcoded secrets
  if (results.issues.filter(issue => issue.type === 'secrets').length > 0) {
    log('\n⚠️  Potential hardcoded secrets found:', colors.yellow);
    results.issues
      .filter(issue => issue.type === 'secrets')
      .forEach(issue => {
        log(`  - ${issue.file}:${issue.line} - ${issue.match}`, colors.yellow);
      });
  }

  // Check for SQL injection vulnerabilities
  if (results.issues.filter(issue => issue.type === 'sql_injection').length > 0) {
    log('\n❌ Potential SQL injection vulnerabilities found:', colors.red);
    results.issues
      .filter(issue => issue.type === 'sql_injection')
      .forEach(issue => {
        log(`  - ${issue.file}:${issue.line} - ${issue.match}`, colors.red);
      });
  }

  // Check for XSS vulnerabilities
  if (results.issues.filter(issue => issue.type === 'xss').length > 0) {
    log('\n❌ Potential XSS vulnerabilities found:', colors.red);
    results.issues
      .filter(issue => issue.type === 'xss')
      .forEach(issue => {
        log(`  - ${issue.file}:${issue.line} - ${issue.match}`, colors.red);
      });
  }

  // Check for eval usage
  if (results.issues.filter(issue => issue.type === 'eval_usage').length > 0) {
    log('\n❌ Potentially dangerous eval usage found:', colors.red);
    results.issues
      .filter(issue => issue.type === 'eval_usage')
      .forEach(issue => {
        log(`  - ${issue.file}:${issue.line} - ${issue.match}`, colors.red);
      });
  }

  // Check for insecure random
  if (results.issues.filter(issue => issue.type === 'insecure_random').length > 0) {
    log('\n⚠️  Insecure random number generation found:', colors.yellow);
    results.issues
      .filter(issue => issue.type === 'insecure_random')
      .forEach(issue => {
        log(`  - ${issue.file}:${issue.line} - ${issue.match}`, colors.yellow);
      });
  }

  // Check dependencies
  if (config.dependencyCheck) {
    checkDependencies();
  }

  // Check environment files
  checkEnvFile();

  // Check security headers
  checkSecurityHeaders();

  // Check authentication implementation
  checkAuthImplementation();

  // Check GDPR compliance
  checkGDPRCompliance();

  // Summary
  log('\n📊 Security Check Summary', colors.bold + colors.blue);
  log('=====================', colors.blue);
  log(`✅ Passed checks: ${results.passed.length}`, colors.green);
  log(`⚠️  Warnings: ${results.warnings.length}`, colors.yellow);
  log(`❌ Issues: ${results.issues.length}`, colors.red);

  if (results.issues.length > 0) {
    log(
      '\n❌ Security issues were found. Please address them before deploying to production.',
      colors.bold + colors.red
    );
    process.exit(1);
  } else if (results.warnings.length > 0) {
    log(
      '\n⚠️  Security warnings were found. Consider addressing them to improve security.',
      colors.bold + colors.yellow
    );
    process.exit(0);
  } else {
    log('\n✅ No security issues found!', colors.bold + colors.green);
    process.exit(0);
  }
}

// Run the main function
main();
