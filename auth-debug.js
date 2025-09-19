import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function debugAuthentication() {
  try {
    console.log('🔍 Comprehensive Authentication Debug\n');

    // 1. Check all users
    const users = await prisma.users.findMany();
    console.log(`Found ${users.length} users in database:`);

    for (const user of users) {
      console.log(`\n📧 ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.displayName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Has Password: ${user.password ? 'YES' : 'NO'}`);
      console.log(`   Email Verified: ${user.emailVerified ? 'YES' : 'NO'}`);
      console.log(`   Created: ${user.createdAt}`);

      if (user.password) {
        // Test common passwords
        const commonPasswords = ['password123', 'Password123!', 'test123', 'password', '123456'];
        console.log('   🧪 Testing common passwords:');

        for (const pwd of commonPasswords) {
          try {
            const isValid = await bcrypt.compare(pwd, user.password);
            if (isValid) {
              console.log(`   ✅ FOUND WORKING PASSWORD: "${pwd}"`);
              break;
            } else {
              console.log(`   ❌ "${pwd}" - no match`);
            }
          } catch (error) {
            console.log(`   🚫 "${pwd}" - error testing:`, error.message);
          }
        }
      }
    }

    // 2. Create a known test user for authentication testing
    console.log('\n➕ Creating a fresh test user with known credentials...');

    // Check if test user already exists
    const existingTestUser = await prisma.users.findUnique({
      where: { email: 'testuser@example.com' },
    });

    if (existingTestUser) {
      console.log('   Test user already exists, deleting first...');
      await prisma.users.delete({
        where: { id: existingTestUser.id },
      });
    }

    const testPassword = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 12);

    const testUser = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: 'testuser@example.com',
        password: hashedPassword,
        displayName: 'Test User',
        role: 'FAN',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: new Date(),
      },
    });

    console.log('✅ Created test user:');
    console.log(`   Email: testuser@example.com`);
    console.log(`   Password: ${testPassword}`);

    // Test the new user immediately
    const isTestValid = await bcrypt.compare(testPassword, testUser.password);
    console.log(`   ✅ Password verification: ${isTestValid ? 'WORKING' : 'FAILED'}`);

    // 3. Reset password for the existing user to a known value
    if (users.length > 0) {
      console.log('\n🔧 Resetting password for existing user...');
      const existingUser = users.find(u => u.email === 'db4commerce@gmail.com');

      if (existingUser) {
        const newPassword = 'NewPassword123!';
        const newHashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.users.update({
          where: { id: existingUser.id },
          data: {
            password: newHashedPassword,
            updatedAt: new Date(),
          },
        });

        console.log('✅ Updated existing user password:');
        console.log(`   Email: ${existingUser.email}`);
        console.log(`   New Password: ${newPassword}`);

        // Verify the update worked
        const updatedUser = await prisma.users.findUnique({ where: { id: existingUser.id } });
        const isNewValid = await bcrypt.compare(newPassword, updatedUser.password);
        console.log(`   ✅ Verification: ${isNewValid ? 'WORKING' : 'FAILED'}`);
      }
    }

    console.log('\n📝 AUTHENTICATION SUMMARY:');
    console.log('==========================');
    console.log('You now have these working login credentials:');
    console.log('');
    console.log('1. Email: testuser@example.com');
    console.log('   Password: TestPassword123!');
    console.log('');
    if (users.find(u => u.email === 'db4commerce@gmail.com')) {
      console.log('2. Email: db4commerce@gmail.com');
      console.log('   Password: NewPassword123!');
      console.log('');
    }
    console.log('🌐 Test these at: http://localhost:3000/auth/signin');
  } catch (error) {
    console.error('❌ Debug error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

debugAuthentication();
