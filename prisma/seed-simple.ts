import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting simple database seed...');

  // Clean existing data
  await prisma.users.deleteMany();
  console.log('🧹 Cleaned existing data');

  // Create simple test users
  const hashedPassword = await bcrypt.hash('password123', 12);
  const now = new Date();

  // Create test artist
  const artist = await prisma.users.create({
    data: {
      id: 'cl-test-artist-001',
      email: 'artist@test.com',
      password: hashedPassword,
      role: 'ARTIST',
      displayName: 'Test Artist',
      bio: 'Test artist account',
      emailVerified: now,
      updatedAt: now,
    },
  });

  // Create test fan
  const fan = await prisma.users.create({
    data: {
      id: 'cl-test-fan-001',
      email: 'fan@test.com',
      password: hashedPassword,
      role: 'FAN',
      displayName: 'Test Fan',
      bio: 'Test fan account',
      emailVerified: now,
      updatedAt: now,
    },
  });

  // Create your main test user
  const testUser = await prisma.users.create({
    data: {
      id: 'cl-test-main-001',
      email: 'db4commerce@gmail.com',
      password: hashedPassword,
      role: 'FAN',
      displayName: 'Test User',
      bio: 'Main test account for development',
      emailVerified: now,
      updatedAt: now,
    },
  });

  console.log('✅ Simple database seed completed!');
  console.log(`- Created ${await prisma.users.count()} users`);
}

main()
  .catch(e => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
