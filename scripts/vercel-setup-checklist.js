#!/usr/bin/env node

/**
 * Vercel Production Deployment Checklist
 *
 * This script verifies that your project is ready for Vercel production deployment.
 * Run this before deploying to production to catch common issues.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Check results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

// Required environment variables for production
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
  'AWS_REGION',
  'SENDGRID_API_KEY',
  'FROM_EMAIL',
];

const OPTIONAL_ENV_VARS = [
  'REDIS_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
];

/**
 * Print formatted message
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Print section header
 */
function section(title) {
  console.log('');
  log(`${'='.repeat(60)}`, colors.cyan);
  log(` ${title}`, colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
  console.log('');
}

/**
 * Check if file exists
 */
function fileExists(filePath) {
  return fs.existsSync(path.join(projectRoot, filePath));
}

/**
 * Check if file has content
 */
function fileHasContent(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) return false;
  const content = fs.readFileSync(fullPath, 'utf8');
  return content.trim().length > 0;
}

/**
 * Run a check
 */
function check(name, testFn, isWarning = false) {
  try {
    const result = testFn();
    if (result) {
      results.passed.push(name);
      log(`✓ ${name}`, colors.green);
    } else {
      if (isWarning) {
        results.warnings.push(name);
        log(`⚠ ${name}`, colors.yellow);
      } else {
        results.failed.push(name);
        log(`✗ ${name}`, colors.red);
      }
    }
  } catch (error) {
    if (isWarning) {
      results.warnings.push(name);
      log(`⚠ ${name} (${error.message})`, colors.yellow);
    } else {
      results.failed.push(name);
      log(`✗ ${name} (${error.message})`, colors.red);
    }
  }
}

/**
 * Check 1: Project Files
 */
function checkProjectFiles() {
  section('1. Project Files');

  check('package.json exists', () => fileExists('package.json'));
  check('next.config.js exists', () => fileExists('next.config.js'));
  check('vercel.json exists', () => fileExists('vercel.json'));
  check('.gitignore exists', () => fileExists('.gitignore'));
  check('prisma/schema.prisma exists', () => fileExists('prisma/schema.prisma'));
}

/**
 * Check 2: Environment Configuration
 */
function checkEnvironmentConfig() {
  section('2. Environment Configuration');

  check('.env.production.vercel template exists', () => fileExists('.env.production.vercel'));
  check('.env.production.example exists', () => fileExists('.env.production.example'));

  // Check if .env.production.vercel has all required variables
  if (fileExists('.env.production.vercel')) {
    const envContent = fs.readFileSync(path.join(projectRoot, '.env.production.vercel'), 'utf8');

    REQUIRED_ENV_VARS.forEach(varName => {
      check(
        `${varName} documented in .env.production.vercel`,
        () => envContent.includes(varName)
      );
    });
  }
}

/**
 * Check 3: Build Configuration
 */
function checkBuildConfig() {
  section('3. Build Configuration');

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fileExists('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    check('build script exists', () => !!packageJson.scripts?.build);
    check('start script exists', () => !!packageJson.scripts?.start);
    check('Next.js dependency exists', () => !!packageJson.dependencies?.next);
    check('React dependency exists', () => !!packageJson.dependencies?.react);
    check('Prisma client exists', () => !!packageJson.dependencies?.['@prisma/client']);
  }

  // Check vercel.json configuration
  if (fileExists('vercel.json')) {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));

    check('buildCommand specified in vercel.json', () => !!vercelConfig.buildCommand);
    check('framework specified in vercel.json', () => !!vercelConfig.framework);
    check('Security headers configured', () => vercelConfig.headers?.length > 0);
  }
}

/**
 * Check 4: Database Configuration
 */
function checkDatabaseConfig() {
  section('4. Database Configuration');

  check('Prisma schema exists', () => fileExists('prisma/schema.prisma'));

  if (fileExists('prisma/schema.prisma')) {
    const schema = fs.readFileSync(path.join(projectRoot, 'prisma/schema.prisma'), 'utf8');
    check('PostgreSQL provider configured', () => schema.includes('provider = "postgresql"'));
  }

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fileExists('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    check('db:generate script exists', () => !!packageJson.scripts?.['db:generate']);
    check('db:push script exists', () => !!packageJson.scripts?.['db:push'], true);
  }
}

/**
 * Check 5: Security Configuration
 */
function checkSecurityConfig() {
  section('5. Security Configuration');

  // Check next.config.js for security settings
  if (fileExists('next.config.js')) {
    const nextConfig = fs.readFileSync(path.join(projectRoot, 'next.config.js'), 'utf8');
    check('reactStrictMode enabled', () => nextConfig.includes('reactStrictMode'));
    check('Image optimization configured', () => nextConfig.includes('images'));
  }

  // Check vercel.json for security headers
  if (fileExists('vercel.json')) {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));
    const headers = JSON.stringify(vercelConfig.headers || []);

    check('X-Content-Type-Options header', () => headers.includes('X-Content-Type-Options'));
    check('X-Frame-Options header', () => headers.includes('X-Frame-Options'));
    check('X-XSS-Protection header', () => headers.includes('X-XSS-Protection'));
  }
}

/**
 * Check 6: Dependencies
 */
function checkDependencies() {
  section('6. Dependencies Check');

  check('node_modules directory exists', () => fileExists('node_modules'), true);

  try {
    execSync('npm outdated', { cwd: projectRoot, stdio: 'pipe' });
    check('All dependencies are up to date', () => true, true);
  } catch (error) {
    check('Some dependencies can be updated', () => false, true);
  }
}

