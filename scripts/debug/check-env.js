#!/usr/bin/env node

/**
 * Environment Variables Check
 * Identifies missing env vars that could cause homepage issues
 */

console.log('🔍 Environment Variables Check\n');

// Critical environment variables for homepage functionality
const criticalEnvVars = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'DATABASE_URL'
];

// Optional but important for full functionality
const optionalEnvVars = [
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
  'REDIS_URL'
];

console.log('Critical Environment Variables:');
let criticalMissing = 0;
criticalEnvVars.forEach(envVar => {
  const exists = process.env[envVar];
  console.log(`   ${exists ? '✅' : '❌'} ${envVar}`);
  if (!exists) {
    criticalMissing++;
    console.log(`      🚨 MISSING: This could cause authentication/database issues`);
  }
});

console.log('\nOptional Environment Variables:');
let optionalMissing = 0;
optionalEnvVars.forEach(envVar => {
  const exists = process.env[envVar];
  console.log(`   ${exists ? '✅' : '⚠️ '} ${envVar}`);
  if (!exists) {
    optionalMissing++;
  }
});

console.log('\n📊 Summary:');
console.log(`   Critical missing: ${criticalMissing}`);
console.log(`   Optional missing: ${optionalMissing}`);

if (criticalMissing > 0) {
  console.log('\n🚨 CRITICAL ISSUES FOUND:');
  console.log('   Missing critical environment variables can cause:');
  console.log('   - Authentication failures');
  console.log('   - Database connection errors');
  console.log('   - Runtime crashes');
  console.log('\n🔧 Fix: Copy .env.local.example to .env.local and fill in values');
} else {
  console.log('\n✅ All critical environment variables are set');
}

// Check if .env.local exists
const fs = require('fs');
const path = require('path');

const envFiles = ['.env.local', '.env.production', '.env'];
console.log('\n📁 Environment Files:');
envFiles.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
});

console.log('\n🔧 QUICK FIXES:');
console.log('1. Visit /test-homepage to test simplified version');
console.log('2. Check browser console for JavaScript errors');
console.log('3. Verify all environment variables are set');
console.log('4. Test with NODE_ENV=development npm run dev');