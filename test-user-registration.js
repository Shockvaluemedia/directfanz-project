import { createUser } from './src/lib/auth-utils.js';

async function testUserRegistration() {
  console.log('🧪 Testing user registration database fix...');
  
  try {
    const testUserData = {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      displayName: 'Test User',
      role: 'FAN'
    };
    
    console.log('📝 Attempting to create user:', testUserData.email);
    
    const user = await createUser(testUserData);
    
    console.log('✅ User created successfully!');
    console.log('👤 User ID:', user.id);
    console.log('📧 Email:', user.email);
    console.log('🎭 Role:', user.role);
    
    return user;
  } catch (error) {
    console.error('❌ User registration failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('prepared statement')) {
      console.error('🔧 This appears to be the prepared statement conflict we\'re trying to fix');
    }
    
    throw error;
  }
}

// Run the test
testUserRegistration()
  .then(() => {
    console.log('🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });