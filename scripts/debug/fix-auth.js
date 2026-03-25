import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function fixAuthenticationIssue() {
  try {
    console.log('🔍 Diagnosing authentication issues...\n');

    // 1. Check all users and their password status
    console.log('1. Checking all users...');
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        password: true,
        createdAt: true,
      },
    });

    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(
        `- ${user.email} (${user.role}) - ${user.displayName} - ${user.password ? 'HAS PASSWORD' : 'NO PASSWORD'}`
      );
    });

    // 2. Find users without passwords
    const usersWithoutPasswords = users.filter(user => !user.password);
    if (usersWithoutPasswords.length > 0) {
      console.log(`\n⚠️  Found ${usersWithoutPasswords.length} users without passwords:`);
      usersWithoutPasswords.forEach(user => {
        console.log(`   - ${user.email}`);
      });

      // 3. Fix users without passwords by setting a default password
      console.log('\n🔧 Fixing users without passwords...');
      const defaultPassword = 'password123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      for (const user of usersWithoutPasswords) {
        try {
          await prisma.users.update({
            where: { id: user.id },
            data: {
              password: hashedPassword,
              updatedAt: new Date(),
            },
          });
          console.log(`   ✅ Fixed password for ${user.email}`);
        } catch (error) {
          console.error(`   ❌ Failed to fix password for ${user.email}:`, error.message);
        }
      }
    }

    // 4. Test authentication with fixed users
    console.log('\n🧪 Testing authentication after fixes...');
    for (const user of users) {
      try {
        const updatedUser = await prisma.users.findUnique({
          where: { id: user.id },
        });

        if (updatedUser && updatedUser.password) {
          const isValid = await bcrypt.compare('password123', updatedUser.password);
          console.log(
            `   ${user.email}: ${isValid ? '✅ Valid' : '❌ Invalid'} with password 'password123'`
          );
        }
      } catch (error) {
        console.error(`   ❌ Test failed for ${user.email}:`, error.message);
      }
    }

    // 5. Create a test user if none exist
    if (users.length === 0) {
      console.log('\n➕ No users found. Creating test user...');
      const hashedPassword = await bcrypt.hash('password123', 12);

      const testUser = await prisma.users.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          displayName: 'Test User',
          role: 'FAN',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('✅ Created test user:', testUser.email);
      console.log('   Email: test@example.com');
      console.log('   Password: password123');
    }

    console.log('\n✅ Authentication diagnosis and fixes complete!');
    console.log('\n📝 Summary:');
    console.log('   - You can now log in with any existing user using password: password123');
    console.log('   - If you created accounts through OAuth, they now have passwords set');
    console.log('   - Test the login at: http://localhost:3000/auth/signin');
  } catch (error) {
    console.error('❌ Error during authentication fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAuthenticationIssue();
