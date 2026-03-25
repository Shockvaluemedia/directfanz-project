import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  try {
    console.log('Checking users in database...');
    const users = await db.users.findMany({
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
      console.log(`- ${user.email} (${user.displayName}) - ${user.role}`);
    });

    // If no users exist, create a test user
    if (users.length === 0) {
      console.log('\nNo users found. Creating a test user...');
      const hashedPassword = await bcrypt.hash('password123', 12);

      const newUser = await db.users.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          displayName: 'Test User',
          role: 'FAN',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('✅ Test user created:', newUser.email);
    }

    // Test authentication with the credentials
    console.log('\n🔍 Testing authentication...');
    const testUser = await db.users.findUnique({
      where: { email: 'test@example.com' },
    });

    if (testUser && testUser.password) {
      const isValid = await bcrypt.compare('password123', testUser.password);
      console.log(`Password validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    } else {
      console.log('❌ Test user not found or has no password');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.$disconnect();
  }
}

main();
