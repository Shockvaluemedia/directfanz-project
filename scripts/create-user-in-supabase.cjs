#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

// This will use the current .env DATABASE_URL
// Make sure your .env points to Supabase before running this
const prisma = new PrismaClient();

async function createUserInSupabase() {
  try {
    console.log('🔐 Creating test user in Supabase database...');
    
    const email = 'test@directfanz.com';
    const password = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check database connection first
    console.log('🔍 Testing database connection...');
    const dbTest = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Database connection successful');

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('✅ Test user already exists in Supabase!');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      
      // Update the password to be sure
      await prisma.users.update({
        where: { email },
        data: { 
          password: hashedPassword,
          updatedAt: new Date()
        }
      });
      console.log('🔄 Password hash updated in Supabase');
      
      // Test password verification
      const testValid = await bcrypt.compare(password, hashedPassword);
      console.log(`🧪 Password verification test: ${testValid ? '✅ PASS' : '❌ FAIL'}`);
      
      return existingUser;
    }

    const { v4: uuidv4 } = require('uuid');
    
    // Create the test user
    console.log('👤 Creating new test user...');
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

    console.log('✅ Test user created successfully in Supabase!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 User ID: ${user.id}`);
    console.log(`📝 Display Name: ${user.displayName}`);
    console.log(`🎭 Role: ${user.role}`);
    
    // Verify the user was created and password works
    console.log('\n🧪 Verification test...');
    const verifyUser = await prisma.users.findUnique({
      where: { email }
    });
    
    if (verifyUser && verifyUser.password) {
      const isValid = await bcrypt.compare(password, verifyUser.password);
      console.log(`✅ User created and password verification: ${isValid ? 'PASS' : 'FAIL'}`);
    }
    
    console.log('\n🌐 You can now sign in to your production app:');
    console.log('URL: https://nahvee-even-platform-pul09ihw4-demetrius-brooks-projects.vercel.app/auth/signin');
    
    return user;

  } catch (error) {
    console.error('❌ Error creating user in Supabase:', error);
    
    if (error.code === 'P1001') {
      console.log('\n💡 Database connection failed. This means:');
      console.log('1. Your .env DATABASE_URL might not be pointing to Supabase');
      console.log('2. Or the Supabase credentials are incorrect');
      console.log('\n🔧 To fix:');
      console.log('1. Update your .env DATABASE_URL to match production');
      console.log('2. Get the correct Supabase URL with password from Vercel');
    } else if (error.code === 'P2002') {
      console.log('\n💡 User already exists with this email');
    } else {
      console.log(`\n💡 Database error code: ${error.code}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Check current DATABASE_URL
console.log('🔍 Current DATABASE_URL:', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***:***@'));

createUserInSupabase();