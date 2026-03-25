const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function fixAdminWithRawSQL() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Updating admin password with raw SQL...');
    
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Use raw SQL to avoid prepared statement conflicts
    const result = await prisma.$executeRaw`
      UPDATE users 
      SET password = ${hashedPassword}, "updatedAt" = NOW() 
      WHERE email = 'admin@directfanz.com'
    `;
    
    console.log(`✅ Updated admin password (affected rows: ${result})`);
    
    // Check if the admin user exists
    const admin = await prisma.$queryRaw`
      SELECT id, email, role FROM users WHERE email = 'admin@directfanz.com'
    `;
    
    if (admin.length > 0) {
      console.log('✅ Admin user found:', admin[0]);
      console.log('🌐 Try logging in at: http://localhost:3000/auth/signin');
      console.log('📧 Email: admin@directfanz.com');
      console.log('🔑 Password: admin123');
    } else {
      console.log('❌ Admin user not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminWithRawSQL();