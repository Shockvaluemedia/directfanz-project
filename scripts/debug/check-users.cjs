const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 Checking existing users...\n');

    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found in database.');
      console.log('\n💡 You can:');
      console.log('1. Create users manually through the signup page');
      console.log('2. Or use the database seed script');
    } else {
      console.log(`✅ Found ${users.length} users:`);
      users.forEach(user => {
        console.log(`   - ${user.displayName} (${user.email}) - ${user.role}`);
      });

      const hasArtist = users.some(u => u.role === 'ARTIST');
      const hasFan = users.some(u => u.role === 'FAN');

      console.log('\n📋 User Role Summary:');
      console.log(`   Artists: ${hasArtist ? '✅' : '❌'}`);
      console.log(`   Fans: ${hasFan ? '✅' : '❌'}`);

      if (hasArtist && hasFan) {
        console.log('\n🎉 Ready to test the full user journey!');
        console.log('\n📍 Next steps:');
        console.log('1. Visit: http://localhost:3000');
        console.log('2. Sign in with existing credentials');
        console.log('3. Test upload, browsing, and interactions');
      } else {
        console.log('\n⚠️  Need both ARTIST and FAN users for full testing');
        console.log('   Create them via signup page at http://localhost:3000/auth/signup');
      }
    }

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure database is running');
    console.log('2. Check DATABASE_URL in .env.local');
    console.log('3. Try: npm run db:migrate');
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();