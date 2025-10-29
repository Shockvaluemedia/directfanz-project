#!/usr/bin/env node

require('dotenv').config();
const bcrypt = require('bcryptjs');

// Use the production database URL
const DATABASE_URL = "postgresql://demetriusbrooks@localhost:5432/directfanz?pool_timeout=20&connection_limit=5&connect_timeout=60";

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function createTestUser() {
  try {
    console.log('🔐 Creating test user for DirectFanZ platform...');
    
    const email = 'test@directfanz.com';
    const password = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('✅ Test user already exists!');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
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

    console.log('✅ Test user created successfully!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 User ID: ${user.id}`);
    console.log(`📝 Display Name: ${user.displayName}`);
    console.log(`🎭 Role: ${user.role}`);
    
    console.log('\n🌐 You can now sign in to your production app:');
    console.log('URL: https://nahvee-even-platform-pul09ihw4-demetrius-brooks-projects.vercel.app/auth/signin');
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();