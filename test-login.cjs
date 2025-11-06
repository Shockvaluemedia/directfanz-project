const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function testLogin() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔐 Testing Demo Login Credentials');
    console.log('================================');
    
    // Test demo accounts
    const demoAccounts = [
      'luna.wilde@directfanz.io',
      'alexsynth@directfanz.io', 
      'maya.colors@directfanz.io',
      'sarah.musicfan@gmail.com',
      'demo.visitor@directfanz.io'
    ];
    
    console.log('Testing password: DirectFanz2025!');
    console.log('');
    
    for (const email of demoAccounts) {
      const user = await prisma.users.findUnique({
        where: { email },
        select: { 
          displayName: true, 
          role: true,
          password: true 
        }
      });
      
      if (!user) {
        console.log(`❌ ${email}: Not found`);
        continue;
      }
      
      if (!user.password) {
        console.log(`❌ ${user.displayName}: No password set`);
        continue;
      }
      
      const isValid = await bcrypt.compare('DirectFanz2025!', user.password);
      const status = isValid ? '✅' : '❌';
      console.log(`${status} ${user.displayName} (${user.role}): ${email}`);
    }
    
    console.log('');
    console.log('Testing original seed accounts with password: password123');
    console.log('');
    
    const seedAccounts = [
      'indie.artist@example.com',
      'artist@test.com', 
      'fan@test.com',
      'db4commerce@gmail.com'
    ];
    
    for (const email of seedAccounts) {
      const user = await prisma.users.findUnique({
        where: { email },
        select: { 
          displayName: true, 
          role: true,
          password: true 
        }
      });
      
      if (!user) {
        console.log(`❌ ${email}: Not found`);
        continue;
      }
      
      if (!user.password) {
        console.log(`❌ ${user.displayName}: No password set`);
        continue;
      }
      
      const isValid = await bcrypt.compare('password123', user.password);
      const status = isValid ? '✅' : '❌';
      console.log(`${status} ${user.displayName} (${user.role}): ${email}`);
    }
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testLogin();