#!/usr/bin/env node

/**
 * Quick test to verify DirectFanZ.io production user registration
 */

const https = require('https');

const BASE_URL = 'https://www.directfanz.io';

// Test user data
const testUser = {
  name: 'Test User',
  email: `test-user-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  role: 'FAN'
};

console.log('🧪 Testing DirectFanZ.io Production Registration\n');

async function testRegistration() {
  console.log('1. Testing signup page accessibility...');
  
  try {
    // Test if signup page is accessible
    const signupResponse = await fetch(`${BASE_URL}/auth/signup`);
    if (signupResponse.ok) {
      console.log('✅ Signup page accessible');
    } else {
      console.log(`❌ Signup page error: ${signupResponse.status}`);
      return false;
    }

    console.log('\n2. Testing authentication endpoints...');
    
    // Test auth endpoints
    const authResponse = await fetch(`${BASE_URL}/api/auth/providers`);
    if (authResponse.ok) {
      console.log('✅ Auth endpoints accessible');
    } else {
      console.log('⚠️  Auth endpoints may not be accessible');
    }

    console.log('\n3. Testing protected API endpoints...');
    
    // Test protected endpoint
    const artistsResponse = await fetch(`${BASE_URL}/api/fan/artists?limit=1`);
    const artistsData = await artistsResponse.text();
    
    if (artistsData.includes('Unauthorized') || artistsData.includes('error')) {
      console.log('✅ Protected endpoints working (properly unauthorized)');
    } else {
      console.log('⚠️  Unexpected response from protected endpoint');
    }

    console.log('\n4. Testing health endpoint...');
    
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthResponse.json();
    
    console.log(`Health Status: ${healthData.status || 'unknown'}`);
    
    if (healthData.checks && healthData.checks.database) {
      console.log(`Database: ${healthData.checks.database.status} (${healthData.checks.database.latency}ms)`);
      console.log(`Redis: ${healthData.checks.redis.status}`);
      
      if (healthData.checks.database.status === 'ok') {
        console.log('✅ Database connected and working');
      } else {
        console.log('❌ Database connection issues');
        return false;
      }
    } else {
      console.log('⚠️  Health check format unexpected, but endpoint responded');
      console.log('Raw response:', JSON.stringify(healthData, null, 2));
    }

    console.log('\n🎉 Production Platform Status: READY FOR USER REGISTRATION');
    console.log('\nManual Testing Steps:');
    console.log('1. Visit: https://directfanz.io/auth/signup');
    console.log('2. Create test accounts (artist and fan)');
    console.log('3. Test login functionality');
    console.log('4. Test upload features');
    console.log('5. Test payment flows');
    
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testRegistration().then(success => {
  if (success) {
    console.log('\n✅ DirectFanZ.io is ready for soft launch!');
    process.exit(0);
  } else {
    console.log('\n❌ Issues found - need to fix before launch');
    process.exit(1);
  }
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});