/**
 * Check 7: Git Configuration
 */
function checkGitConfig() {
  section('7. Git Configuration');

  check('.git directory exists', () => fileExists('.git'));
  check('.gitignore exists', () => fileExists('.gitignore'));

  if (fileExists('.gitignore')) {
    const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
    check('.env files ignored', () => gitignore.includes('.env'));
    check('node_modules ignored', () => gitignore.includes('node_modules'));
    check('.next ignored', () => gitignore.includes('.next'));
  }

  try {
    const gitStatus = execSync('git status --porcelain', { cwd: projectRoot }).toString();
    check('No uncommitted changes', () => gitStatus.trim().length === 0, true);
  } catch (error) {
    check('Git repository initialized', () => false, true);
  }
}

/**
 * Check 8: API Routes
 */
function checkApiRoutes() {
  section('8. API Routes');

  check('API directory exists', () => fileExists('app/api') || fileExists('pages/api'));
  check('Health check endpoint exists', () =>
    fileExists('app/api/health/route.ts') ||
    fileExists('pages/api/health.ts') ||
    fileExists('app/api/health.ts')
  , true);
}

/**
 * Check 9: Documentation
 */
function checkDocumentation() {
  section('9. Documentation');

  check('README.md exists', () => fileExists('README.md'));
  check('Deployment documentation exists', () =>
    fileExists('docs/vercel-deployment.md') ||
    fileExists('DEPLOYMENT.md')
  );
  check('Environment variables documented', () =>
    fileExists('.env.example') ||
    fileExists('.env.production.example')
  );
}

/**
 * Check 10: Build Test
 */
function checkBuild() {
  section('10. Build Test');

  log('Testing production build...', colors.yellow);
  log('This may take a few minutes...', colors.yellow);

  try {
    execSync('npm run build', {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 300000 // 5 minutes timeout
    });
    check('Production build succeeds', () => true);
  } catch (error) {
    check('Production build succeeds', () => false);
    log(`\nBuild error: ${error.message}`, colors.red);
  }
}

/**
 * Print recommendations
 */
function printRecommendations() {
  section('Recommendations for Production Deployment');

  const recommendations = [
    'Use Vercel Postgres or a managed PostgreSQL service (AWS RDS, Supabase)',
    'Use Upstash Redis for serverless-compatible caching',
    'Configure custom domain in Vercel dashboard after deployment',
    'Set up environment variables in Vercel project settings',
    'Update NEXTAUTH_URL to your production domain',
    'Update Stripe webhook URL to point to your production domain',
    'Enable Vercel Analytics for performance monitoring',
    'Set up Sentry for error tracking in production',
    'Configure automatic database backups',
    'Test payment flow thoroughly before going live',
    'Set up uptime monitoring (UptimeRobot, Pingdom)',
    'Review and test all API endpoints',
    'Ensure rate limiting is properly configured',
    'Set up automated deployment previews for PRs',
  ];

  recommendations.forEach((rec, index) => {
    log(`${index + 1}. ${rec}`, colors.cyan);
  });
}

/**
 * Print summary
 */
function printSummary() {
  section('Summary');

  log(`✓ Passed: ${results.passed.length}`, colors.green);
  if (results.warnings.length > 0) {
    log(`⚠ Warnings: ${results.warnings.length}`, colors.yellow);
  }
  if (results.failed.length > 0) {
    log(`✗ Failed: ${results.failed.length}`, colors.red);
  }

  console.log('');

  if (results.failed.length === 0) {
    log('🎉 Your project is ready for Vercel production deployment!', colors.green);
    console.log('');
    log('Next steps:', colors.cyan);
    log('1. Run: vercel login', colors.cyan);
    log('2. Run: vercel --prod', colors.cyan);
    log('3. Configure environment variables in Vercel dashboard', colors.cyan);
    log('4. Update NEXTAUTH_URL and webhook URLs after deployment', colors.cyan);
  } else {
    log('⚠ Please fix the failed checks before deploying to production.', colors.yellow);
    console.log('');
    log('Failed checks:', colors.red);
    results.failed.forEach(item => log(`  - ${item}`, colors.red));
  }

  if (results.warnings.length > 0) {
    console.log('');
    log('Warnings (recommended to fix):', colors.yellow);
    results.warnings.forEach(item => log(`  - ${item}`, colors.yellow));
  }

  console.log('');
}

/**
 * Main execution
 */
function main() {
  log('🚀 DirectFanz - Vercel Production Deployment Checklist', colors.blue);
  log('This will verify your project is ready for production deployment.\n', colors.blue);

  checkProjectFiles();
  checkEnvironmentConfig();
  checkBuildConfig();
  checkDatabaseConfig();
  checkSecurityConfig();
  checkDependencies();
  checkGitConfig();
  checkApiRoutes();
  checkDocumentation();

  // Ask user if they want to run build test
  log('\n⚠ The build test will take a few minutes. Skip it? (default: no)', colors.yellow);

  // For non-interactive mode, skip build test
  const args = process.argv.slice(2);
  if (!args.includes('--skip-build')) {
    checkBuild();
  } else {
    log('Skipping build test...', colors.yellow);
  }

  printRecommendations();
  printSummary();
}

// Run the checklist
main();
