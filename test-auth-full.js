#!/usr/bin/env node

console.log('🧪 Running comprehensive authentication tests...\n');

const tests = [
  {
    name: '1. Debug Auth API',
    url: 'http://localhost:3000/api/debug-auth',
    method: 'POST',
    data: { email: 'db4commerce@gmail.com', password: 'password123' },
    expectSuccess: true,
    checkFields: ['success', 'debug.passwordValid'],
  },
  {
    name: '2. Login API',
    url: 'http://localhost:3000/api/auth/login',
    method: 'POST',
    data: { email: 'db4commerce@gmail.com', password: 'password123' },
    expectSuccess: true,
    checkFields: ['message', 'user.email', 'token'],
  },
  {
    name: '3. Test Credentials API',
    url: 'http://localhost:3000/api/auth/test-credentials',
    method: 'POST',
    data: { email: 'db4commerce@gmail.com', password: 'password123' },
    expectSuccess: true,
    checkFields: ['ok', 'user.id'],
  },
  {
    name: '4. Signin Page Load',
    url: 'http://localhost:3000/auth/signin',
    method: 'GET',
    expectSuccess: true,
    checkContent: 'Sign in to your account',
  },
  {
    name: '5. Wrong Password Test',
    url: 'http://localhost:3000/api/debug-auth',
    method: 'POST',
    data: { email: 'db4commerce@gmail.com', password: 'wrongpassword' },
    expectSuccess: false,
    checkFields: ['debug.passwordValid'],
  },
];

async function runTest(test) {
  try {
    const options = {
      method: test.method,
      headers: test.method === 'POST' ? { 'Content-Type': 'application/json' } : {},
    };

    if (test.data) {
      options.body = JSON.stringify(test.data);
    }

    const response = await fetch(test.url, options);

    if (test.method === 'GET' && test.checkContent) {
      const text = await response.text();
      if (text.includes(test.checkContent)) {
        console.log(`✅ ${test.name}: PASSED - Found expected content`);
        return true;
      } else {
        console.log(`❌ ${test.name}: FAILED - Content not found`);
        return false;
      }
    }

    const result = await response.json();

    if (test.expectSuccess && response.ok) {
      if (test.checkFields) {
        const allFieldsPresent = test.checkFields.every(field => {
          const keys = field.split('.');
          let current = result;
          for (const key of keys) {
            if (current && current[key] !== undefined) {
              current = current[key];
            } else {
              return false;
            }
          }
          return true;
        });

        if (allFieldsPresent) {
          console.log(`✅ ${test.name}: PASSED - All required fields present`);
          if (result.debug?.passwordValid !== undefined) {
            console.log(`   Password valid: ${result.debug.passwordValid}`);
          }
          if (result.user?.email) {
            console.log(`   User email: ${result.user.email}`);
          }
          return true;
        } else {
          console.log(`❌ ${test.name}: FAILED - Missing required fields`);
          console.log(`   Response: ${JSON.stringify(result, null, 2)}`);
          return false;
        }
      } else {
        console.log(`✅ ${test.name}: PASSED - Request successful`);
        return true;
      }
    } else if (!test.expectSuccess && (!response.ok || result.success === false)) {
      console.log(`✅ ${test.name}: PASSED - Failed as expected`);
      if (result.debug?.passwordValid === false) {
        console.log(`   Password correctly rejected`);
      }
      return true;
    } else {
      console.log(`❌ ${test.name}: FAILED - Unexpected result`);
      console.log(`   Expected success: ${test.expectSuccess}, Got: ${response.ok}`);
      console.log(`   Response: ${JSON.stringify(result, null, 2)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    const result = await runTest(test);
    if (result) passed++;
    console.log(''); // Empty line for readability
  }

  console.log(`📊 Test Results: ${passed}/${total} tests passed\n`);

  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Authentication is fully working!');
    console.log('\n✅ You can now:');
    console.log('   1. Visit http://localhost:3000/auth/signin');
    console.log('   2. Login with: db4commerce@gmail.com / password123');
    console.log('   3. All authentication endpoints are responding correctly');
    console.log('   4. Password validation is working properly');
  } else {
    console.log(`⚠️  ${total - passed} tests failed. Check the output above for details.`);
  }

  process.exit(passed === total ? 0 : 1);
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('✅ Server is running\n');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start it with: npm run dev');
    process.exit(1);
  }
}

// Make fetch available in Node.js
if (typeof fetch === 'undefined') {
  console.log('Installing fetch...');
  await import('node-fetch')
    .then(({ default: fetch, Headers, Request, Response }) => {
      global.fetch = fetch;
      global.Headers = Headers;
      global.Request = Request;
      global.Response = Response;
    })
    .catch(() => {
      console.log('❌ Please install node-fetch: npm install node-fetch');
      process.exit(1);
    });
}

await checkServer();
await runAllTests();
