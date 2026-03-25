const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log('🔍 Testing authentication...');
    
    // Get the user
    const user = await prisma.users.findUnique({
      where: { email: 'creator@test.com' }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      hasPassword: !!user.password,
      passwordLength: user.password?.length
    });
    
    if (user.password) {
      console.log('🔑 Testing password "testpass123"...');
      const isValid = await bcrypt.compare('testpass123', user.password);
      console.log('Password valid:', isValid);
      
      if (!isValid) {
        console.log('🔧 Testing password "password123"...');
        const isValid2 = await bcrypt.compare('password123', user.password);
        console.log('Password "password123" valid:', isValid2);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();