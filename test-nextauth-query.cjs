require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function testNextAuthQuery() {
  console.log('=== NextAuth Query Test ===');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET');
  
  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL + '?prepared_statements=false',
      },
    },
  });

  try {
    // Simulate the exact query NextAuth makes
    const email = 'creator@test.com';
    const password = 'testpass123';
    
    console.log('\n=== Testing User Query (NextAuth Style) ===');
    console.log('Looking for email:', email);
    
    // This is the exact query NextAuth Credentials provider would make
    const user = await prisma.users.findUnique({
      where: { email: email }
    });
    
    console.log('User found:', user ? 'YES' : 'NO');
    
    if (user) {
      console.log('User details:');
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- Has password:', user.password ? 'YES' : 'NO');
      console.log('- Password starts with:', user.password ? user.password.substring(0, 10) + '...' : 'NULL');
      
      if (user.password) {
        const isValid = await bcrypt.compare(password, user.password);
        console.log('- Password valid:', isValid ? 'YES' : 'NO');
      }
    }
    
    // Test direct count query
    console.log('\n=== Table Stats ===');
    const totalUsers = await prisma.users.count();
    console.log('Total users in database:', totalUsers);
    
    const usersWithEmail = await prisma.users.count({
      where: { email: email }
    });
    console.log('Users with this email:', usersWithEmail);
    
    // Check if there are any users at all
    const firstUser = await prisma.users.findFirst();
    console.log('First user in database:', firstUser ? firstUser.email : 'NONE');
    
  } catch (error) {
    console.error('Error during query test:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n=== Test Complete ===');
  }
}

testNextAuthQuery();