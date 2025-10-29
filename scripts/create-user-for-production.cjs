#!/usr/bin/env node

// This script uses the production DATABASE_URL to create a user
// that will be available in the same database that production uses

const bcrypt = require('bcryptjs');

// Use Vercel's production database URL - you need to set this manually
const PRODUCTION_DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PRODUCTION_DATABASE_URL
    }
  }
});

async function createUserForProduction() {
  try {
    console.log('🔐 Creating test user for production database...');
    console.log('Database URL:', PRODUCTION_DATABASE_URL?.replace(/\/\/.*@/, '//***:***@'));
    
    const email = 'test@directfanz.com';
    const password = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('✅ Test user already exists in production database!');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      
      // Update the password just to be sure
      await prisma.users.update({
        where: { email },
        data: { password: hashedPassword }
      });
      console.log('🔄 Password updated to ensure it matches');
      return;
    }

    const { v4: uuidv4 } = require('uuid');
    
    // Create the test user
    const user = await prisma.users.create({
      data: {
        id: uuidv4(),
        email,
        password: hashedPassword,
        displayName: 'Test User',
        role: 'FAN',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Test user created successfully in production database!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 User ID: ${user.id}`);
    console.log(`📝 Display Name: ${user.displayName}`);
    console.log(`🎭 Role: ${user.role}`);
    
    console.log('\n🌐 You can now sign in to your production app:');
    console.log('URL: https://nahvee-even-platform-pul09ihw4-demetrius-brooks-projects.vercel.app/auth/signin');
    
  } catch (error) {
    console.error('❌ Error creating user for production:', error);
    
    if (error.code === 'P1001') {
      console.log('\n💡 Database connection failed. This might mean:');
      console.log('1. The PRODUCTION_DATABASE_URL is not set correctly');
      console.log('2. The database server is not accessible');
      console.log('3. The credentials are incorrect');
      console.log('\n🔧 To fix this, you need to:');
      console.log('1. Get the actual DATABASE_URL from Vercel production');
      console.log('2. Set it as PRODUCTION_DATABASE_URL environment variable');
      console.log('3. Or update the production DATABASE_URL in Vercel to match your local one');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Show instructions if no production database URL is provided
if (!PRODUCTION_DATABASE_URL) {
  console.log('❌ No production database URL provided');
  console.log('\n🔧 To use this script:');
  console.log('1. Get your production DATABASE_URL from Vercel');
  console.log('2. Run: PRODUCTION_DATABASE_URL="your_prod_db_url" node scripts/create-user-for-production.cjs');
  console.log('\nOr update your Vercel production DATABASE_URL to match local:');
  console.log('vercel env add DATABASE_URL production');
  process.exit(1);
}

createUserForProduction();