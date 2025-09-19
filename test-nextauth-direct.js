import { authOptions } from './src/lib/auth.ts';

async function testNextAuthDirect() {
  try {
    console.log('🔐 Testing NextAuth authorize function directly...\n');

    // Get the credentials provider
    const credentialsProvider = authOptions.providers.find(p => p.id === 'credentials');

    if (!credentialsProvider || !credentialsProvider.authorize) {
      console.log('❌ Credentials provider not found');
      return;
    }

    const testCredentials = {
      email: 'db4commerce@gmail.com',
      password: 'password123',
    };

    console.log('Testing credentials:', {
      email: testCredentials.email,
      passwordLength: testCredentials.password.length,
    });

    // Call the authorize function directly
    const result = await credentialsProvider.authorize(testCredentials);

    console.log('Authorize result:', result);

    if (result) {
      console.log('✅ NextAuth authorize function working correctly');
      console.log('User details:', {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
      });
    } else {
      console.log('❌ NextAuth authorize function returned null');
    }
  } catch (error) {
    console.error('❌ Error testing NextAuth authorize:', error);
  }
}

testNextAuthDirect();
