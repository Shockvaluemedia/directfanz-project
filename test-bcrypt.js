import bcrypt from 'bcryptjs';

async function testBcrypt() {
  console.log('🔐 Testing bcrypt consistency...\n');

  const password = 'password123';
  const storedHash = '$2a$12$OlUJCFqJVo.wesA0Mh54X.NrEyvDOFihD9jo/JRlyrzi3UcWJmLt2'; // Hash from database

  console.log('Password:', password);
  console.log('Stored hash:', storedHash);

  // Test 1: Direct comparison with stored hash
  console.log('\n1. Direct comparison with stored hash:');
  const result1 = await bcrypt.compare(password, storedHash);
  console.log('   Result:', result1);

  // Test 2: Create new hash and compare
  console.log('\n2. Create new hash and compare:');
  const newHash = await bcrypt.hash(password, 12);
  console.log('   New hash:', newHash);
  const result2 = await bcrypt.compare(password, newHash);
  console.log('   Result:', result2);

  // Test 3: Multiple comparisons to check for race conditions
  console.log('\n3. Multiple rapid comparisons:');
  const promises = Array.from({ length: 5 }, (_, i) =>
    bcrypt.compare(password, storedHash).then(result => console.log(`   Attempt ${i + 1}:`, result))
  );

  await Promise.all(promises);

  console.log('\n4. Bcrypt info:');
  console.log('   bcryptjs version:', require('bcryptjs/package.json').version);

  // Test 5: Check if the hash format is correct
  console.log('\n5. Hash format analysis:');
  console.log('   Hash starts with $2a$:', storedHash.startsWith('$2a$'));
  console.log('   Hash length:', storedHash.length);
  console.log('   Expected format:', /^\$2[ayb]\$\d{2}\$.{53}$/.test(storedHash));
}

testBcrypt().catch(console.error);
