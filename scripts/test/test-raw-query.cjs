require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

async function testRawQuery() {
  console.log('=== Raw Query Test ===');
  
  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    // Use raw SQL to bypass prepared statements
    const users = await prisma.$queryRaw`
      SELECT id, email, role, password IS NOT NULL as has_password
      FROM users 
      WHERE email = 'creator@test.com'
    `;
    
    console.log('Raw query results:', users);
    
    if (users.length > 0) {
      const user = users[0];
      console.log('User found:', user.email);
      console.log('Role:', user.role);
      console.log('Has password:', user.has_password);
    } else {
      console.log('No user found with email creator@test.com');
    }
    
  } catch (error) {
    console.error('Error during raw query test:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testRawQuery();