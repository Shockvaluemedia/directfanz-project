#!/usr/bin/env node

/**
 * Beta Launch Data Setup
 * 
 * Creates sample data for DirectFanz beta launch:
 * - Test artists and fans
 * - Sample content
 * - Subscription tiers
 * - Test messaging threads
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

const prisma = new PrismaClient();

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createBetaUsers() {
  log('\n👥 Creating Beta Test Users', 'bold');
  
  const users = [
    // Artists
    {
      id: uuidv4(),
      email: 'artist1@directfanz.io',
      displayName: 'Sarah Music',
      role: 'ARTIST',
      bio: 'Indie singer-songwriter sharing exclusive music and behind-the-scenes content',
      avatar: null,
      updatedAt: new Date(),
    },
    {
      id: uuidv4(),
      email: 'artist2@directfanz.io', 
      displayName: 'Mike Fitness',
      role: 'ARTIST',
      bio: 'Personal trainer offering exclusive workout content and nutrition tips',
      avatar: null,
      updatedAt: new Date(),
    },
    {
      id: uuidv4(),
      email: 'artist3@directfanz.io',
      displayName: 'Emma Art',
      role: 'ARTIST', 
      bio: 'Digital artist sharing drawing tutorials and exclusive artwork',
      avatar: null,
      updatedAt: new Date(),
    },
    
    // Fans
    {
      id: uuidv4(),
      email: 'fan1@directfanz.io',
      displayName: 'Alex Johnson',
      role: 'FAN',
      bio: 'Music lover and fitness enthusiast',
      avatar: null,
      updatedAt: new Date(),
    },
    {
      id: uuidv4(),
      email: 'fan2@directfanz.io',
      displayName: 'Jordan Smith', 
      role: 'FAN',
      bio: 'Art collector and supporter of independent creators',
      avatar: null,
      updatedAt: new Date(),
    },
  ];

  const createdUsers = [];
  for (const userData of users) {
    try {
      const user = await prisma.users.upsert({
        where: { email: userData.email },
        update: userData,
        create: userData,
      });
      createdUsers.push(user);
      log(`✅ Created ${user.role}: ${user.displayName} (${user.email})`, 'green');
    } catch (error) {
      log(`⚠️ User ${userData.email} may already exist`, 'yellow');
    }
  }

  return createdUsers;
}

async function createSubscriptionTiers(artists) {
  log('\n💰 Creating Subscription Tiers', 'bold');

  const tierTemplates = [
    { name: 'Basic Fan', price: 9.99, description: 'Access to exclusive posts and basic content' },
    { name: 'Super Fan', price: 24.99, description: 'Everything in Basic + exclusive videos and direct messaging' },
    { name: 'VIP Member', price: 49.99, description: 'Everything + personalized content and priority messaging' },
  ];

  const createdTiers = [];
  for (const artist of artists.filter(u => u.role === 'ARTIST')) {
    for (const template of tierTemplates) {
      try {
        const tier = await prisma.tiers.create({
          data: {
            id: uuidv4(),
            artistId: artist.id,
            name: template.name,
            description: template.description,
            minimumPrice: template.price,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        createdTiers.push(tier);
        log(`✅ Created tier "${tier.name}" for ${artist.displayName} - $${tier.minimumPrice}`, 'green');
      } catch (error) {
        log(`⚠️ Could not create tier for ${artist.displayName}: ${error.message}`, 'yellow');
      }
    }
  }

  return createdTiers;
}

async function createSampleContent(artists) {
  log('\n🎵 Creating Sample Content', 'bold');

  const contentTemplates = [
    {
      type: 'AUDIO',
      title: 'Acoustic Session - New Song Preview',
      description: 'Exclusive first listen to my upcoming single',
      format: 'mp3',
      fileSize: 5242880, // 5MB
      visibility: 'PRIVATE',
    },
    {
      type: 'IMAGE', 
      title: 'Behind the Scenes - Studio Life',
      description: 'Photos from my latest recording session',
      format: 'jpg',
      fileSize: 2097152, // 2MB
      visibility: 'PUBLIC',
    },
    {
      type: 'VIDEO',
      title: 'Exclusive Music Video',
      description: 'Full music video - available only to subscribers',
      format: 'mp4', 
      fileSize: 52428800, // 50MB
      visibility: 'PRIVATE',
    },
  ];

  const createdContent = [];
  for (const artist of artists.filter(u => u.role === 'ARTIST')) {
    for (const template of contentTemplates) {
      try {
        const content = await prisma.content.create({
          data: {
            id: uuidv4(),
            artistId: artist.id,
            title: template.title,
            description: template.description,
            type: template.type,
            fileUrl: `https://directfanz-content-demo.s3.amazonaws.com/${artist.id}/${template.type.toLowerCase()}/demo-${Date.now()}.${template.format}`,
            thumbnailUrl: template.type === 'VIDEO' ? `https://directfanz-content-demo.s3.amazonaws.com/${artist.id}/thumbnails/thumb-${Date.now()}.jpg` : null,
            visibility: template.visibility,
            fileSize: template.fileSize,
            format: template.format,
            tags: JSON.stringify(['demo', 'exclusive', template.type.toLowerCase()]),
            updatedAt: new Date(),
          },
        });
        createdContent.push(content);
        log(`✅ Created ${template.type} content: "${content.title}" for ${artist.displayName}`, 'green');
      } catch (error) {
        log(`⚠️ Could not create content for ${artist.displayName}: ${error.message}`, 'yellow');
      }
    }
  }

  return createdContent;
}

async function createTestSubscriptions(artists, fans, tiers) {
  log('\n🎫 Creating Test Subscriptions', 'bold');

  const createdSubscriptions = [];
  const artistsArray = artists.filter(u => u.role === 'ARTIST');
  const fansArray = fans.filter(u => u.role === 'FAN');

  // Create some test subscriptions between fans and artists
  for (let i = 0; i < Math.min(fansArray.length, 3); i++) {
    const fan = fansArray[i];
    const artist = artistsArray[i % artistsArray.length];
    const artistTiers = tiers.filter(t => t.artistId === artist.id);
    
    if (artistTiers.length > 0) {
      const tier = artistTiers[0]; // Use the first tier
      
      try {
        const subscription = await prisma.subscriptions.create({
          data: {
            id: uuidv4(),
            fanId: fan.id,
            artistId: artist.id, // Note: this field might not exist in your schema
            tierId: tier.id,
            stripeSubscriptionId: `test_sub_${Date.now()}`,
            amount: tier.minimumPrice,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            updatedAt: new Date(),
          },
        });
        createdSubscriptions.push(subscription);
        log(`✅ Subscribed ${fan.displayName} to ${artist.displayName}'s ${tier.name} tier`, 'green');
      } catch (error) {
        log(`⚠️ Could not create subscription: ${error.message}`, 'yellow');
      }
    }
  }

  return createdSubscriptions;
}

async function createTestMessages(artists, fans) {
  log('\n💬 Creating Test Messages', 'bold');

  try {
    const createdMessages = [];
    const artistsArray = artists.filter(u => u.role === 'ARTIST');
    const fansArray = fans.filter(u => u.role === 'FAN');

    // Create some test messages between fans and artists
    for (let i = 0; i < Math.min(fansArray.length, artistsArray.length); i++) {
      const fan = fansArray[i];
      const artist = artistsArray[i];

      const messages = [
        {
          senderId: fan.id,
          recipientId: artist.id,
          content: `Hi ${artist.displayName}! I love your content. Keep up the great work!`,
          type: 'TEXT',
        },
        {
          senderId: artist.id,
          recipientId: fan.id,
          content: `Thank you so much ${fan.displayName}! Your support means everything to me 💕`,
          type: 'TEXT',
        },
      ];

      for (const msgData of messages) {
        try {
          const message = await prisma.messages.create({
            data: {
              id: uuidv4(),
              senderId: msgData.senderId,
              recipientId: msgData.recipientId,
              content: msgData.content,
              type: msgData.type,
              updatedAt: new Date(),
            },
          });
          createdMessages.push(message);
          log(`✅ Created message from ${msgData.senderId === fan.id ? fan.displayName : artist.displayName}`, 'green');
        } catch (error) {
          log(`⚠️ Could not create message: ${error.message}`, 'yellow');
        }
      }
    }

    return createdMessages;
  } catch (error) {
    log(`⚠️ Messages table may not exist yet. This is normal for new installations.`, 'yellow');
    return [];
  }
}

async function main() {
  log(`\n${colors.bold}🚀 DirectFanz Beta Launch Data Setup${colors.reset}`);
  log('Creating sample artists, fans, content, and subscriptions for testing');
  log('='.repeat(60));

  try {
    const users = await createBetaUsers();
    const artists = users.filter(u => u.role === 'ARTIST');
    const fans = users.filter(u => u.role === 'FAN');

    const tiers = await createSubscriptionTiers(users);
    const content = await createSampleContent(users);
    const subscriptions = await createTestSubscriptions(artists, fans, tiers);
    const messages = await createTestMessages(artists, fans);

    log('\n🎉 Beta Data Setup Complete!', 'bold');
    log('='.repeat(40), 'blue');
    log(`✅ Created ${artists.length} artists`, 'green');
    log(`✅ Created ${fans.length} fans`, 'green');
    log(`✅ Created ${tiers.length} subscription tiers`, 'green');
    log(`✅ Created ${content.length} content items`, 'green');
    log(`✅ Created ${subscriptions.length} test subscriptions`, 'green');
    log(`✅ Created ${messages.length} test messages`, 'green');

    log('\n📝 Beta Test Accounts:', 'blue');
    log('Artists:', 'blue');
    artists.forEach(artist => {
      log(`   • ${artist.email} (${artist.displayName})`, 'reset');
    });
    log('Fans:', 'blue');
    fans.forEach(fan => {
      log(`   • ${fan.email} (${fan.displayName})`, 'reset');
    });

    log('\n🚀 Ready for Beta Testing!', 'green');
    log('You can now log in with these accounts and test:', 'reset');
    log('• User registration and authentication', 'reset');
    log('• Content creation and viewing', 'reset'); 
    log('• Subscription management', 'reset');
    log('• Messaging between artists and fans', 'reset');

  } catch (error) {
    log('\n❌ Beta data setup failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url.startsWith('file:')) {
  main().catch(console.error);
}