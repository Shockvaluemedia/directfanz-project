#!/usr/bin/env node

/**
 * Environment Validation Script for DirectFanZ Platform
 * Validates all required environment variables for AI features
 */

const requiredVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

const aiFeatureVars = [
  'OPENAI_API_KEY',
  'OPENAI_MODEL'
];

const stripeVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET'
];

const awsVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME'
];

const optionalVars = [
  'REDIS_URL',
  'AWS_CLOUDFRONT_DOMAIN',
  'SENTRY_DSN',
  'GOOGLE_ANALYTICS_ID',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'EMAIL_FROM',
  'LOG_LEVEL',
  'JWT_SECRET',
  'USE_LOCAL_STORAGE',
  'SHARP_CACHE_SIZE',
  'SHARP_CONCURRENCY',
  'AI_MAX_TOKENS',
  'AI_TEMPERATURE',
  'MODERATION_NSFW_THRESHOLD',
  'MODERATION_VIOLENCE_THRESHOLD',
  'MODERATION_HATE_SPEECH_THRESHOLD'
];

function validateEnvironment() {
  console.log('🔍 Validating DirectFanZ Environment Configuration...\n');
  
  const missing = [];
  const warnings = [];
  const present = [];
  
  // Check required variables
  console.log('📋 Core Application Variables:');
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
      console.log(`  ❌ ${varName} - MISSING (Required)`);
    } else {
      present.push(varName);
      console.log(`  ✅ ${varName} - Present`);
    }
  });
  
  // Check AI feature variables
  console.log('\n🤖 AI Feature Variables:');
  aiFeatureVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
      console.log(`  ❌ ${varName} - MISSING (Required for AI features)`);
    } else {
      present.push(varName);
      console.log(`  ✅ ${varName} - Present`);
    }
  });
  
  // Check Stripe variables
  console.log('\n💳 Stripe Payment Variables:');
  stripeVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
      console.log(`  ❌ ${varName} - MISSING (Required for payments)`);
    } else {
      present.push(varName);
      console.log(`  ✅ ${varName} - Present`);
    }
  });
  
  // Check AWS variables
  console.log('\n☁️  AWS Storage Variables:');
  awsVars.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(varName);
      console.log(`  ⚠️  ${varName} - MISSING (File uploads may not work)`);
    } else {
      present.push(varName);
      console.log(`  ✅ ${varName} - Present`);
    }
  });
  
  // Check optional variables
  console.log('\n🔧 Optional Configuration Variables:');
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
      console.log(`  ✅ ${varName} - Present`);
    } else {
      console.log(`  ⚪ ${varName} - Not set (optional)`);
    }
  });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  
  if (missing.length > 0) {
    console.log(`❌ CRITICAL ISSUES: ${missing.length} required variables missing:`);
    missing.forEach(varName => console.log(`   • ${varName}`));
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS: ${warnings.length} important variables missing:`);
    warnings.forEach(varName => console.log(`   • ${varName}`));
    console.log('');
  }
  
  console.log(`✅ CONFIGURED: ${present.length} variables properly set`);
  
  // Specific validations
  console.log('\n🔍 SPECIFIC VALIDATIONS:');
  
  // Database URL validation
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      console.log('  ✅ Database URL format is valid');
    } else {
      console.log('  ❌ Database URL format appears invalid');
    }
  }
  
  // JWT Secret strength
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length >= 32) {
      console.log('  ✅ JWT secret is sufficiently long');
    } else {
      console.log('  ⚠️  JWT secret should be at least 32 characters long');
    }
  }
  
  // OpenAI API key format
  if (process.env.OPENAI_API_KEY) {
    if (process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.log('  ✅ OpenAI API key format appears valid');
    } else {
      console.log('  ⚠️  OpenAI API key format may be invalid (should start with sk-)');
    }
  }
  
  // Stripe keys format
  if (process.env.STRIPE_SECRET_KEY) {
    if (process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      const isTest = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
      const isLive = process.env.STRIPE_SECRET_KEY.startsWith('sk_live_');
      if (isTest) {
        console.log('  ✅ Stripe secret key is in TEST mode');
      } else if (isLive) {
        console.log('  ⚠️  Stripe secret key is in LIVE mode - ensure this is intended');
      }
    } else {
      console.log('  ❌ Stripe secret key format appears invalid');
    }
  }
  
  // Environment-specific warnings
  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log(`\n🌍 Environment: ${nodeEnv.toUpperCase()}`);
  
  if (nodeEnv === 'production') {
    console.log('  🚨 PRODUCTION ENVIRONMENT - Additional security checks required');
    
    const productionChecks = [
      { var: 'NEXTAUTH_URL', shouldContain: 'https://', message: 'Should use HTTPS in production' },
      { var: 'STRIPE_SECRET_KEY', shouldStartWith: 'sk_live_', message: 'Should use live Stripe keys in production' },
      { var: 'DATABASE_URL', shouldNotContain: 'localhost', message: 'Should not use localhost database in production' }
    ];
    
    productionChecks.forEach(check => {
      const value = process.env[check.var];
      if (value) {
        if (check.shouldContain && !value.includes(check.shouldContain)) {
          console.log(`  ⚠️  ${check.var}: ${check.message}`);
        }
        if (check.shouldStartWith && !value.startsWith(check.shouldStartWith)) {
          console.log(`  ⚠️  ${check.var}: ${check.message}`);
        }
        if (check.shouldNotContain && value.includes(check.shouldNotContain)) {
          console.log(`  ⚠️  ${check.var}: ${check.message}`);
        }
      }
    });
  }
  
  // Final result
  console.log('\n' + '='.repeat(50));
  
  if (missing.length === 0) {
    console.log('🎉 VALIDATION PASSED - All required variables are configured!');
    console.log('📝 Next steps:');
    console.log('   1. Run integration tests');
    console.log('   2. Test AI features');
    console.log('   3. Verify external service connections');
    return 0;
  } else {
    console.log('❌ VALIDATION FAILED - Required variables missing');
    console.log('📝 Next steps:');
    console.log('   1. Add missing required variables to .env file');
    console.log('   2. Refer to ENVIRONMENT_CONFIG.md for guidance');
    console.log('   3. Run this validation script again');
    return 1;
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  const exitCode = validateEnvironment();
  process.exit(exitCode);
}

module.exports = { validateEnvironment };