const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('🧪 Creating test users for DirectFanZ journey testing...\n');

    // Create test artist
    const artistPassword = await bcrypt.hash('artist123', 12);
    const artist = await prisma.users.upsert({
      where: { email: 'artist@test.com' },
      update: {},
      create: {
        id: nanoid(),
        email: 'artist@test.com',
        displayName: 'Test Artist',
        password: artistPassword,
        role: 'ARTIST',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=artist',
        bio: 'Test artist for DirectFanZ platform testing. Creating amazing content for fans!',
        socialLinks: {
          website: 'https://testartist.example.com',
          location: 'Los Angeles, CA'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Created/Updated Test Artist:', {
      email: artist.email,
      username: artist.username,
      displayName: artist.displayName,
      role: artist.role,
      id: artist.id.substring(0, 8) + '...'
    });

    // Create test fan
    const fanPassword = await bcrypt.hash('fan123', 12);
    const fan = await prisma.users.upsert({
      where: { email: 'fan@test.com' },
      update: {},
      create: {
        id: nanoid(),
        email: 'fan@test.com',
        displayName: 'Test Fan',
        password: fanPassword,
        role: 'FAN',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fan',
        bio: 'Test fan account for platform testing. Love discovering new artists!',
        socialLinks: {
          location: 'New York, NY'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Created/Updated Test Fan:', {
      email: fan.email,
      username: fan.username,
      displayName: fan.displayName,
      role: fan.role,
      id: fan.id.substring(0, 8) + '...'
    });

    // Create test admin
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.users.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        id: nanoid(),
        email: 'admin@test.com',
        displayName: 'Test Admin',
        password: adminPassword,
        role: 'ADMIN',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        bio: 'Test admin account for platform management and testing.',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Created/Updated Test Admin:', {
      email: admin.email,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
      id: admin.id.substring(0, 8) + '...'
    });

    // Note: Subscription tier creation skipped for now - needs model structure verification

    console.log('\n🎯 Test User Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👨‍🎤 ARTIST LOGIN:');
    console.log('   Email: artist@test.com');
    console.log('   Password: artist123');
    console.log('');
    console.log('👨‍💼 FAN LOGIN:');
    console.log('   Email: fan@test.com');
    console.log('   Password: fan123');
    console.log('');
    console.log('🛡️  ADMIN LOGIN:');
    console.log('   Email: admin@test.com');
    console.log('   Password: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n🚀 Ready for testing! Server should be running at:');
    console.log('   http://localhost:3000');
    
    console.log('\n📋 Test Journey Steps:');
    console.log('1. Visit http://localhost:3000');
    console.log('2. Sign in as artist@test.com');
    console.log('3. Upload some content at /upload');
    console.log('4. Sign out and sign in as fan@test.com');
    console.log('5. Browse content, subscribe, interact');
    console.log('6. Test messaging, notifications, etc.');

  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();