const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function diagnoseAuth() {
  console.log('🔍 Diagnosing Authentication Issues');
  console.log('===================================');
  
  let localPrisma;
  let productionPrisma;
  
  try {
    // Test local database connection
    console.log('1. Testing LOCAL database connection...');
    localPrisma = new PrismaClient({
      datasources: {
        db: {
          url: "file:./prisma/dev.db"
        }
      }
    });
    
    const localUsers = await localPrisma.users.findMany({
      select: { email: true, displayName: true, role: true }
    });
    console.log(`   ✅ Local DB: Found ${localUsers.length} users`);
    
    // Test production database connection (if different)
    console.log('\n2. Testing PRODUCTION database connection...');
    const prodDatabaseUrl = process.env.DATABASE_URL;
    console.log(`   Production DATABASE_URL: ${prodDatabaseUrl ? prodDatabaseUrl.substring(0, 30) + '...' : 'Not set'}`);
    
    if (prodDatabaseUrl && prodDatabaseUrl !== "file:./prisma/dev.db") {
      console.log('   Production uses different database, testing...');
      productionPrisma = new PrismaClient({
        datasources: {
          db: {
            url: prodDatabaseUrl
          }
        }
      });
      
      const prodUsers = await productionPrisma.users.findMany({
        select: { email: true, displayName: true, role: true },
        take: 5
      });
      console.log(`   ✅ Production DB: Found ${prodUsers.length} users`);
      
      if (prodUsers.length === 0) {
        console.log('   ⚠️  Production database appears to be empty!');
        console.log('   This could explain why login is not working.');
      }
    } else {
      console.log('   ✅ Production uses same local SQLite database');
    }
    
    // Test specific demo accounts
    console.log('\n3. Testing demo account accessibility...');
    const testAccounts = [
      { email: 'luna.wilde@directfanz.io', password: 'DirectFanz2025!' },
      { email: 'indie.artist@example.com', password: 'password123' },
      { email: 'db4commerce@gmail.com', password: 'password123' }
    ];
    
    for (const account of testAccounts) {
      try {
        const user = await localPrisma.users.findUnique({
          where: { email: account.email },
          select: { 
            email: true,
            displayName: true, 
            role: true, 
            password: true,
            emailVerified: true 
          }
        });
        
        if (!user) {
          console.log(`   ❌ ${account.email}: Not found in database`);
          continue;
        }
        
        if (!user.password) {
          console.log(`   ❌ ${account.email}: No password hash stored`);
          continue;
        }
        
        const passwordValid = await bcrypt.compare(account.password, user.password);
        const status = passwordValid ? '✅' : '❌';
        const verified = user.emailVerified ? 'Verified' : 'Unverified';
        
        console.log(`   ${status} ${account.email} (${user.role}) - ${verified}`);
        
        if (!passwordValid) {
          // Try to see if there's a different password that works
          const commonPasswords = ['password', 'password123', 'DirectFanz2025!', 'test123'];
          for (const testPass of commonPasswords) {
            if (await bcrypt.compare(testPass, user.password)) {
              console.log(`       🔍 Actual password appears to be: "${testPass}"`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ ${account.email}: Error checking account - ${error.message}`);
      }
    }
    
    // Check authentication code path
    console.log('\n4. Testing authentication code path...');
    const testEmail = 'luna.wilde@directfanz.io';
    const testPassword = 'DirectFanz2025!';
    
    try {
      // Simulate the NextAuth credential check
      const user = await localPrisma.users.findUnique({
        where: { email: testEmail },
        include: { artists: true }
      });
      
      if (!user || !user.password) {
        console.log(`   ❌ Auth simulation failed: User not found or no password`);
      } else {
        const isPasswordValid = await bcrypt.compare(testPassword, user.password);
        console.log(`   ${isPasswordValid ? '✅' : '❌'} Auth simulation: Password validation ${isPasswordValid ? 'PASSED' : 'FAILED'}`);
        
        if (isPasswordValid) {
          console.log(`   ✅ Auth simulation: Would return user object:`);
          console.log(`       - id: ${user.id}`);
          console.log(`       - email: ${user.email}`);
          console.log(`       - name: ${user.displayName}`);
          console.log(`       - role: ${user.role}`);
          console.log(`       - image: ${user.avatar || 'null'}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Auth simulation error: ${error.message}`);
    }
    
    // Environment check
    console.log('\n5. Environment check...');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'not set'}`);
    console.log(`   NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? 'set' : 'not set'}`);
    
    console.log('\n6. Recommendations...');
    if (!prodDatabaseUrl || prodDatabaseUrl === "file:./prisma/dev.db") {
      console.log('   ✅ Using local SQLite - good for development');
    } else if (productionPrisma && prodUsers.length === 0) {
      console.log('   🔧 ISSUE: Production database is empty');
      console.log('   💡 Solution: Run database seeding on production database');
    }
    
    console.log('   💡 If still having issues:');
    console.log('      1. Check browser console for NextAuth errors');
    console.log('      2. Verify you\'re using the correct domain (https://directfanz.io)');
    console.log('      3. Clear browser cookies and try again');
    console.log('      4. Check network tab for failed API requests');
    
  } catch (error) {
    console.error('❌ Diagnosis error:', error.message);
  } finally {
    // Clean up connections
    if (localPrisma) await localPrisma.$disconnect();
    if (productionPrisma) await productionPrisma.$disconnect();
  }
}

diagnoseAuth();