#!/usr/bin/env node

/**
 * Quick staging deployment script for DirectFanZ Project
 * This script deploys to a staging environment with minimal configuration
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

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

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function executeCommand(command, options = {}) {
  try {
    log(`Executing: ${command}`, colors.blue);
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    log(`Error executing command: ${command}`, colors.red);
    log(error.message, colors.red);
    throw error;
  }
}

function generateSecret(length = 32) {
  return randomBytes(length).toString('base64');
}

// Minimal environment variables for staging
const stagingEnvVars = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_APP_ENV: 'staging',
  NEXT_PUBLIC_APP_NAME: 'DirectFanZ Staging',
  NEXT_PUBLIC_APP_VERSION: '1.0.0-staging',
  NEXTAUTH_SECRET: generateSecret(),
  // Mock/placeholder values for staging
  DATABASE_URL: 'postgresql://mock:mock@localhost:5432/mock',
  REDIS_URL: 'redis://localhost:6379',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock',
  STRIPE_SECRET_KEY: 'sk_test_mock',
  STRIPE_WEBHOOK_SECRET: 'whsec_mock',
  AWS_ACCESS_KEY_ID: 'mock',
  AWS_SECRET_ACCESS_KEY: 'mock',
  AWS_REGION: 'us-east-1',
  AWS_S3_BUCKET_NAME: 'directfanz-staging-mock',
  SENDGRID_API_KEY: 'SG.mock',
  SENDGRID_FROM_EMAIL: 'staging@directfanz.io',
  ENCRYPTION_KEY: generateSecret(32).slice(0, 64),
  JWT_SECRET: generateSecret(),
  SKIP_TYPE_CHECK: '1',
  SENTRY_DSN: '',
  SENTRY_ORG: '',
  SENTRY_PROJECT: '',
  SENTRY_AUTH_TOKEN: '',
};

async function deployStagingEnvironment() {
  log('🚀 DirectFanZ Staging Deployment', colors.cyan);
  log('==================================', colors.cyan);

  try {
    // Check if project is linked to Vercel
    log('\n📋 Checking Vercel project status...', colors.magenta);
    try {
      executeCommand('vercel inspect', { stdio: 'pipe' });
      log('✅ Project is linked to Vercel', colors.green);
    } catch (error) {
      log('🔗 Linking project to Vercel...', colors.yellow);
      executeCommand('vercel link --yes');
    }

    // Set up environment variables for preview environment
    log('\n🔐 Setting up staging environment variables...', colors.magenta);
    
    // Remove existing preview env vars to avoid conflicts
    log('Cleaning up existing preview environment variables...', colors.blue);
    try {
      const envList = execSync('vercel env ls --environment preview', { encoding: 'utf8' });
      const existingVars = envList.split('\n').filter(line => line.includes('preview')).map(line => line.split(' ')[0]).filter(Boolean);
      
      for (const varName of existingVars) {
        if (stagingEnvVars[varName]) {
          try {
            executeCommand(`vercel env rm ${varName} preview --yes`);
          } catch (e) {
            // Continue if removal fails
          }
        }
      }
    } catch (e) {
      // Continue if listing fails
    }

    // Add new environment variables
    for (const [key, value] of Object.entries(stagingEnvVars)) {
      try {
        // Use echo to pipe the value to vercel env add to handle special characters
        executeCommand(`echo "${value}" | vercel env add ${key} preview`);
        log(`✅ Added ${key}`, colors.green);
      } catch (error) {
        log(`⚠️  Failed to add ${key}, continuing...`, colors.yellow);
      }
    }

    // Build and deploy to preview (staging)
    log('\n🏗️  Building and deploying to staging...', colors.magenta);
    log('This will create a preview deployment that serves as our staging environment.', colors.blue);
    
    // Deploy without --prod flag to create a preview deployment
    executeCommand('vercel deploy --build-env NODE_ENV=production');

    log('\n✅ Staging deployment completed!', colors.green);
    log('🔗 Your staging environment is now available at the preview URL shown above.', colors.green);
    
    // Show deployment info
    log('\n📊 Getting deployment information...', colors.magenta);
    executeCommand('vercel ls');

    log('\n📋 Staging Environment Info:', colors.cyan);
    log('- Environment: Preview (Staging)', colors.blue);
    log('- Build: Production optimized', colors.blue);
    log('- Type checking: Disabled for faster builds', colors.blue);
    log('- Mock services: Database, Redis, S3, Stripe', colors.yellow);
    log('\n⚠️  Note: This staging uses mock/placeholder services.', colors.yellow);
    log('For a fully functional staging environment, replace mock values with real staging services.', colors.yellow);

  } catch (error) {
    log(`\n❌ Staging deployment failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run the staging deployment
deployStagingEnvironment();