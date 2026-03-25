import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 Checking database connection...');
    await prisma.$connect();

    console.log('📊 Fetching users...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
      },
    });

    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - ${user.displayName}`);
    });

    if (users.length === 0) {
      console.log('\n⚠️  No users found. Creating a test user...');

      const hashedPassword = await bcrypt.hash('password123', 12);

      const testUser = await prisma.user.create({
        data: {
          email: 'db4commerce@gmail.com',
          displayName: 'Test User',
          password: hashedPassword,
          role: 'FAN',
          emailVerified: new Date(),
        },
      });

      console.log('✅ Created test user:', testUser.email);
    }
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
