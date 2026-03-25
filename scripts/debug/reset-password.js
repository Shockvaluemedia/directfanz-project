import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function resetUserPassword() {
  try {
    console.log('🔧 Resetting user password...\n');

    // Get the existing user
    const existingUser = await prisma.users.findUnique({
      where: { email: 'db4commerce@gmail.com' },
    });

    if (!existingUser) {
      console.log('❌ User not found. Creating a new test user...');

      // Create new user with known credentials
      const testPassword = 'password123';
      const hashedPassword = await bcrypt.hash(testPassword, 12);

      const newUser = await prisma.users.create({
        data: {
          id: randomUUID(),
          email: 'test@example.com',
          password: hashedPassword,
          displayName: 'Test User',
          role: 'FAN',
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: new Date(),
        },
      });

      console.log('✅ Created new test user:');
      console.log(`   Email: test@example.com`);
      console.log(`   Password: password123`);
      return;
    }

    // Reset the existing user's password
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.users.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    console.log('✅ Password reset successful!');
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   New Password: ${newPassword}`);

    // Test the password immediately
    const updatedUser = await prisma.users.findUnique({
      where: { id: existingUser.id },
    });

    const isValid = await bcrypt.compare(newPassword, updatedUser.password);
    console.log(`   ✅ Verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);

    if (isValid) {
      console.log('\n🎉 Authentication is now fixed!');
      console.log('You can log in at http://localhost:3000/auth/signin with:');
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Password: ${newPassword}`);
    }
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetUserPassword();
