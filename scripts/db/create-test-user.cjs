const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function createTestUsers() {
  try {
    console.log('🔧 Creating test users for DirectFanZ...');

    // Test if we can connect to the database
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Hash passwords
    const hashedPassword = await bcrypt.hash('testpass123', 12);
    const hashedAdminPassword = await bcrypt.hash('admin123', 12);

    // Create test creator user
    const creator = await prisma.users.upsert({
      where: { email: 'creator@test.com' },
      update: {
        password: hashedPassword,
        role: 'CREATOR',
        displayName: 'Test Creator',
        emailVerified: new Date(),
      },
      create: {
        id: randomUUID(),
        email: 'creator@test.com',
        password: hashedPassword,
        role: 'CREATOR',
        displayName: 'Test Creator',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Created test creator:', creator.email);

    // Create test fan user
    const fan = await prisma.users.upsert({
      where: { email: 'fan@test.com' },
      update: {
        password: hashedPassword,
        role: 'FAN',
        displayName: 'Test Fan',
        emailVerified: new Date(),
      },
      create: {
        id: randomUUID(),
        email: 'fan@test.com',
        password: hashedPassword,
        role: 'FAN',
        displayName: 'Test Fan',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Created test fan:', fan.email);

    // Create test admin user
    const admin = await prisma.users.upsert({
      where: { email: 'admin@directfanz.com' },
      update: {
        password: hashedAdminPassword,
        role: 'ADMIN',
        displayName: 'DirectFanZ Admin',
        emailVerified: new Date(),
      },
      create: {
        id: randomUUID(),
        email: 'admin@directfanz.com',
        password: hashedAdminPassword,
        role: 'ADMIN',
        displayName: 'DirectFanZ Admin',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Created test admin:', admin.email);

    console.log('\n🎉 Test users created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('Creator - Email: creator@test.com, Password: testpass123');
    console.log('Fan - Email: fan@test.com, Password: testpass123');
    console.log('Admin - Email: admin@directfanz.com, Password: admin123');
    console.log('\n🌐 Try logging in at: http://localhost:3000/auth/signin');

  } catch (error) {
    console.error('❌ Error creating test users:', error);
    
    if (error.code === 'P1001') {
      console.log('\n💡 Database connection failed. This could mean:');
      console.log('1. The Supabase database is not accessible');
      console.log('2. You need to set up a local database');
      console.log('3. The DATABASE_URL in .env needs to be updated');
      console.log('\nLet\'s try setting up a local SQLite database instead...');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();