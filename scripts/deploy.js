#!/usr/bin/env node

/**
 * Deployment script for setting up production environments
 * This script helps with environment variable configuration and deployment verification
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// Environment variables needed for production
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME',
  'SENDGRID_API_KEY',
  'FROM_EMAIL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_VERSION',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
];

// Optional environment variables
const optionalEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'FACEBOOK_CLIENT_ID',
  'FACEBOOK_CLIENT_SECRET',
  'CDN_URL',
  'CDN_DOMAIN',
];

// Vercel CLI commands
const vercelCommands = {
  login: 'vercel login',
  listEnv: 'vercel env ls',
  addEnv: (name, value, environment = 'production') => `vercel env add ${name} ${environment}`,
  removeEnv: (name, environment = 'production') => `vercel env rm ${name} ${environment} -y`,
  deploy: (production = false) => production ? 'vercel --prod' : 'vercel',
  listDomains: 'vercel domains ls',
  addDomain: (domain) => `vercel domains add ${domain}`,
};

// Helper functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function executeCommand(command) {
  try {
    return execSync(command, { stdio: 'inherit' });
  } catch (error) {
    log(`Error executing command: ${command}`, colors.red);
    log(error.message, colors.red);
    return null;
  }
}

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// Main deployment script
async function deploy() {
  log('🚀 Direct-to-Fan Platform Deployment Script', colors.cyan);
  log('==========================================', colors.cyan);
  
  // Check if Vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'ignore' });
  } catch (error) {
    log('Vercel CLI is not installed. Please install it with: npm i -g vercel', colors.red);
    process.exit(1);
  }
  
  // Login to Vercel if needed
  log('\n📝 Vercel Authentication', colors.magenta);
  const loginConfirm = await question('Do you need to login to Vercel? (y/n): ');
  if (loginConfirm.toLowerCase() === 'y') {
    executeCommand(vercelCommands.login);
  }
  
  // Environment variables setup
  log('\n🔐 Environment Variables Setup', colors.magenta);
  log('The following environment variables are required for production:', colors.yellow);
  requiredEnvVars.forEach(envVar => log(`- ${envVar}`, colors.yellow));
  
  const setupEnv = await question('Do you want to set up environment variables now? (y/n): ');
  if (setupEnv.toLowerCase() === 'y') {
    // Check existing env vars
    log('\nChecking existing environment variables...', colors.blue);
    executeCommand(vercelCommands.listEnv);
    
    // Add missing env vars
    log('\nAdding missing environment variables...', colors.blue);
    for (const envVar of requiredEnvVars) {
      const value = await question(`Enter value for ${envVar} (leave empty to skip): `);
      if (value.trim()) {
        executeCommand(vercelCommands.addEnv(envVar, value));
      } else {
        log(`Skipping ${envVar}...`, colors.yellow);
      }
    }
    
    // Optional env vars
    log('\nOptional environment variables:', colors.blue);
    for (const envVar of optionalEnvVars) {
      const value = await question(`Enter value for ${envVar} (leave empty to skip): `);
      if (value.trim()) {
        executeCommand(vercelCommands.addEnv(envVar, value));
      }
    }
  }
  
  // Database setup
  log('\n🗄️ Database Setup', colors.magenta);
  const dbSetup = await question('Do you want to run database migrations? (y/n): ');
  if (dbSetup.toLowerCase() === 'y') {
    log('Running database migrations...', colors.blue);
    executeCommand('npx prisma migrate deploy');
    
    const seedDb = await question('Do you want to seed the database with initial data? (y/n): ');
    if (seedDb.toLowerCase() === 'y') {
      log('Seeding database...', colors.blue);
      executeCommand('npx prisma db seed');
    }
  }
  
  // Domain setup
  log('\n🌐 Domain Configuration', colors.magenta);
  const domainSetup = await question('Do you want to configure a custom domain? (y/n): ');
  if (domainSetup.toLowerCase() === 'y') {
    log('Current domains:', colors.blue);
    executeCommand(vercelCommands.listDomains);
    
    const domain = await question('Enter the domain you want to add (e.g., fan-platform.com): ');
    if (domain.trim()) {
      executeCommand(vercelCommands.addDomain(domain));
    }
  }
  
  // Deployment
  log('\n🚀 Deployment', colors.magenta);
  const deployConfirm = await question('Ready to deploy to production? (y/n): ');
  if (deployConfirm.toLowerCase() === 'y') {
    log('Deploying to production...', colors.green);
    executeCommand(vercelCommands.deploy(true));
    
    log('\n✅ Deployment complete!', colors.green);
    log('Remember to check the deployment status in the Vercel dashboard.', colors.green);
  } else {
    const previewDeploy = await question('Do you want to create a preview deployment instead? (y/n): ');
    if (previewDeploy.toLowerCase() === 'y') {
      log('Creating preview deployment...', colors.blue);
      executeCommand(vercelCommands.deploy(false));
    }
  }
  
  // Post-deployment verification
  log('\n🔍 Post-Deployment Verification', colors.magenta);
  const verifyDeploy = await question('Do you want to run post-deployment verification? (y/n): ');
  if (verifyDeploy.toLowerCase() === 'y') {
    const deployUrl = await question('Enter the deployment URL: ');
    if (deployUrl.trim()) {
      log('Running health check...', colors.blue);
      executeCommand(`curl -s ${deployUrl}/api/health`);
      
      log('Running performance tests...', colors.blue);
      executeCommand(`APP_URL=${deployUrl} node scripts/performance-test.js`);
    }
  }
  
  log('\n🎉 Deployment process completed!', colors.green);
  rl.close();
}

// Run the deployment script
deploy().catch(error => {
  log(`Deployment failed: ${error.message}`, colors.red);
  process.exit(1);
});