const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    const admin = await prisma.users.findUnique({
      where: { email: 'admin@directfanz.com' }
    });
    
    if (!admin) {
      console.log('Admin user not found');
      return;
    }
    
    console.log('Admin user found:');
    console.log('ID:', admin.id);
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
    console.log('Password hash exists:', !!admin.password);
    
    if (admin.password) {
      console.log('Password hash starts with:', admin.password.substring(0, 10));
      
      try {
        const isPasswordValid = await bcrypt.compare('admin123', admin.password);
        console.log('Password "admin123" is valid:', isPasswordValid);
      } catch (bcryptError) {
        console.error('Bcrypt error:', bcryptError.message);
      }
    } else {
      console.log('No password set for admin user!');
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();