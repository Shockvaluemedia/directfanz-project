#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const envLocalPath = join(projectRoot, '.env.local');

// Critical environment variables that need to be set
const criticalEnvVars = {
  // Database
  'DATABASE_URL': 'postgresql://demetriusbrooks@localhost:5432/directfanz',
  
  // Redis
  'REDIS_URL': 'redis://localhost:6379',
  
  // Next Auth
  'NEXTAUTH_SECRET': 'your-secret-key-change-in-production',
  'NEXTAUTH_URL': 'http://localhost:3000',
  
  // App Configuration
  'NEXT_PUBLIC_APP_URL': 'http://localhost:3000',
  'NEXT_PUBLIC_APP_VERSION': '0.1.0',
  'NODE_ENV': 'development',
  
  // Stripe (Test Keys - Leave empty for now)
  'STRIPE_PUBLISHABLE_KEY': '',
  'STRIPE_SECRET_KEY': '',
  'STRIPE_WEBHOOK_SECRET': '',
  
  // AWS S3 (Leave empty for now)
  'AWS_ACCESS_KEY_ID': '',
  'AWS_SECRET_ACCESS_KEY': '',
  'AWS_REGION': 'us-east-1',
  'AWS_S3_BUCKET_NAME': '',
  
  // Email (Leave empty for now)
  'SENDGRID_API_KEY': '',
  'FROM_EMAIL': 'noreply@directfanz.com',
  
  // OAuth Providers (Leave empty for now)
  'GOOGLE_CLIENT_ID': '',
  'GOOGLE_CLIENT_SECRET': '',
  'FACEBOOK_CLIENT_ID': '',
  'FACEBOOK_CLIENT_SECRET': '',
  
  // Monitoring & Error Tracking (Leave empty for now)
  'NEXT_PUBLIC_SENTRY_DSN': '',
  'SENTRY_ORG': '',
  'SENTRY_PROJECT': '',
  'SENTRY_AUTH_TOKEN': '',
  
  // CDN Configuration (Leave empty for now)
  'CDN_URL': '',
  'CDN_DOMAIN': ''
};

function validateEnvironment() {
  console.log('🔍 Validating environment configuration...\n');
  
  let envContent;
  try {
    envContent = readFileSync(envLocalPath, 'utf-8');
  } catch (error) {
    console.log('❌ .env.local file not found');
    return false;
  }
  
  const envLines = envContent.split('\\n');
  const envMap = new Map();
  
  // Parse existing environment variables
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        envMap.set(key.trim(), valueParts.join('=').replace(/^"|"$/g, ''));
      }
    }
  });
  
  let hasIssues = false;
  let missingCritical = [];
  let missingOptional = [];
  
  // Check for missing or empty critical variables
  Object.entries(criticalEnvVars).forEach(([key, defaultValue]) => {
    const currentValue = envMap.get(key);
    
    if (!envMap.has(key)) {
      if (['DATABASE_URL', 'REDIS_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL'].includes(key)) {
        missingCritical.push(key);
        hasIssues = true;
      } else {
        missingOptional.push(key);
      }
    } else if (!currentValue || currentValue.trim() === '') {
      if (['DATABASE_URL', 'REDIS_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL'].includes(key)) {
        console.log(`⚠️  Critical variable ${key} is empty`);
        hasIssues = true;
      }
    } else {
      console.log(`✅ ${key} is configured`);
    }
  });
  
  if (missingCritical.length > 0) {
    console.log('\\n❌ Missing critical environment variables:');
    missingCritical.forEach(key => {
      console.log(`   - ${key}`);
    });
  }
  
  if (missingOptional.length > 0) {
    console.log('\\n⚠️  Missing optional environment variables (for full functionality):');
    missingOptional.forEach(key => {
      console.log(`   - ${key} (can be configured later)`);
    });
  }
  
  return !hasIssues;
}

function fixEnvironment() {
  console.log('\\n🔧 Attempting to fix environment configuration...');
  
  try {
    const currentContent = readFileSync(envLocalPath, 'utf-8');
    const envMap = new Map();
    
    // Parse current environment
    currentContent.split('\\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          envMap.set(key.trim(), valueParts.join('=').replace(/^"|"$/g, ''));
        }
      }
    });
    
    // Update missing critical values
    const criticalUpdates = {
      'DATABASE_URL': 'postgresql://demetriusbrooks@localhost:5432/directfanz',
      'REDIS_URL': 'redis://localhost:6379',
      'NEXTAUTH_SECRET': 'your-secret-key-change-in-production',
      'NEXTAUTH_URL': 'http://localhost:3000',
      'NEXT_PUBLIC_APP_URL': 'http://localhost:3000',
      'NEXT_PUBLIC_APP_VERSION': '0.1.0',
      'NODE_ENV': 'development'
    };
    
    let updated = false;
    Object.entries(criticalUpdates).forEach(([key, value]) => {
      if (!envMap.has(key) || !envMap.get(key)?.trim()) {
        envMap.set(key, value);
        updated = true;
        console.log(`✅ Fixed ${key}`);
      }
    });
    
    if (updated) {
      // Rebuild the .env.local file
      const newContent = Array.from(envMap.entries())
        .map(([key, value]) => `${key}="${value}"`)
        .join('\\n');
      
      writeFileSync(envLocalPath, newContent);
      console.log('\\n✅ Environment configuration updated successfully!');
    } else {
      console.log('\\n✅ No critical environment fixes needed.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to fix environment:', error.message);
    return false;
  }
}

function main() {
  console.log('🚀 DirectFanZ Environment Validator\\n');
  
  const isValid = validateEnvironment();
  
  if (!isValid) {
    console.log('\\n🔧 Attempting to fix critical issues...');
    if (fixEnvironment()) {
      console.log('\\n✅ Environment setup complete!');
      console.log('\\n📝 Next steps:');
      console.log('   - Configure Stripe keys for payment processing');
      console.log('   - Set up AWS S3 for file storage');
      console.log('   - Configure SendGrid for email notifications');
      console.log('   - Set up Sentry for error monitoring');
    }
  } else {
    console.log('\\n🎉 Environment configuration looks good!');
    console.log('\\n💡 Optional: Configure external services for full functionality:');
    console.log('   - Stripe for payments');
    console.log('   - AWS S3 for file storage');
    console.log('   - SendGrid for emails');
    console.log('   - Sentry for monitoring');
  }
}

main();