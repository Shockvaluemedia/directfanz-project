import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function addUser() {
  try {
    console.log('🔍 Creating user: db4commerce@gmail.com...');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'db4commerce@gmail.com' },
    });

    if (existingUser) {
      console.log('✅ User already exists:', existingUser.email);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: 'db4commerce@gmail.com',
        displayName: 'Test User',
        password: hashedPassword,
        role: 'FAN',
        emailVerified: new Date(),
        bio: 'Test user account',
        avatar: null,
        socialLinks: {},
        notificationPreferences: {
          email: true,
          push: true,
          marketing: false,
        },
        lastSeenAt: new Date(),
      },
    });

    console.log('✅ User created successfully:');
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Display Name:', user.displayName);
    console.log('  Password: password123');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addUser();
