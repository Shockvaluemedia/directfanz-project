import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        emailVerified: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('\n=== DATABASE USERS ===');
    console.log('Total users:', users.length);
    console.log('\nUsers details:');
    users.forEach((user, i) => {
      console.log(`${i + 1}. ${user.email} (${user.role}) - ${user.name || 'No name'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email Verified: ${user.emailVerified || 'No'}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('');
    });

    // Also check accounts table
    const accounts = await prisma.account.findMany({
      select: {
        userId: true,
        provider: true,
        type: true
      }
    });
    
    console.log('=== ACCOUNTS ===');
    console.log('Total accounts:', accounts.length);
    accounts.forEach(account => {
      console.log(`User ID: ${account.userId}, Provider: ${account.provider}, Type: ${account.type}`);
    });
    
  } catch (error) {
    console.error('Error checking users:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();