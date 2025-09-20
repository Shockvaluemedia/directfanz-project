import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  UserRole,
  ContentType,
  ContentVisibility,
  SubscriptionStatus,
} from '../src/lib/types/enums';
import { randomBytes } from 'crypto';

// Generate a unique ID similar to cuid
function generateId(): string {
  return 'cl' + randomBytes(10).toString('base64url');
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (in reverse order of dependencies)
  await prisma.messages.deleteMany();
  await prisma.comments.deleteMany();
  await prisma.subscriptions.deleteMany();
  await prisma.content.deleteMany();
  await prisma.tiers.deleteMany();
  await prisma.artists.deleteMany();
  await prisma.sessions.deleteMany();
  await prisma.accounts.deleteMany();
  await prisma.users.deleteMany();

  console.log('🧹 Cleaned existing data');

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 12);

  // Create artists
  const artist1 = await prisma.users.create({
    data: {
      id: generateId(),
      email: 'indie.artist@example.com',
      password: hashedPassword,
      role: UserRole.ARTIST,
      displayName: 'Indie Artist',
      bio: 'Independent musician creating soulful acoustic music',
      avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
      socialLinks: {
        instagram: '@indieartist',
        twitter: '@indiemusic',
        spotify: 'spotify:artist:123',
      },
      artists: {
        create: {
          isStripeOnboarded: true,
          stripeAccountId: 'acct_test_artist1',
          totalEarnings: 2500.0,
          totalSubscribers: 45,
        },
      },
      updatedAt: new Date(),
    },
  });

  const artist2 = await prisma.users.create({
    data: {
      id: generateId(),
      email: 'electronic.producer@example.com',
      password: hashedPassword,
      role: UserRole.ARTIST,
      displayName: 'Electronic Producer',
      bio: 'Creating ambient electronic soundscapes and beats',
      avatar: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
      socialLinks: {
        soundcloud: 'electronicproducer',
        bandcamp: 'electronicbeats',
      },
      artists: {
        create: {
          isStripeOnboarded: false,
          totalEarnings: 0,
          totalSubscribers: 0,
        },
      },
      updatedAt: new Date(),
    },
  });

  // Create fans
  const fan1 = await prisma.users.create({
    data: {
      id: generateId(),
      email: 'music.lover@example.com',
      password: hashedPassword,
      role: UserRole.FAN,
      displayName: 'Music Lover',
      bio: 'Supporting independent artists and discovering new sounds',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
      updatedAt: new Date(),
    },
  });

  const fan2 = await prisma.users.create({
    data: {
      id: generateId(),
      email: 'superfan@example.com',
      password: hashedPassword,
      role: UserRole.FAN,
      displayName: 'Super Fan',
      bio: 'Collector of rare tracks and supporter of emerging artists',
      updatedAt: new Date(),
    },
  });

  // Create the test user you're using
  const testUser = await prisma.users.create({
    data: {
      id: generateId(),
      email: 'db4commerce@gmail.com',
      password: hashedPassword,
      role: UserRole.FAN,
      displayName: 'Test User',
      bio: 'Test account for development',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  // Also create the standard test accounts
  const artistTest = await prisma.users.create({
    data: {
      id: generateId(),
      email: 'artist@test.com',
      password: hashedPassword,
      role: UserRole.ARTIST,
      displayName: 'Test Artist',
      bio: 'Test artist account',
      emailVerified: new Date(),
      artists: {
        create: {
          isStripeOnboarded: false,
          totalEarnings: 0,
          totalSubscribers: 0,
        },
      },
      updatedAt: new Date(),
    },
  });

  const fanTest = await prisma.users.create({
    data: {
      id: generateId(),
      email: 'fan@test.com',
      password: hashedPassword,
      role: UserRole.FAN,
      displayName: 'Test Fan',
      bio: 'Test fan account',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('👥 Created sample users');

  // Create tiers for artist1
  const basicTier = await prisma.tiers.create({
    data: {
      id: generateId(),
      artistId: artist1.id,
      name: 'Basic Support',
      description: 'Get access to exclusive acoustic sessions and early releases',
      minimumPrice: 5.0,
      subscriberCount: 25,
      updatedAt: new Date(),
    },
  });

  const premiumTier = await prisma.tiers.create({
    data: {
      id: generateId(),
      artistId: artist1.id,
      name: 'Premium Fan',
      description: 'Everything in Basic plus behind-the-scenes content and monthly video calls',
      minimumPrice: 15.0,
      subscriberCount: 15,
      updatedAt: new Date(),
    },
  });

  const vipTier = await prisma.tiers.create({
    data: {
      id: generateId(),
      artistId: artist1.id,
      name: 'VIP Experience',
      description: 'All previous benefits plus personalized songs and priority access to concerts',
      minimumPrice: 50.0,
      subscriberCount: 5,
      updatedAt: new Date(),
    },
  });

  // Create tiers for artist2
  const electronicBasic = await prisma.tiers.create({
    data: {
      id: generateId(),
      artistId: artist2.id,
      name: 'Beat Supporter',
      description: 'Access to unreleased tracks and stems for remixing',
      minimumPrice: 8.0,
      subscriberCount: 0,
      updatedAt: new Date(),
    },
  });

  console.log('🎵 Created subscription tiers');

  // Create sample content for artist1
  const acousticSession = await prisma.content.create({
    data: {
      id: generateId(),
      artistId: artist1.id,
      title: 'Acoustic Session #1 - Coffee Shop Vibes',
      description: 'Intimate acoustic performance recorded in my favorite local coffee shop',
      type: ContentType.AUDIO,
      fileUrl: 'https://example.com/audio/acoustic-session-1.mp3',
      thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
      visibility: ContentVisibility.TIER_LOCKED,
      fileSize: 15728640, // ~15MB
      duration: 1800, // 30 minutes
      format: 'mp3',
      tags: JSON.stringify(['acoustic', 'live', 'intimate']),
      tiers: {
        connect: [{ id: basicTier.id }, { id: premiumTier.id }, { id: vipTier.id }],
      },
    },
  });

  const behindScenes = await prisma.content.create({
    data: {
      id: generateId(),
      artistId: artist1.id,
      title: 'Behind the Scenes - Studio Setup',
      description: 'Take a look at my home studio setup and songwriting process',
      type: ContentType.VIDEO,
      fileUrl: 'https://example.com/video/studio-setup.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800',
      visibility: ContentVisibility.TIER_LOCKED,
      fileSize: 52428800, // ~50MB
      duration: 600, // 10 minutes
      format: 'mp4',
      tags: JSON.stringify(['behind-the-scenes', 'studio', 'process']),
      tiers: {
        connect: [{ id: premiumTier.id }, { id: vipTier.id }],
      },
    },
  });

  const exclusiveTrack = await prisma.content.create({
    data: {
      id: generateId(),
      artistId: artist1.id,
      title: 'Midnight Reflections (Exclusive)',
      description:
        'A personal song I wrote during late night sessions - only for my VIP supporters',
      type: ContentType.AUDIO,
      fileUrl: 'https://example.com/audio/midnight-reflections.mp3',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800',
      visibility: ContentVisibility.TIER_LOCKED,
      fileSize: 8388608, // ~8MB
      duration: 240, // 4 minutes
      format: 'mp3',
      tags: JSON.stringify(['exclusive', 'personal', 'acoustic']),
      tiers: {
        connect: [{ id: vipTier.id }],
      },
    },
  });

  // Create public content
  const publicTrack = await prisma.content.create({
    data: {
      id: generateId(),
      artistId: artist1.id,
      title: 'Summer Breeze (Free Preview)',
      description: 'A taste of my upcoming album - free for everyone to enjoy',
      type: ContentType.AUDIO,
      fileUrl: 'https://example.com/audio/summer-breeze-preview.mp3',
      thumbnailUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      visibility: ContentVisibility.PUBLIC,
      fileSize: 6291456, // ~6MB
      duration: 180, // 3 minutes
      format: 'mp3',
      tags: JSON.stringify(['preview', 'summer', 'free']),
    },
  });

  console.log('🎶 Created sample content');

  // Create subscriptions
  const subscription1 = await prisma.subscriptions.create({
    data: {
      id: generateId(),
      fanId: fan1.id,
      artistId: artist1.id,
      tierId: basicTier.id,
      stripeSubscriptionId: 'sub_test_123456',
      amount: 10.0, // Pay-what-you-want above minimum
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });

  const subscription2 = await prisma.subscriptions.create({
    data: {
      id: generateId(),
      fanId: fan2.id,
      artistId: artist1.id,
      tierId: premiumTier.id,
      stripeSubscriptionId: 'sub_test_789012',
      amount: 25.0, // Pay-what-you-want above minimum
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });

  console.log('💳 Created sample subscriptions');

  // Create comments
  await prisma.comments.create({
    data: {
      id: generateId(),
      contentId: acousticSession.id,
      fanId: fan1.id,
      text: 'This acoustic session is absolutely beautiful! The coffee shop ambiance really adds to the intimate feel.',
    },
  });

  await prisma.comments.create({
    data: {
      id: generateId(),
      contentId: publicTrack.id,
      fanId: fan2.id,
      text: "Can't wait for the full album! This preview has me so excited 🎵",
    },
  });

  await prisma.comments.create({
    data: {
      id: generateId(),
      contentId: behindScenes.id,
      fanId: fan2.id,
      text: 'Love seeing your creative process! That vintage guitar sounds amazing.',
    },
  });

  console.log('💬 Created sample comments');

  // Create test messages
  await prisma.messages.create({
    data: {
      id: generateId(),
      senderId: fan1.id,
      recipientId: artist1.id,
      content:
        "Hi! I absolutely love your acoustic sessions. Any chance you'll be doing live shows soon?",
      type: 'TEXT',
    },
  });

  await prisma.messages.create({
    data: {
      id: generateId(),
      senderId: artist1.id,
      recipientId: fan1.id,
      content:
        "Thank you so much! I'm planning a small acoustic tour next month. I'll announce dates soon!",
      type: 'TEXT',
      readAt: new Date(),
    },
  });

  await prisma.messages.create({
    data: {
      id: generateId(),
      senderId: fan1.id,
      recipientId: artist1.id,
      content: "That's amazing! Count me in for sure. Your coffee shop session was incredible 🎵",
      type: 'TEXT',
    },
  });

  await prisma.messages.create({
    data: {
      id: generateId(),
      senderId: fan2.id,
      recipientId: artist1.id,
      content:
        'Hey! Just subscribed to your premium tier. The behind-the-scenes content is exactly what I was hoping for!',
      type: 'TEXT',
    },
  });

  await prisma.messages.create({
    data: {
      id: generateId(),
      senderId: artist1.id,
      recipientId: fan2.id,
      content:
        "Welcome to the premium tier! So glad you're enjoying the content. More studio sessions coming this week!",
      type: 'TEXT',
    },
  });

  // Create an unread message to test notification badges
  await prisma.messages.create({
    data: {
      id: generateId(),
      senderId: fan2.id,
      recipientId: artist1.id,
      content:
        'Quick question - will VIP members get access to that new song you teased on social media?',
      type: 'TEXT',
    },
  });

  console.log('💌 Created sample messages');

  console.log('✅ Database seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Users: ${await prisma.users.count()}`);
  console.log(`- Artists: ${await prisma.artists.count()}`);
  console.log(`- Tiers: ${await prisma.tiers.count()}`);
  console.log(`- Content: ${await prisma.content.count()}`);
  console.log(`- Subscriptions: ${await prisma.subscriptions.count()}`);
  console.log(`- Comments: ${await prisma.comments.count()}`);
  console.log(`- Messages: ${await prisma.messages.count()}`);
}

main()
  .catch(e => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
