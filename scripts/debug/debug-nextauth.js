import { db } from './src/lib/db.ts';
import { prisma } from './src/lib/prisma.ts';
import bcrypt from 'bcryptjs';

async function debugNextAuthIssue() {
  try {
    console.log('🔍 Debugging NextAuth credential provider...\n');

    const email = 'db4commerce@gmail.com';
    const password = 'password123';

    console.log('1. Testing with db client (used by NextAuth):');
    const userFromDb = await db.users.findUnique({
      where: { email },
      include: { artists: true },
    });

    console.log('   User found:', !!userFromDb);
    console.log('   Has password:', !!userFromDb?.password);
    console.log('   User ID:', userFromDb?.id);
    console.log('   User role:', userFromDb?.role);

    if (userFromDb?.password) {
      const isValidFromDb = await bcrypt.compare(password, userFromDb.password);
      console.log('   Password valid:', isValidFromDb);
      console.log('   Password hash:', userFromDb.password.substring(0, 20) + '...');
    }

    console.log('\n2. Testing with prisma client (used by debug API):');
    const userFromPrisma = await prisma.users.findUnique({
      where: { email },
      include: { artists: true },
    });

    console.log('   User found:', !!userFromPrisma);
    console.log('   Has password:', !!userFromPrisma?.password);
    console.log('   User ID:', userFromPrisma?.id);
    console.log('   User role:', userFromPrisma?.role);

    if (userFromPrisma?.password) {
      const isValidFromPrisma = await bcrypt.compare(password, userFromPrisma.password);
      console.log('   Password valid:', isValidFromPrisma);
      console.log('   Password hash:', userFromPrisma.password.substring(0, 20) + '...');
    }

    console.log('\n3. Hash comparison:');
    if (userFromDb?.password && userFromPrisma?.password) {
      console.log('   Hashes match:', userFromDb.password === userFromPrisma.password);
    }

    console.log('\n4. Manual bcrypt test:');
    const testHash = await bcrypt.hash(password, 12);
    console.log('   New hash:', testHash.substring(0, 20) + '...');
    const testValid = await bcrypt.compare(password, testHash);
    console.log('   New hash validation:', testValid);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.$disconnect();
    await prisma.$disconnect();
  }
}

debugNextAuthIssue();
