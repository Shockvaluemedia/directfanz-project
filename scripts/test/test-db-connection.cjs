require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    console.log('Using DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
    const user = await prisma.users.findUnique({
      where: { email: 'creator@test.com' },
      select: { id: true, email: true, password: true, role: true }
    });
    console.log('User found:', !!user);
    if (user) {
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Has password:', !!user.password);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}
checkUser();