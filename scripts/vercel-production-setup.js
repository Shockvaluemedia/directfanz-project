#!/usr/bin/env node

/**
 * Vercel Production Setup Script
 *
 * This script helps automate the production deployment setup for Vercel.
 * It guides you through the process and sets up environment variables.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

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
  bold: '\x1b[1m',
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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
  log(`${'='.repeat(70)}`, colors.cyan);
  log(` ${title}`, colors.bold + colors.cyan);
  log(`${'='.repeat(70)}`, colors.cyan);
  console.log('');
}

/**
 * Ask a question and wait for answer
 */
function ask(question) {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${question}${colors.reset} `, resolve);
  });
}

/**
 * Execute command and return output
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

/**
 * Check if Vercel CLI is installed
 */
function checkVercelCLI() {
  section('1. Checking Vercel CLI');

  try {
    exec('vercel --version', { silent: true });
    log('✓ Vercel CLI is installed', colors.green);
    return true;
  } catch (error) {
    log('✗ Vercel CLI is not installed', colors.red);
    return false;
  }
}

/**
 * Install Vercel CLI
 */
async function installVercelCLI() {
  const answer = await ask('Would you like to install Vercel CLI globally? (y/n): ');

  if (answer.toLowerCase() === 'y') {
    log('\nInstalling Vercel CLI...', colors.yellow);
    try {
      exec('npm install -g vercel');
      log('✓ Vercel CLI installed successfully', colors.green);
      return true;
    } catch (error) {
      log('✗ Failed to install Vercel CLI', colors.red);
      log('Please install manually: npm install -g vercel', colors.yellow);
      return false;
    }
  }
  return false;
}

/**
 * Login to Vercel
 */
async function loginToVercel() {
  section('2. Vercel Authentication');

  try {
    const whoami = exec('vercel whoami', { silent: true, ignoreError: true });
    if (whoami) {
      log(`✓ Already logged in as: ${whoami.trim()}`, colors.green);
      const answer = await ask('Continue with this account? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        return true;
      }
    }
  } catch (error) {
    // Not logged in
  }

  log('\nOpening browser for Vercel login...', colors.yellow);
  try {
    exec('vercel login');
    log('✓ Successfully logged in to Vercel', colors.green);
    return true;
  } catch (error) {
    log('✗ Failed to login to Vercel', colors.red);
    return false;
  }
}

/**
 * Link project to Vercel
 */
async function linkProject() {
  section('3. Project Setup');

  // Check if already linked
  if (fs.existsSync(path.join(projectRoot, '.vercel'))) {
    log('✓ Project is already linked to Vercel', colors.green);
    const answer = await ask('Re-link the project? (y/n): ');
    if (answer.toLowerCase() !== 'y') {
      return true;
    }
  }

  log('\nLinking project to Vercel...', colors.yellow);
  log('Follow the prompts to set up your project:', colors.cyan);

  try {
    exec('vercel link');
    log('✓ Project linked successfully', colors.green);
    return true;
  } catch (error) {
    log('✗ Failed to link project', colors.red);
    return false;
  }
}

/**
 * Read environment variables from template
 */
function readEnvTemplate() {
  const templatePath = path.join(projectRoot, '.env.production.vercel');
  if (!fs.existsSync(templatePath)) {
    return {};
  }

  const content = fs.readFileSync(templatePath, 'utf8');
  const vars = {};

  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, value] = trimmed.split('=');
      if (key) {
        vars[key.trim()] = value ? value.trim().replace(/^["']|["']$/g, '') : '';
      }
    }
  });

  return vars;
}

/**
 * Set environment variables
 */
async function setEnvironmentVariables() {
  section('4. Environment Variables');

  log('Environment variables need to be set in Vercel dashboard.', colors.yellow);
  log('You can also use the Vercel CLI to set them:', colors.cyan);
  console.log('');

  const envVars = readEnvTemplate();
  const requiredVars = [
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

  log('Required environment variables:', colors.bold);
  requiredVars.forEach((key) => {
    const hasExample = envVars[key] && !envVars[key].includes('your');
    const status = hasExample ? '✓' : '○';
    const color = hasExample ? colors.green : colors.yellow;
    log(`  ${status} ${key}`, color);
  });

  console.log('');
  const answer = await ask('Would you like to set environment variables now via CLI? (y/n): ');

  if (answer.toLowerCase() === 'y') {
    log('\nYou can set variables using:', colors.cyan);
    log('  vercel env add <NAME> production', colors.cyan);
    console.log('');
    log('Or set them in the Vercel dashboard:', colors.cyan);
    log('  https://vercel.com/dashboard -> Your Project -> Settings -> Environment Variables', colors.cyan);
    console.log('');

    const openDashboard = await ask('Open Vercel dashboard in browser? (y/n): ');
    if (openDashboard.toLowerCase() === 'y') {
      try {
        exec('vercel env ls', { ignoreError: true });
      } catch (error) {
        log('Please open: https://vercel.com/dashboard', colors.cyan);
      }
    }
  } else {
    log('\nDon\'t forget to set environment variables before deployment!', colors.yellow);
    log('You can set them in the Vercel dashboard or using Vercel CLI.', colors.cyan);
  }

  return true;
}

/**
 * Run pre-deployment checks
 */
async function runPreDeploymentChecks() {
  section('5. Pre-Deployment Checks');

  log('Running deployment checklist...', colors.yellow);
  console.log('');

  try {
    exec('node scripts/vercel-setup-checklist.js --skip-build');
    return true;
  } catch (error) {
    log('⚠ Some checks failed. Please review the output above.', colors.yellow);
    const answer = await ask('Continue anyway? (y/n): ');
    return answer.toLowerCase() === 'y';
  }
}

/**
 * Deploy to production
 */
async function deployToProduction() {
  section('6. Production Deployment');

  log('Ready to deploy to production?', colors.bold);
  log('\nThis will:', colors.cyan);
  log('  • Build your application', colors.cyan);
  log('  • Deploy to Vercel production', colors.cyan);
  log('  • Assign your production domain', colors.cyan);
  console.log('');

  const answer = await ask('Deploy now? (y/n): ');

  if (answer.toLowerCase() === 'y') {
    log('\nDeploying to production...', colors.yellow);
    try {
      exec('vercel --prod');
      log('✓ Successfully deployed to production!', colors.green);
      return true;
    } catch (error) {
      log('✗ Deployment failed', colors.red);
      log('Check the error messages above for details.', colors.yellow);
      return false;
    }
  } else {
    log('\nSkipping deployment. You can deploy later with:', colors.yellow);
    log('  vercel --prod', colors.cyan);
    return false;
  }
}

/**
 * Post-deployment steps
 */
async function postDeployment() {
  section('7. Post-Deployment Steps');

  log('After deployment, make sure to:', colors.bold);
  console.log('');
  log('✓ Update Stripe webhook URL to your production domain', colors.cyan);
  log('✓ Run database migrations if needed', colors.cyan);
  log('✓ Test all critical features', colors.cyan);
  log('✓ Set up monitoring and alerts', colors.cyan);
  log('✓ Configure custom domain if not done yet', colors.cyan);
  console.log('');

  log('Database Migration:', colors.bold);
  log('If you need to run migrations, use:', colors.cyan);
  log('  vercel env pull .env.production', colors.cyan);
  log('  npx prisma migrate deploy', colors.cyan);
  console.log('');

  log('View deployment:', colors.bold);
  log('  vercel ls', colors.cyan);
  log('  vercel inspect <url>', colors.cyan);
  console.log('');
}

/**
 * Print summary
 */
function printSummary() {
  section('Setup Complete!');

  log('📚 Useful Resources:', colors.bold);
  console.log('');
  log('Documentation:', colors.cyan);
  log('  • Vercel Deployment Guide: docs/vercel-deployment.md', colors.cyan);
  log('  • Production Setup: .env.production.vercel', colors.cyan);
  console.log('');
  log('Useful Commands:', colors.cyan);
  log('  • Deploy to production: vercel --prod', colors.cyan);
  log('  • Deploy preview: vercel', colors.cyan);
  log('  • View deployments: vercel ls', colors.cyan);
  log('  • View logs: vercel logs <url>', colors.cyan);
  log('  • Set env var: vercel env add <NAME> production', colors.cyan);
  log('  • Pull env vars: vercel env pull', colors.cyan);
  console.log('');
  log('Dashboard:', colors.cyan);
  log('  https://vercel.com/dashboard', colors.cyan);
  console.log('');
}

/**
 * Main execution
 */
async function main() {
  log(`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║          DirectFanz - Vercel Production Setup Wizard                 ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
`, colors.blue + colors.bold);

  log('This wizard will help you deploy DirectFanz to Vercel production.', colors.cyan);
  log('Press Ctrl+C at any time to cancel.\n', colors.yellow);

  const answer = await ask('Continue with setup? (y/n): ');
  if (answer.toLowerCase() !== 'y') {
    log('Setup cancelled.', colors.yellow);
    rl.close();
    process.exit(0);
  }

  try {
    // Step 1: Check/Install Vercel CLI
    let hasVercelCLI = checkVercelCLI();
    if (!hasVercelCLI) {
      hasVercelCLI = await installVercelCLI();
      if (!hasVercelCLI) {
        log('\nPlease install Vercel CLI and run this script again.', colors.yellow);
        rl.close();
        return;
      }
    }

    // Step 2: Login
    const loggedIn = await loginToVercel();
    if (!loggedIn) {
      log('\nPlease login to Vercel and run this script again.', colors.yellow);
      rl.close();
      return;
    }

    // Step 3: Link project
    const linked = await linkProject();
    if (!linked) {
      log('\nPlease link your project and run this script again.', colors.yellow);
      rl.close();
      return;
    }

    // Step 4: Environment variables
    await setEnvironmentVariables();

    // Step 5: Pre-deployment checks
    const checksPass = await runPreDeploymentChecks();
    if (!checksPass) {
      log('\nPlease fix the issues and run this script again.', colors.yellow);
      rl.close();
      return;
    }

    // Step 6: Deploy
    const deployed = await deployToProduction();

    // Step 7: Post-deployment
    if (deployed) {
      await postDeployment();
    }

    // Summary
    printSummary();

    log('🎉 Setup wizard complete!', colors.green + colors.bold);
    console.log('');
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, colors.red);
    log('Setup failed. Please try again.', colors.yellow);
  } finally {
    rl.close();
  }
}

// Run the setup
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
