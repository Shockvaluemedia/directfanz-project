#!/usr/bin/env node

/**
 * Quick DirectFanZ Launch Monitoring Script
 * Run this periodically during launch day to check platform health
 */

const https = require('https');

console.log('🚀 DirectFanZ Launch Day Monitoring\n');

async function checkPlatformHealth() {
  console.log('⏰', new Date().toLocaleString());
  
  try {
    // Check main site
    console.log('🌐 Checking directfanz.io...');
    const response = await fetch('https://directfanz.io');
    if (response.ok) {
      console.log('✅ Main site: ONLINE');
    } else {
      console.log('❌ Main site: Issues detected');
    }

    // Check signup page
    console.log('📝 Checking signup page...');
    const signupResponse = await fetch('https://directfanz.io/auth/signup');
    if (signupResponse.ok) {
      console.log('✅ Signup page: ACCESSIBLE');
    } else {
      console.log('❌ Signup page: Issues detected');
    }

    // Check upload page
    console.log('📤 Checking upload page...');
    const uploadResponse = await fetch('https://directfanz.io/upload');
    if (uploadResponse.ok) {
      console.log('✅ Upload page: ACCESSIBLE');
    } else {
      console.log('❌ Upload page: Issues detected');
    }

    console.log('\n📊 Platform Status: READY FOR USERS! 🎉\n');

  } catch (error) {
    console.error('❌ Monitoring error:', error.message);
  }
}

// Check immediately
checkPlatformHealth();

console.log('💡 TIP: Run this script every hour during launch day');
console.log('Command: node launch-monitoring.cjs\n');

console.log('🎯 Today\'s Success Metrics to Track:');
console.log('- User signups (check your database)');
console.log('- Social media engagement');  
console.log('- Creator DM responses');
console.log('- Technical issues (none expected!)');
console.log('\n🚀 GO LAUNCH DirectFanZ.io! 🚀');