import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('Creating test user...');

    const email = 'db4commerce@gmail.com';
    const password = 'testpassword123'; // Make sure this matches what you're entering

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('User already exists, updating password...');
      await prisma.users.update({
        where: { email },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });
      console.log('✅ User password updated successfully');
    } else {
      console.log('Creating new user...');
      await prisma.users.create({
        data: {
          id: `user_${Date.now()}`,
          email,
          password: hashedPassword,
          displayName: 'Test User',
          role: 'FAN',
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log('✅ User created successfully');
    }

    console.log(`
✅ Test user ready:
   Email: ${email}
   Password: ${password}
   Role: FAN
`);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
