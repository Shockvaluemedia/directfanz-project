#!/usr/bin/env node

/**
 * DirectFanz Demo Content Creation Script
 * Creates compelling demo content to showcase platform features
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();

// Configuration
const DEMO_PASSWORD = 'DirectFanz2025!';
const DEMO_DOMAIN = 'https://www.directfanz.io';

// Generate unique IDs
function generateId() {
  return 'demo_' + randomBytes(8).toString('base64url');
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color, prefix, message) {
  console.log(`${colors[color]}${prefix}${colors.reset} ${message}`);
}

function logInfo(message) { log('blue', '📝 INFO:', message); }
function logSuccess(message) { log('green', '✅ SUCCESS:', message); }
function logWarning(message) { log('yellow', '⚠️  WARNING:', message); }
function logError(message) { log('red', '❌ ERROR:', message); }
function logHeader(message) { log('cyan', '🎨 DEMO CONTENT:', message); }

// Demo artists data
const demoArtists = [
  {
    email: 'luna.wilde@directfanz.io',
    displayName: 'Luna Wilde',
    bio: '🎵 Indie singer-songwriter from Portland • Creating dreamy acoustic melodies • Coffee shop regular • Cat mom to 3 rescues',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616c6f1e6cd?w=400&h=400&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=400&fit=crop',
    socialLinks: {
      instagram: '@lunawildemusic',
      twitter: '@lunawilde',
      spotify: 'spotify:artist:lunawilde',
      youtube: 'youtube.com/lunawildeofficial'
    },
    isStripeOnboarded: true,
    totalEarnings: 8750.00,
    totalSubscribers: 124,
    tiers: [
      {
        name: 'Coffee Shop Sessions',
        description: '☕ Get access to intimate acoustic sessions recorded in cozy coffee shops around Portland',
        minimumPrice: 7.99,
        benefits: ['Exclusive acoustic recordings', 'Early access to new songs', 'Monthly Spotify playlist updates']
      },
      {
        name: 'Backstage Pass',
        description: '🎸 Join me behind the scenes with studio sessions, songwriting process, and personal vlogs',
        minimumPrice: 19.99,
        benefits: ['Everything from Coffee Shop Sessions', 'Behind-the-scenes videos', 'Songwriting voice memos', 'Monthly video calls']
      },
      {
        name: 'VIP Inner Circle',
        description: '⭐ My most dedicated fans get personalized content and first access to everything',
        minimumPrice: 49.99,
        benefits: ['Everything from previous tiers', 'Personalized voice messages', 'Custom song requests', 'Early concert tickets', 'Signed merchandise']
      }
    ],
    content: [
      {
        title: 'Late Night Coffee Shop Session',
        description: 'Recorded this intimate acoustic set at my favorite 24-hour coffee spot in Portland. The rain outside was perfect ambiance 🌧️',
        type: 'AUDIO',
        fileUrl: `${DEMO_DOMAIN}/demo/audio/late-night-session.mp3`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=600&fit=crop',
        visibility: 'TIER_LOCKED',
        tags: ['acoustic', 'intimate', 'coffee-shop', 'rain'],
        tiers: [0, 1, 2] // Available to all tiers
      },
      {
        title: 'Songwriting Process: "Midnight Dreams"',
        description: 'Take a peek into how I wrote my latest song from initial voice memo to final recording',
        type: 'VIDEO',
        fileUrl: `${DEMO_DOMAIN}/demo/video/songwriting-process.mp4`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop',
        visibility: 'TIER_LOCKED',
        tags: ['songwriting', 'process', 'behind-the-scenes'],
        tiers: [1, 2] // Backstage Pass and VIP only
      },
      {
        title: 'Personal Voice Message - Thank You!',
        description: 'A heartfelt thank you message for all my VIP supporters. You make this journey possible! 💕',
        type: 'AUDIO',
        fileUrl: `${DEMO_DOMAIN}/demo/audio/thank-you-vip.mp3`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&h=600&fit=crop',
        visibility: 'TIER_LOCKED',
        tags: ['personal', 'gratitude', 'vip-only'],
        tiers: [2] // VIP only
      },
      {
        title: 'Free Preview - "Summer Memories"',
        description: 'A taste of my upcoming album! This track captures those perfect summer evenings 🌅',
        type: 'AUDIO',
        fileUrl: `${DEMO_DOMAIN}/demo/audio/summer-memories-preview.mp3`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
        visibility: 'PUBLIC',
        tags: ['preview', 'summer', 'free', 'album']
      }
    ]
  },
  {
    email: 'alexsynth@directfanz.io',
    displayName: 'Alex Synth',
    bio: '🎹 Electronic music producer • Synthwave & Ambient • Creating soundscapes for the digital age • Gear enthusiast • Night owl',
    avatar: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=400&fit=crop',
    socialLinks: {
      soundcloud: 'alexsynth',
      bandcamp: 'alexsynth',
      instagram: '@alexsynthmusic',
      youtube: 'youtube.com/alexsynth'
    },
    isStripeOnboarded: true,
    totalEarnings: 3200.00,
    totalSubscribers: 67,
    tiers: [
      {
        name: 'Synth Explorer',
        description: '🎛️ Access to unreleased tracks, stems for remixing, and gear reviews',
        minimumPrice: 9.99,
        benefits: ['Unreleased electronic tracks', 'Remix stems & loops', 'Gear reviews and tutorials']
      },
      {
        name: 'Studio Access',
        description: '🎵 Deep dive into my production process with project files and live production streams',
        minimumPrice: 24.99,
        benefits: ['Everything from Synth Explorer', 'Ableton Live project files', 'Live production streams', 'Sample packs']
      }
    ],
    content: [
      {
        title: 'Neon Dreams - Unreleased Track',
        description: 'A synthwave journey through neon-lit cityscapes. This one\'s been sitting in my vault for months!',
        type: 'AUDIO',
        fileUrl: `${DEMO_DOMAIN}/demo/audio/neon-dreams.mp3`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&h=600&fit=crop',
        visibility: 'TIER_LOCKED',
        tags: ['synthwave', 'unreleased', 'neon', 'cityscape'],
        tiers: [0, 1] // Available to both tiers
      },
      {
        title: 'Production Tutorial: Creating Ambient Pads',
        description: 'Learn how I create those lush ambient pad sounds using Serum and native Ableton effects',
        type: 'VIDEO',
        fileUrl: `${DEMO_DOMAIN}/demo/video/ambient-pads-tutorial.mp4`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&h=600&fit=crop',
        visibility: 'TIER_LOCKED',
        tags: ['tutorial', 'ableton', 'serum', 'ambient'],
        tiers: [1] // Studio Access only
      },
      {
        title: 'Retro Synthwave - Free Track',
        description: 'A free taste of my synthwave style. Perfect for late night drives or coding sessions',
        type: 'AUDIO',
        fileUrl: `${DEMO_DOMAIN}/demo/audio/retro-synthwave-free.mp3`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=600&fit=crop',
        visibility: 'PUBLIC',
        tags: ['synthwave', 'retro', 'free', 'coding', 'driving']
      }
    ]
  },
  {
    email: 'maya.colors@directfanz.io',
    displayName: 'Maya Colors',
    bio: '🎨 Digital artist & illustrator • Vibrant character designs • Fantasy art • Tutorials & process videos • Coffee powered creativity',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&h=400&fit=crop',
    socialLinks: {
      instagram: '@mayacolorsart',
      twitter: '@mayacolors',
      artstation: 'mayacolors',
      etsy: 'mayacolorsshop'
    },
    isStripeOnboarded: false,
    totalEarnings: 0,
    totalSubscribers: 0,
    tiers: [
      {
        name: 'Art Enthusiast',
        description: '🎨 High-res artwork downloads and step-by-step process videos',
        minimumPrice: 12.99,
        benefits: ['High-resolution artwork downloads', 'Process timelapse videos', 'Monthly art tutorials']
      },
      {
        name: 'Creative Circle',
        description: '✨ Join my creative journey with exclusive sketches, WIP shots, and design challenges',
        minimumPrice: 29.99,
        benefits: ['Everything from Art Enthusiast', 'Work-in-progress updates', 'Exclusive sketch dumps', 'Monthly design challenges']
      }
    ],
    content: [
      {
        title: 'Fantasy Character Design Process',
        description: 'Watch me design a fantasy warrior character from initial sketch to final colored illustration',
        type: 'VIDEO',
        fileUrl: `${DEMO_DOMAIN}/demo/video/character-design-process.mp4`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
        visibility: 'TIER_LOCKED',
        tags: ['fantasy', 'character-design', 'process', 'tutorial'],
        tiers: [0, 1] // Available to both tiers
      },
      {
        title: 'Sketch Dump - October 2024',
        description: 'A collection of rough sketches and ideas from my sketchbook. Raw creativity in its purest form!',
        type: 'IMAGE',
        fileUrl: `${DEMO_DOMAIN}/demo/images/sketch-dump-october.jpg`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
        visibility: 'TIER_LOCKED',
        tags: ['sketches', 'dump', 'rough', 'ideas', 'sketchbook'],
        tiers: [1] // Creative Circle only
      },
      {
        title: 'Free Wallpaper - Mystic Forest',
        description: 'A beautiful fantasy forest scene - free for everyone to use as wallpaper!',
        type: 'IMAGE',
        fileUrl: `${DEMO_DOMAIN}/demo/images/mystic-forest-wallpaper.jpg`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop',
        visibility: 'PUBLIC',
        tags: ['wallpaper', 'fantasy', 'forest', 'free', 'desktop']
      }
    ]
  }
];

// Demo fans data
const demoFans = [
  {
    email: 'sarah.musicfan@gmail.com',
    displayName: 'Sarah Mitchell',
    bio: '🎵 Music lover from Seattle • Indie rock enthusiast • Concert photographer • Supporting independent artists',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616c6f1e6cd?w=400&h=400&fit=crop&crop=face'
  },
  {
    email: 'mike.synthlover@gmail.com',
    displayName: 'Mike Johnson',
    bio: '🎹 Synthwave collector • Producer wannabe • Gear nerd • Always hunting for new electronic sounds',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face'
  },
  {
    email: 'emily.artcollector@gmail.com',
    displayName: 'Emily Chen',
    bio: '🎨 Digital art collector • Fantasy enthusiast • Supporting indie artists • Designer by day, dreamer by night',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face'
  },
  {
    email: 'demo.visitor@directfanz.io',
    displayName: 'Demo Visitor',
    bio: '👋 Welcome to DirectFanz! This is a demo account to explore the platform',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop&crop=face'
  }
];

// Sample comments for engagement
const sampleComments = [
  "This is absolutely beautiful! The acoustic guitar sounds so crisp 🎸",
  "Love the production quality on this track! Can't wait for more 🔥",
  "Your creative process is so inspiring to watch. Thank you for sharing!",
  "The atmosphere in this recording is perfect. Gives me chills every time",
  "Amazing work as always! Your consistency is incredible 👏",
  "This song got me through a tough day. Thank you for sharing your art ❤️",
  "The way you build up the synth layers is masterful. Learning so much!",
  "Your art style is so unique. I love the color palette choices!",
  "Been following your work for months and it just keeps getting better",
  "This preview has me so excited for the full release! 🎵"
];

async function createDemoContent() {
  try {
    console.log('\n🎨 DirectFanz Demo Content Creation');
    console.log('====================================\n');

    logHeader('Starting demo content creation...');

    // Hash password
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
    logInfo('Password hashed for demo accounts');

    // Clean existing demo data
    logInfo('Cleaning existing demo data...');
    
    // Delete in dependency order
    await prisma.comments.deleteMany({
      where: {
        users: {
          email: {
            contains: 'directfanz.io'
          }
        }
      }
    });

    await prisma.subscriptions.deleteMany({
      where: {
        users: {
          email: {
            contains: 'directfanz.io'
          }
        }
      }
    });

    await prisma.content.deleteMany({
      where: {
        users: {
          email: {
            contains: 'directfanz.io'
          }
        }
      }
    });

    await prisma.tiers.deleteMany({
      where: {
        users: {
          email: {
            contains: 'directfanz.io'
          }
        }
      }
    });

    await prisma.artists.deleteMany({
      where: {
        users: {
          email: {
            contains: 'directfanz.io'
          }
        }
      }
    });

    await prisma.users.deleteMany({
      where: {
        email: {
          contains: 'directfanz.io'
        }
      }
    });

    await prisma.users.deleteMany({
      where: {
        email: {
          contains: '@gmail.com'
        }
      }
    });

    logSuccess('Cleaned existing demo data');

    // Create demo artists
    const createdArtists = [];
    
    for (const artistData of demoArtists) {
      logInfo(`Creating artist: ${artistData.displayName}`);
      
      const artist = await prisma.users.create({
        data: {
          email: artistData.email,
          password: hashedPassword,
          role: 'ARTIST',
          displayName: artistData.displayName,
          bio: artistData.bio,
          avatar: artistData.avatar,
          socialLinks: artistData.socialLinks,
          emailVerified: new Date(),
          artists: {
            create: {
              isStripeOnboarded: artistData.isStripeOnboarded,
              stripeAccountId: artistData.isStripeOnboarded ? `acct_demo_${generateId()}` : null,
              totalEarnings: artistData.totalEarnings,
              totalSubscribers: artistData.totalSubscribers
            }
          }
        },
        include: {
          artists: true
        }
      });

      // Create tiers for artist
      const createdTiers = [];
      for (const [index, tierData] of artistData.tiers.entries()) {
        const tier = await prisma.tiers.create({
          data: {
            artistId: artist.id,
            name: tierData.name,
            description: tierData.description,
            minimumPrice: tierData.minimumPrice,
            subscriberCount: Math.floor(artistData.totalSubscribers / artistData.tiers.length)
          }
        });
        createdTiers.push(tier);
        logInfo(`  Created tier: ${tierData.name} ($${tierData.minimumPrice})`);
      }

      // Create content for artist
      for (const contentData of artistData.content) {
        const contentTiers = contentData.tiers ? contentData.tiers.map(tierIndex => createdTiers[tierIndex]) : [];
        
        const content = await prisma.content.create({
          data: {
            artistId: artist.id,
            title: contentData.title,
            description: contentData.description,
            type: contentData.type,
            fileUrl: contentData.fileUrl,
            thumbnailUrl: contentData.thumbnailUrl,
            visibility: contentData.visibility,
            fileSize: Math.floor(Math.random() * 50000000) + 1000000, // 1MB to 50MB
            duration: contentData.type === 'AUDIO' ? Math.floor(Math.random() * 600) + 60 : 
                     contentData.type === 'VIDEO' ? Math.floor(Math.random() * 1800) + 120 : null,
            format: contentData.type === 'AUDIO' ? 'mp3' : 
                   contentData.type === 'VIDEO' ? 'mp4' : 'jpg',
            tags: JSON.stringify(contentData.tags),
            totalViews: Math.floor(Math.random() * 500) + 50,
            likeCount: Math.floor(Math.random() * 50) + 5,
            tiers: {
              connect: contentTiers.map(tier => ({ id: tier.id }))
            }
          }
        });

        logInfo(`  Created content: ${contentData.title} (${contentData.type})`);
      }

      createdArtists.push({ user: artist, tiers: createdTiers });
      logSuccess(`Created artist: ${artistData.displayName} with ${artistData.tiers.length} tiers and ${artistData.content.length} content items`);
    }

    // Create demo fans
    const createdFans = [];
    
    for (const fanData of demoFans) {
      logInfo(`Creating fan: ${fanData.displayName}`);
      
      const fan = await prisma.users.create({
        data: {
          email: fanData.email,
          password: hashedPassword,
          role: 'FAN',
          displayName: fanData.displayName,
          bio: fanData.bio,
          avatar: fanData.avatar,
          emailVerified: new Date()
        }
      });

      createdFans.push(fan);
      logSuccess(`Created fan: ${fanData.displayName}`);
    }

    // Create subscriptions (fans subscribing to artists)
    logInfo('Creating sample subscriptions...');
    
    // Sarah subscribes to Luna Wilde's Coffee Shop Sessions
    await prisma.subscriptions.create({
      data: {
        fanId: createdFans[0].id, // Sarah
        artistId: createdArtists[0].user.id, // Luna Wilde
        tierId: createdArtists[0].tiers[0].id, // Coffee Shop Sessions
        stripeSubscriptionId: `sub_demo_${generateId()}`,
        amount: 10.99, // Pay what you want above minimum
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // Mike subscribes to Alex Synth's Studio Access
    await prisma.subscriptions.create({
      data: {
        fanId: createdFans[1].id, // Mike
        artistId: createdArtists[1].user.id, // Alex Synth
        tierId: createdArtists[1].tiers[1].id, // Studio Access
        amount: 24.99,
        status: 'active',
        stripeSubscriptionId: `sub_demo_${generateId()}`,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // Emily subscribes to Maya's Creative Circle
    await prisma.subscriptions.create({
      data: {
        fanId: createdFans[2].id, // Emily
        artistId: createdArtists[2].user.id, // Maya Colors
        tierId: createdArtists[2].tiers[1].id, // Creative Circle
        amount: 35.00,
        status: 'active',
        stripeSubscriptionId: `sub_demo_${generateId()}`,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    logSuccess('Created sample subscriptions');

    // Create engaging comments
    logInfo('Creating sample comments...');
    
    let commentCount = 0;
    for (const artist of createdArtists) {
      const artistContent = await prisma.content.findMany({
        where: { artistId: artist.user.id }
      });

      for (const content of artistContent) {
        // Add 2-4 comments per content item
        const numComments = Math.floor(Math.random() * 3) + 2;
        
        for (let i = 0; i < numComments; i++) {
          const randomFan = createdFans[Math.floor(Math.random() * createdFans.length)];
          const randomComment = sampleComments[Math.floor(Math.random() * sampleComments.length)];
          
          await prisma.comments.create({
            data: {
              contentId: content.id,
              fanId: randomFan.id,
              text: randomComment,
              createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)) // Random time within last week
            }
          });
          commentCount++;
        }
      }
    }

    logSuccess(`Created ${commentCount} sample comments`);

    // Update content view counts and engagement
    logInfo('Updating content engagement metrics...');
    
    const allContent = await prisma.content.findMany({
      where: {
        users: {
          email: {
            contains: 'directfanz.io'
          }
        }
      }
    });

    for (const content of allContent) {
      await prisma.content.update({
        where: { id: content.id },
        data: {
          totalViews: Math.floor(Math.random() * 1000) + 100,
          likeCount: Math.floor(Math.random() * 80) + 10
        }
      });
    }

    logSuccess('Updated content engagement metrics');

    // Summary
    console.log('\n' + '='.repeat(50));
    logHeader('Demo Content Creation Complete!');
    
    console.log('\n📊 Summary:');
    console.log(`   • Artists: ${demoArtists.length}`);
    console.log(`   • Fans: ${demoFans.length}`);
    console.log(`   • Tiers: ${demoArtists.reduce((sum, artist) => sum + artist.tiers.length, 0)}`);
    console.log(`   • Content: ${demoArtists.reduce((sum, artist) => sum + artist.content.length, 0)}`);
    console.log(`   • Subscriptions: 3`);
    console.log(`   • Comments: ${commentCount}`);

    console.log('\n🔑 Demo Login Credentials:');
    console.log('   Password for all accounts: DirectFanz2025!');
    console.log('\n   Artists:');
    demoArtists.forEach(artist => {
      console.log(`   • ${artist.displayName}: ${artist.email}`);
    });
    
    console.log('\n   Fans:');
    demoFans.forEach(fan => {
      console.log(`   • ${fan.displayName}: ${fan.email}`);
    });

    console.log('\n🌟 Demo Features Showcased:');
    console.log('   ✅ Multiple artist types (musician, producer, digital artist)');
    console.log('   ✅ Tiered subscription model');
    console.log('   ✅ Mixed content types (audio, video, images)');
    console.log('   ✅ Public vs gated content');
    console.log('   ✅ Fan engagement (comments, subscriptions)');
    console.log('   ✅ Social proof (view counts, likes, subscriber counts)');
    console.log('   ✅ Realistic pricing models');
    console.log('   ✅ Professional profiles with social links');

    console.log('\n🚀 DirectFanz demo content is ready!');
    console.log(`Visit ${DEMO_DOMAIN} to explore the platform\n`);

  } catch (error) {
    logError('Demo content creation failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n🛑 Demo content creation interrupted');
  process.exit(130);
});

// Run if called directly
if (require.main === module) {
  createDemoContent().catch(error => {
    logError(`Demo content creation failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { createDemoContent };