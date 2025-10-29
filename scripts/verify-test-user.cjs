#!/usr/bin/env node

require('dotenv').config();
const bcrypt = require('bcryptjs');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTestUser() {
  try {
    console.log('🔍 Verifying test user in database...');
    
    const email = 'test@directfanz.com';
    const testPassword = 'TestPassword123!';
    
    // Find the user
    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        displayName: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      console.log('❌ Test user not found in database');
      console.log(`   Email searched: ${email}`);
      
      // Check if there are any users at all
      const userCount = await prisma.users.count();
      console.log(`   Total users in database: ${userCount}`);
      
      if (userCount > 0) {
        const users = await prisma.users.findMany({
          select: { email: true, displayName: true, createdAt: true },
          take: 5
        });
        console.log('   First 5 users in database:');
        users.forEach(u => console.log(`   - ${u.email} (${u.displayName}) - ${u.createdAt}`));
      }
      
      return false;
    }

    console.log('✅ Test user found in database:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Display Name: ${user.displayName}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Has Password: ${user.password ? 'Yes' : 'No'}`);

    if (user.password) {
      // Test password verification
      console.log('\n🔐 Testing password verification...');
      const isValid = await bcrypt.compare(testPassword, user.password);
      console.log(`   Password "${testPassword}": ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (!isValid) {
        console.log('   This might be the issue - password hash verification failed');
        console.log(`   Stored hash length: ${user.password.length}`);
        console.log(`   Hash starts with: ${user.password.substring(0, 10)}...`);
      }
    }

    return user;

  } catch (error) {
    console.error('❌ Error verifying test user:', error);
    
    if (error.code === 'P1001') {
      console.log('   This is a database connection error');
      console.log('   Database URL being used:', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***:***@'));
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

verifyTestUser();