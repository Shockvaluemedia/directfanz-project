const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('🚀 Creating test data for campaign system...\n');

    // Get the artist user we created
    const artist = await prisma.user.findUnique({
      where: { email: 'artist@test.com' }
    });

    if (!artist) {
      console.error('❌ Artist not found! Please create artist@test.com first.');
      return;
    }

    console.log(`✅ Found artist: ${artist.displayName} (${artist.id})`);

    // Create sample campaigns
    const campaigns = [
      {
        title: 'Summer Vibes Photo Contest',
        description: 'Share your best summer moments! Upload photos that capture the essence of summer - whether it\'s beach days, festivals, or just chilling with friends.',
        type: 'PROMOTIONAL',
        status: 'ACTIVE',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Started 1 week ago
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Ends in 2 weeks
        targetMetric: 'PARTICIPANTS',
        targetValue: 100,
        currentValue: 23,
        totalParticipants: 23,
        totalPrizePool: 500.00,
        hasDigitalPrizes: true,
        hasPhysicalPrizes: true,
        artistId: artist.id,
      },
      {
        title: 'New Album Launch Campaign',
        description: 'Help us celebrate the launch of "Midnight Dreams" - our latest album! Share what this music means to you and get exclusive access.',
        type: 'PROMOTIONAL',
        status: 'ACTIVE',
        startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Started 3 days ago
        endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // Ends in 3 weeks
        targetMetric: 'ENGAGEMENT',
        targetValue: 1000,
        currentValue: 456,
        totalParticipants: 78,
        totalPrizePool: 1000.00,
        hasDigitalPrizes: true,
        hasPhysicalPrizes: true,
        artistId: artist.id,
      },
      {
        title: 'Fan Art Showcase',
        description: 'Show us your creative side! Draw, paint, or design anything inspired by our music and visual aesthetic.',
        type: 'PROMOTIONAL',
        status: 'ACTIVE',
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Started 2 weeks ago
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Ends in 1 week
        targetMetric: 'SUBMISSIONS',
        targetValue: 50,
        currentValue: 34,
        totalParticipants: 45,
        totalPrizePool: 300.00,
        hasDigitalPrizes: true,
        hasPhysicalPrizes: false,
        artistId: artist.id,
      },
      {
        title: 'Holiday Cover Contest',
        description: 'Put your spin on classic holiday songs! Record your unique version and share it with the community.',
        type: 'PROMOTIONAL',
        status: 'ENDED',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
        endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Ended 2 days ago
        targetMetric: 'PARTICIPANTS',
        targetValue: 200,
        currentValue: 234,
        totalParticipants: 234,
        totalPrizePool: 750.00,
        hasDigitalPrizes: true,
        hasPhysicalPrizes: true,
        artistId: artist.id,
      }
    ];

    console.log('\n📝 Creating campaigns...');
    
    for (const campaignData of campaigns) {
      const campaign = await prisma.campaign.create({
        data: campaignData
      });
      
      console.log(`   ✅ Created: ${campaign.title} (${campaign.status})`);
      
      // Create some challenges for each campaign
      if (campaign.status === 'ACTIVE') {
        const challenge = await prisma.challenge.create({
          data: {
            title: `${campaign.title} Challenge`,
            description: `Main challenge for ${campaign.title}`,
            type: 'CREATIVE_PROMPT',
            status: 'ACTIVE',
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            rules: JSON.stringify({
              "requirements": ["Submit original content only", "Follow community guidelines"],
              "judging_criteria": ["Creativity", "Originality", "Community engagement"]
            }),
            submissionTypes: JSON.stringify(["TEXT", "IMAGE", "VIDEO"]),
            scoringCriteria: JSON.stringify({
              "creativity": { "weight": 40, "description": "How creative is the submission?" },
              "originality": { "weight": 35, "description": "How original is the content?" },
              "engagement": { "weight": 25, "description": "How well does it engage the community?" }
            }),
            maxScore: 100,
            participantCount: Math.floor(campaign.totalParticipants * 0.8),
            submissionCount: Math.floor(campaign.totalParticipants * 0.6),
            campaignId: campaign.id,
          }
        });
        
        console.log(`      ➕ Added challenge: ${challenge.title}`);
        
        // Create some rewards for active campaigns
        await prisma.campaignReward.create({
          data: {
            title: 'Grand Prize',
            description: 'Winner gets exclusive merchandise and signed album',
            type: 'MERCHANDISE',
            value: 200.00,
            currency: 'USD',
            quantity: 1,
            rankRequirement: 1,
            isActive: true,
            campaignId: campaign.id,
          }
        });
        
        await prisma.campaignReward.create({
          data: {
            title: 'Runner Up Prize',
            description: 'Top 5 participants get digital EP early access',
            type: 'EXCLUSIVE_CONTENT',
            value: 20.00,
            currency: 'USD',
            quantity: 5,
            rankRequirement: 5,
            isActive: true,
            campaignId: campaign.id,
          }
        });
        
        console.log(`      🎁 Added rewards`);
      }
    }

    // Get the fan user
    const fan = await prisma.user.findUnique({
      where: { email: 'fan@test.com' }
    });

    if (fan) {
      console.log(`\n👤 Found fan: ${fan.displayName} (${fan.id})`);
      
      // Create some participation data for the fan
      const activeCampaigns = await prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
        include: { challenges: true }
      });
      
      console.log('\n🎮 Creating fan participations...');
      
      for (const campaign of activeCampaigns.slice(0, 2)) { // Participate in first 2 campaigns
        if (campaign.challenges.length > 0) {
          const challenge = campaign.challenges[0];
          
          const participation = await prisma.challengeParticipation.create({
            data: {
              participantId: fan.id,
              challengeId: challenge.id,
              status: 'ACTIVE',
              currentScore: Math.floor(Math.random() * 50) + 10,
              submissionCount: Math.floor(Math.random() * 3) + 1,
              rank: Math.floor(Math.random() * 20) + 1,
              joinedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
              lastActiveAt: new Date(),
            }
          });
          
          console.log(`   ✅ Joined: ${campaign.title}`);
          
          // Create a sample submission
          await prisma.challengeSubmission.create({
            data: {
              challengeId: challenge.id,
              participationId: participation.id,
              submitterId: fan.id,
              title: `My entry for ${campaign.title}`,
              description: 'This is my awesome submission for this campaign!',
              contentType: 'TEXT',
              contentUrl: 'https://example.com/submission-content',
              status: 'SUBMITTED',
              reviewStatus: 'PENDING',
              totalScore: participation.currentScore,
            }
          });
          
          console.log(`      📝 Added submission`);
        }
      }
    }

    console.log('\n🎉 Test data created successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • Created ${campaigns.length} campaigns (3 active, 1 completed)`);
    console.log(`   • Added challenges and rewards to active campaigns`);
    console.log(`   • Created fan participation in 2 campaigns`);
    console.log(`   • Added sample submissions`);
    
    console.log('\n🔑 Test Accounts:');
    console.log(`   • Artist: artist@test.com / password123`);
    console.log(`   • Fan: fan@test.com / password123`);
    
    console.log('\n🌐 You can now:');
    console.log(`   1. Visit http://localhost:3000/auth/signin to sign in`);
    console.log(`   2. Sign in as the artist to see campaign management features`);
    console.log(`   3. Sign in as the fan to see campaign discovery and participation`);
    console.log(`   4. Visit http://localhost:3000/campaigns to see public campaigns`);
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();