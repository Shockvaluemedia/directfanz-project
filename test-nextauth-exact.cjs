require('dotenv').config({ path: '.env.local' });

// Import the exact same Prisma instance that NextAuth uses
const { prisma } = require('./src/lib/prisma.ts');

async function testExactNextAuthQuery() {
  console.log('=== Testing Exact NextAuth Query ===');
  
  try {
    const email = 'creator@test.com';
    console.log('📧 Email:', email);
    console.log('🔍 Looking up user in database...');
    console.log('🗃️ DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
    
    // This is the exact query from NextAuth authorize function
    const user = await prisma.users.findUnique({
      where: {
        email: email,
      },
    });

    console.log('👤 User found:', !!user, 'Has password:', !!user?.password);

    if (user && user.password) {
      const bcrypt = require('bcryptjs');
      const isPasswordValid = await bcrypt.compare('testpass123', user.password);
      console.log('🔐 Password validation for', email, ':', isPasswordValid);
      
      if (isPasswordValid) {
        const result = {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatar,
          role: user.role,
        };
        console.log('✅ Authorization would succeed, returning user:', result);
      } else {
        console.log('❌ Password validation failed');
      }
    } else {
      console.log('❌ User not found or no password');
    }
    
  } catch (error) {
    console.error('🔐 Error during authorization:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database disconnected');
  }
}

testExactNextAuthQuery();