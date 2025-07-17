import { PrismaClient, UserRole, ContentType, SubscriptionStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clean existing data (in reverse order of dependencies)
  await prisma.comment.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.content.deleteMany()
  await prisma.tier.deleteMany()
  await prisma.artist.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  console.log('🧹 Cleaned existing data')

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 12)

  // Create artists
  const artist1 = await prisma.user.create({
    data: {
      email: 'indie.artist@example.com',
      password: hashedPassword,
      role: UserRole.ARTIST,
      displayName: 'Indie Artist',
      bio: 'Independent musician creating soulful acoustic music',
      avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
      socialLinks: {
        instagram: '@indieartist',
        twitter: '@indiemusic',
        spotify: 'spotify:artist:123'
      },
      artistProfile: {
        create: {
          isStripeOnboarded: true,
          stripeAccountId: 'acct_test_artist1',
          totalEarnings: 2500.00,
          totalSubscribers: 45
        }
      }
    }
  })

  const artist2 = await prisma.user.create({
    data: {
      email: 'electronic.producer@example.com',
      password: hashedPassword,
      role: UserRole.ARTIST,
      displayName: 'Electronic Producer',
      bio: 'Creating ambient electronic soundscapes and beats',
      avatar: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
      socialLinks: {
        soundcloud: 'electronicproducer',
        bandcamp: 'electronicbeats'
      },
      artistProfile: {
        create: {
          isStripeOnboarded: false,
          totalEarnings: 0,
          totalSubscribers: 0
        }
      }
    }
  })

  // Create fans
  const fan1 = await prisma.user.create({
    data: {
      email: 'music.lover@example.com',
      password: hashedPassword,
      role: UserRole.FAN,
      displayName: 'Music Lover',
      bio: 'Supporting independent artists and discovering new sounds',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400'
    }
  })

  const fan2 = await prisma.user.create({
    data: {
      email: 'superfan@example.com',
      password: hashedPassword,
      role: UserRole.FAN,
      displayName: 'Super Fan',
      bio: 'Collector of rare tracks and supporter of emerging artists'
    }
  })

  console.log('👥 Created sample users')

  // Create tiers for artist1
  const basicTier = await prisma.tier.create({
    data: {
      artistId: artist1.id,
      name: 'Basic Support',
      description: 'Get access to exclusive acoustic sessions and early releases',
      minimumPrice: 5.00,
      subscriberCount: 25
    }
  })

  const premiumTier = await prisma.tier.create({
    data: {
      artistId: artist1.id,
      name: 'Premium Fan',
      description: 'Everything in Basic plus behind-the-scenes content and monthly video calls',
      minimumPrice: 15.00,
      subscriberCount: 15
    }
  })

  const vipTier = await prisma.tier.create({
    data: {
      artistId: artist1.id,
      name: 'VIP Experience',
      description: 'All previous benefits plus personalized songs and priority access to concerts',
      minimumPrice: 50.00,
      subscriberCount: 5
    }
  })

  // Create tiers for artist2
  const electronicBasic = await prisma.tier.create({
    data: {
      artistId: artist2.id,
      name: 'Beat Supporter',
      description: 'Access to unreleased tracks and stems for remixing',
      minimumPrice: 8.00,
      subscriberCount: 0
    }
  })

  console.log('🎵 Created subscription tiers')

  // Create sample content for artist1
  const acousticSession = await prisma.content.create({
    data: {
      artistId: artist1.id,
      title: 'Acoustic Session #1 - Coffee Shop Vibes',
      description: 'Intimate acoustic performance recorded in my favorite local coffee shop',
      type: ContentType.AUDIO,
      fileUrl: 'https://example.com/audio/acoustic-session-1.mp3',
      thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
      isPublic: false,
      fileSize: 15728640, // ~15MB
      duration: 1800, // 30 minutes
      format: 'mp3',
      tags: ['acoustic', 'live', 'intimate'],
      tiers: {
        connect: [{ id: basicTier.id }, { id: premiumTier.id }, { id: vipTier.id }]
      }
    }
  })

  const behindScenes = await prisma.content.create({
    data: {
      artistId: artist1.id,
      title: 'Behind the Scenes - Studio Setup',
      description: 'Take a look at my home studio setup and songwriting process',
      type: ContentType.VIDEO,
      fileUrl: 'https://example.com/video/studio-setup.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800',
      isPublic: false,
      fileSize: 52428800, // ~50MB
      duration: 600, // 10 minutes
      format: 'mp4',
      tags: ['behind-the-scenes', 'studio', 'process'],
      tiers: {
        connect: [{ id: premiumTier.id }, { id: vipTier.id }]
      }
    }
  })

  const exclusiveTrack = await prisma.content.create({
    data: {
      artistId: artist1.id,
      title: 'Midnight Reflections (Exclusive)',
      description: 'A personal song I wrote during late night sessions - only for my VIP supporters',
      type: ContentType.AUDIO,
      fileUrl: 'https://example.com/audio/midnight-reflections.mp3',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800',
      isPublic: false,
      fileSize: 8388608, // ~8MB
      duration: 240, // 4 minutes
      format: 'mp3',
      tags: ['exclusive', 'personal', 'acoustic'],
      tiers: {
        connect: [{ id: vipTier.id }]
      }
    }
  })

  // Create public content
  const publicTrack = await prisma.content.create({
    data: {
      artistId: artist1.id,
      title: 'Summer Breeze (Free Preview)',
      description: 'A taste of my upcoming album - free for everyone to enjoy',
      type: ContentType.AUDIO,
      fileUrl: 'https://example.com/audio/summer-breeze-preview.mp3',
      thumbnailUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      isPublic: true,
      fileSize: 6291456, // ~6MB
      duration: 180, // 3 minutes
      format: 'mp3',
      tags: ['preview', 'summer', 'free']
    }
  })

  console.log('🎶 Created sample content')

  // Create subscriptions
  const subscription1 = await prisma.subscription.create({
    data: {
      fanId: fan1.id,
      artistId: artist1.id,
      tierId: basicTier.id,
      stripeSubscriptionId: 'sub_test_123456',
      amount: 10.00, // Pay-what-you-want above minimum
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  })

  const subscription2 = await prisma.subscription.create({
    data: {
      fanId: fan2.id,
      artistId: artist1.id,
      tierId: premiumTier.id,
      stripeSubscriptionId: 'sub_test_789012',
      amount: 25.00, // Pay-what-you-want above minimum
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  })

  console.log('💳 Created sample subscriptions')

  // Create comments
  await prisma.comment.create({
    data: {
      contentId: acousticSession.id,
      fanId: fan1.id,
      text: 'This acoustic session is absolutely beautiful! The coffee shop ambiance really adds to the intimate feel.'
    }
  })

  await prisma.comment.create({
    data: {
      contentId: publicTrack.id,
      fanId: fan2.id,
      text: 'Can\'t wait for the full album! This preview has me so excited 🎵'
    }
  })

  await prisma.comment.create({
    data: {
      contentId: behindScenes.id,
      fanId: fan2.id,
      text: 'Love seeing your creative process! That vintage guitar sounds amazing.'
    }
  })

  console.log('💬 Created sample comments')

  console.log('✅ Database seed completed successfully!')
  console.log('\n📊 Summary:')
  console.log(`- Users: ${await prisma.user.count()}`)
  console.log(`- Artists: ${await prisma.artist.count()}`)
  console.log(`- Tiers: ${await prisma.tier.count()}`)
  console.log(`- Content: ${await prisma.content.count()}`)
  console.log(`- Subscriptions: ${await prisma.subscription.count()}`)
  console.log(`- Comments: ${await prisma.comment.count()}`)
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })