import { prisma } from './src/lib/prisma.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

async function testDatabaseFix() {
  console.log('🧪 Testing database prepared statement fix...');
  
  try {
    const testEmail = `test-${Date.now()}@example.com`;
    console.log('📝 Testing with email:', testEmail);
    
    // Test 1: Check if user exists (this is where the error occurred)
    console.log('🔍 Step 1: Testing findUnique query...');
    const existingUser = await prisma.users.findUnique({
      where: { email: testEmail },
    });
    console.log('✅ Step 1: findUnique query successful');
    
    if (existingUser) {
      console.log('👤 User already exists, skipping creation');
      return existingUser;
    }
    
    // Test 2: Create a new user
    console.log('🔍 Step 2: Testing user creation...');
    const hashedPassword = await bcrypt.hash('testpassword123', 12);
    
    const user = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: testEmail,
        password: hashedPassword,
        displayName: 'Test User',
        role: 'FAN',
        updatedAt: new Date(),
      },
    });
    console.log('✅ Step 2: User creation successful');
    
    // Test 3: Query the user again to verify
    console.log('🔍 Step 3: Verifying user creation...');
    const verifyUser = await prisma.users.findUnique({
      where: { email: testEmail },
    });
    console.log('✅ Step 3: User verification successful');
    
    console.log('🎉 All database tests passed!');
    console.log('👤 Created user:', {
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    return user;
    
  } catch (error) {
    console.error('❌ Database test failed:');
    console.error('Error message:', error.message);
    
    if (error.message.includes('prepared statement')) {
      console.error('🔧 PREPARED STATEMENT ERROR DETECTED!');
      console.error('This is the exact error we were trying to fix.');
      console.error('The retry logic should handle this...');
    }
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run multiple tests to simulate concurrent requests
async function runMultipleTests() {
  console.log('🔄 Running multiple concurrent tests to check for prepared statement conflicts...');
  
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(
      (async (testIndex) => {
        try {
          // Give each test a unique timestamp
          await new Promise(resolve => setTimeout(resolve, testIndex * 10));
          await testDatabaseFix();
          console.log(`✅ Test ${testIndex + 1} completed successfully`);
        } catch (error) {
          console.error(`❌ Test ${testIndex + 1} failed:`, error.message);
          throw error;
        }
      })(i)
    );
  }
  
  try {
    await Promise.all(promises);
    console.log('🎉 All concurrent tests passed!');
  } catch (error) {
    console.error('💥 Some tests failed:', error.message);
    throw error;
  }
}

// Run the tests
runMultipleTests()
  .then(() => {
    console.log('✅ Database fix verification completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Database fix verification failed:', error.message);
    process.exit(1);
  });