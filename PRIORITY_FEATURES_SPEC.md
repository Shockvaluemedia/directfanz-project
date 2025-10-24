# DirectFanz Priority Features - Technical Specifications

## Overview
This document provides detailed technical specifications for the **Top 5 Priority Features** identified in the customer journey analysis.

---

## Feature #1: Artist Setup Wizard

### **Priority**: 🔴 CRITICAL
### **Impact**: ↑ Artist activation by 60%, ↓ Time to first revenue by 70%
### **Complexity**: 🟡 Medium
### **Timeline**: 1-2 weeks

---

### User Story
```
As a new artist,
I want step-by-step guidance after signup,
So that I can start earning money quickly without getting lost.
```

### Acceptance Criteria
- [x] Checklist appears immediately after onboarding
- [x] Each step links to the relevant action
- [x] Progress bar shows completion percentage
- [x] Wizard is dismissible but re-accessible
- [x] Completed steps are marked with checkmarks
- [x] Next uncompleted step is highlighted
- [x] Dashboard shows checklist widget until 100% complete

### Technical Specification

#### Database Schema
```prisma
model OnboardingProgress {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            users    @relation(fields: [userId], references: [id])

  profileComplete        Boolean @default(false)
  stripeConnected        Boolean @default(false)
  firstTierCreated       Boolean @default(false)
  firstContentUploaded   Boolean @default(false)
  profileShared          Boolean @default(false)

  completionPercentage   Int     @default(0)
  dismissedAt            DateTime?
  completedAt            DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
}
```

#### API Routes
```typescript
// GET /api/artist/onboarding/progress
// Returns current onboarding status

// PUT /api/artist/onboarding/progress
// Updates step completion

// POST /api/artist/onboarding/dismiss
// Dismisses wizard (but keeps accessible)

// POST /api/artist/onboarding/reset
// Resets wizard (for testing or re-onboarding)
```

#### Component Structure
```
components/
└── onboarding/
    ├── ArtistSetupWizard.tsx         # Main wizard component
    ├── SetupChecklist.tsx             # Checklist UI
    ├── SetupProgressBar.tsx           # Progress indicator
    ├── steps/
    │   ├── ProfileCompleteStep.tsx
    │   ├── StripeConnectStep.tsx
    │   ├── CreateTierStep.tsx
    │   ├── UploadContentStep.tsx
    │   └── ShareProfileStep.tsx
    └── DashboardChecklistWidget.tsx   # Mini widget for dashboard
```

#### Business Logic
```typescript
const SETUP_STEPS = [
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Add profile photo, banner, and bio',
    action: 'Go to Profile',
    link: '/dashboard/artist/profile',
    weight: 20, // Contributes 20% to completion
    validate: async (userId) => {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        include: { artists: true }
      });
      return !!(user?.avatar && user?.artists[0]?.bio);
    }
  },
  {
    id: 'stripe',
    title: 'Connect Stripe Account',
    description: 'Required to receive payouts',
    action: 'Connect Stripe',
    link: '/api/artist/stripe/onboard',
    weight: 30, // Most important step
    required: true,
    validate: async (userId) => {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeAccountId: true }
      });
      return !!user?.stripeAccountId;
    }
  },
  {
    id: 'tier',
    title: 'Create Your First Tier',
    description: 'Set pricing for your exclusive content',
    action: 'Create Tier',
    link: '/dashboard/artist/tiers',
    weight: 25,
    templates: [
      { name: 'Supporter', price: 5, description: 'Basic exclusive content' },
      { name: 'Super Fan', price: 10, description: 'All content + early access' },
      { name: 'VIP', price: 25, description: 'Everything + personal perks' }
    ],
    validate: async (userId) => {
      const tierCount = await prisma.tiers.count({
        where: { artistId: userId }
      });
      return tierCount > 0;
    }
  },
  {
    id: 'content',
    title: 'Upload Your First Content',
    description: 'Share something exclusive with fans',
    action: 'Upload Content',
    link: '/dashboard/artist/content/upload',
    weight: 15,
    suggestions: [
      'Welcome video introducing yourself',
      'Exclusive track or preview',
      'Behind-the-scenes photo/video',
      'Personal message to first fans'
    ],
    validate: async (userId) => {
      const contentCount = await prisma.content.count({
        where: { artistId: userId }
      });
      return contentCount > 0;
    }
  },
  {
    id: 'share',
    title: 'Share Your Profile',
    description: 'Invite fans from your social media',
    action: 'Get Share Link',
    link: '/dashboard/artist/share',
    weight: 10,
    validate: async (userId) => {
      // Marked complete when user copies link or shares
      const progress = await prisma.onboardingProgress.findUnique({
        where: { userId }
      });
      return progress?.profileShared || false;
    }
  }
];
```

#### UI Mockup
```jsx
<SetupWizardWidget>
  <ProgressBar value={60} total={100} />

  <Heading>Complete Your Setup</Heading>
  <Subheading>3 of 5 steps complete</Subheading>

  <Checklist>
    <ChecklistItem completed icon={CheckIcon}>
      ✅ Profile Complete
    </ChecklistItem>

    <ChecklistItem completed icon={CheckIcon}>
      ✅ Stripe Connected
    </ChecklistItem>

    <ChecklistItem active icon={DiamondIcon}>
      Create Your First Tier
      <QuickActionButton>Create Now</QuickActionButton>
      <TemplateSelector>
        <Template price={5}>Supporter</Template>
        <Template price={10}>Super Fan ⭐</Template>
        <Template price={25}>VIP</Template>
      </TemplateSelector>
    </ChecklistItem>

    <ChecklistItem pending icon={UploadIcon}>
      Upload Your First Content
    </ChecklistItem>

    <ChecklistItem pending icon={ShareIcon}>
      Share Your Profile
    </ChecklistItem>
  </Checklist>

  <DismissButton>I'll do this later</DismissButton>
</SetupWizardWidget>
```

---

## Feature #2: Stripe Onboarding Flow

### **Priority**: 🔴 CRITICAL
### **Impact**: ↑ Payout activation from 30% to 80%
### **Complexity**: 🟡 Medium
### **Timeline**: 1 week

---

### User Story
```
As an artist,
I need to connect Stripe to get paid,
But I shouldn't be able to create paid tiers without it.
```

### Acceptance Criteria
- [x] Modal appears when creating first tier
- [x] Cannot create tier without Stripe
- [x] One-click Stripe Connect integration
- [x] Show connection status in dashboard
- [x] Handle Stripe Connect redirects
- [x] Verify account before allowing payouts

### Technical Specification

#### Trigger Points
```typescript
// Trigger #1: First tier creation attempt
if (!user.stripeAccountId && isCreatingTier) {
  return <StripeOnboardingModal />;
}

// Trigger #2: Dashboard banner (if setup wizard incomplete)
if (!user.stripeAccountId && onboardingNotComplete) {
  return <StripeConnectionBanner />;
}

// Trigger #3: Profile completeness check
// Show warning if trying to go live without Stripe
```

#### API Integration
```typescript
// POST /api/artist/stripe/connect
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = await prisma.users.findUnique({
    where: { id: session.user.id }
  });

  if (user.stripeAccountId) {
    return json({ success: true, accountId: user.stripeAccountId });
  }

  // Create Stripe Connect account
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US', // Get from user profile
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    business_profile: {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/artist/${user.id}`,
      mcc: '8999', // Misc professional services
      product_description: 'Creator content and subscriptions'
    }
  });

  // Save account ID
  await prisma.users.update({
    where: { id: user.id },
    data: { stripeAccountId: account.id }
  });

  // Generate onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist/stripe/refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist/stripe/success`,
    type: 'account_onboarding',
  });

  return json({ success: true, url: accountLink.url });
}

// GET /api/artist/stripe/status
// Returns Stripe account status & capabilities
export async function GET(req: Request) {
  const account = await stripe.accounts.retrieve(user.stripeAccountId);

  return json({
    connected: true,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  });
}
```

#### UI Component
```jsx
<StripeOnboardingModal>
  <Icon>💳</Icon>
  <Heading>Connect Stripe to Get Paid</Heading>

  <InfoCard>
    <Check>✅ Daily payouts to your bank</Check>
    <Check>✅ You keep 80% of all revenue</Check>
    <Check>✅ Secure & PCI compliant</Check>
    <Check>✅ Takes 2 minutes to set up</Check>
  </InfoCard>

  <StripeConnectButton onClick={handleConnect}>
    <StripeIcon />
    Connect with Stripe
  </StripeConnectButton>

  <FooterNote>
    You cannot create paid tiers without connecting Stripe.
  </FooterNote>
</StripeOnboardingModal>
```

---

## Feature #3: Free Trial System

### **Priority**: 🔴 CRITICAL
### **Impact**: ↑ Subscription conversion by 40%
### **Complexity**: 🟢 Low-Medium
### **Timeline**: 1 week

---

### User Story
```
As a fan,
I want to try a subscription before paying,
So I can see if the content is worth it.
```

### Acceptance Criteria
- [x] Artists can enable/disable trials per tier
- [x] 7-day free trial period (configurable)
- [x] Full access during trial
- [x] Auto-converts to paid after trial
- [x] Can cancel during trial (no charge)
- [x] Stripe subscription with trial period
- [x] Email reminders before trial ends

### Technical Specification

#### Database Schema
```prisma
model tiers {
  // ... existing fields

  allowFreeTrial   Boolean @default(true)
  trialDays        Int     @default(7)
  trialDescription String? // "Try free for 7 days"
}

model subscriptions {
  // ... existing fields

  isTrialing       Boolean @default(false)
  trialStartDate   DateTime?
  trialEndDate     DateTime?
  convertedFromTrial Boolean @default(false)
}
```

#### Stripe Integration
```typescript
// When fan subscribes with trial enabled
async function createSubscriptionWithTrial(
  fanId: string,
  tierId: string
) {
  const tier = await prisma.tiers.findUnique({ where: { id: tierId } });
  const fan = await prisma.users.findUnique({ where: { id: fanId } });

  // Create Stripe subscription with trial
  const subscription = await stripe.subscriptions.create({
    customer: fan.stripeCustomerId,
    items: [{
      price: tier.stripePriceId,
    }],
    trial_period_days: tier.allowFreeTrial ? tier.trialDays : undefined,
    payment_behavior: 'default_incomplete',
    metadata: {
      tierId: tier.id,
      fanId: fan.id,
      artistId: tier.artistId,
    }
  });

  // Save to database
  await prisma.subscriptions.create({
    data: {
      id: subscription.id,
      fanId,
      artistId: tier.artistId,
      tierId,
      status: 'TRIALING',
      isTrialing: true,
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + tier.trialDays * 24 * 60 * 60 * 1000),
      stripeSubscriptionId: subscription.id,
    }
  });

  return subscription;
}
```

#### Trial End Handling
```typescript
// Cron job or webhook handler
async function handleTrialEnding(subscriptionId: string) {
  const subscription = await prisma.subscriptions.findUnique({
    where: { id: subscriptionId },
    include: { tier: true, fan: true }
  });

  // Send email 2 days before trial ends
  if (daysUntilTrialEnd === 2) {
    await sendEmail({
      to: subscription.fan.email,
      template: 'trial-ending-soon',
      data: {
        artistName: subscription.artist.name,
        tierName: subscription.tier.name,
        price: subscription.tier.minimumPrice,
        trialEndDate: subscription.trialEndDate,
        cancelLink: `${APP_URL}/subscriptions/${subscriptionId}/cancel`
      }
    });
  }
}

// Stripe webhook: trial_will_end event
async function handleTrialConverted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  await prisma.subscriptions.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      isTrialing: false,
      trialEndDate: new Date(),
      convertedFromTrial: true,
      status: 'ACTIVE'
    }
  });

  // Send welcome email
  await sendEmail({
    template: 'trial-converted',
    // ... data
  });
}
```

#### UI Updates
```jsx
// Tier card for fans
<TierCard>
  <TierName>Super Fan - $10/month</TierName>

  {tier.allowFreeTrial && (
    <TrialBadge>
      🎁 Try free for {tier.trialDays} days
    </TrialBadge>
  )}

  <SubscribeButton>
    {tier.allowFreeTrial ? 'Start Free Trial' : 'Subscribe Now'}
  </SubscribeButton>

  {tier.allowFreeTrial && (
    <FinePrint>
      Free for {tier.trialDays} days, then ${tier.minimumPrice}/month.
      Cancel anytime.
    </FinePrint>
  )}
</TierCard>

// Tier settings for artists
<TierSettings>
  <Toggle
    label="Offer Free Trial"
    checked={tier.allowFreeTrial}
    onChange={handleToggleTrial}
  />

  {tier.allowFreeTrial && (
    <Input
      label="Trial Duration (days)"
      type="number"
      value={tier.trialDays}
      onChange={handleTrialDaysChange}
      min={1}
      max={30}
    />
  )}

  <InfoBox>
    Free trials convert at ~40% and increase total revenue by
    attracting hesitant fans.
  </InfoBox>
</TierSettings>
```

---

## Feature #4: Content Scheduler

### **Priority**: 🟡 HIGH
### **Impact**: ↑ Posting consistency by 70%, ↑ Engagement by 30%
### **Complexity**: 🟡 Medium
### **Timeline**: 1-2 weeks

---

### User Story
```
As an artist,
I want to schedule posts in advance,
So I can maintain consistent posting without being online 24/7.
```

### Acceptance Criteria
- [x] Schedule posts for future date/time
- [x] Calendar view of scheduled posts
- [x] Bulk upload with scheduling
- [x] Edit/delete scheduled posts
- [x] Optimal time suggestions
- [x] Auto-publish at scheduled time
- [x] Timezone support

### Technical Specification

#### Database Schema
```prisma
model content {
  // ... existing fields

  publishedAt      DateTime? // NULL if not published yet
  scheduledFor     DateTime? // Future publish time
  isScheduled      Boolean   @default(false)
  publishStatus    String    @default("DRAFT") // DRAFT, SCHEDULED, PUBLISHED
  autoPublish      Boolean   @default(true)

  @@index([scheduledFor, isScheduled])
}

model ScheduledPublish {
  id          String   @id @default(cuid())
  contentId   String   @unique
  content     content  @relation(fields: [contentId], references: [id])
  scheduledFor DateTime
  timezone    String   @default("UTC")
  published   Boolean  @default(false)
  failedAt    DateTime?
  error       String?
  retryCount  Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([scheduledFor, published])
}
```

#### Publishing Cron Job
```typescript
// runs every 5 minutes
import { CronJob } from 'cron';

const publishScheduledContent = new CronJob(
  '*/5 * * * *', // Every 5 minutes
  async () => {
    const now = new Date();

    // Find content scheduled to publish now
    const scheduled = await prisma.scheduledPublish.findMany({
      where: {
        scheduledFor: {
          lte: now
        },
        published: false
      },
      include: {
        content: true
      }
    });

    for (const item of scheduled) {
      try {
        // Update content status
        await prisma.content.update({
          where: { id: item.contentId },
          data: {
            publishedAt: now,
            publishStatus: 'PUBLISHED',
            isScheduled: false
          }
        });

        // Mark as published
        await prisma.scheduledPublish.update({
          where: { id: item.id },
          data: { published: true }
        });

        // Send notifications to subscribers
        await notifySubscribers(item.content);

        logger.info('Published scheduled content', {
          contentId: item.contentId,
          scheduledFor: item.scheduledFor
        });
      } catch (error) {
        await prisma.scheduledPublish.update({
          where: { id: item.id },
          data: {
            failedAt: now,
            error: error.message,
            retryCount: { increment: 1 }
          }
        });

        logger.error('Failed to publish scheduled content', {
          contentId: item.contentId,
          error
        });
      }
    }
  },
  null,
  true,
  'America/Los_Angeles'
);
```

#### API Routes
```typescript
// POST /api/artist/content/schedule
export async function POST(req: Request) {
  const { contentId, scheduledFor, timezone } = await req.json();

  // Validate future date
  if (new Date(scheduledFor) <= new Date()) {
    return json({ error: 'Schedule time must be in the future' }, 400);
  }

  await prisma.content.update({
    where: { id: contentId },
    data: {
      scheduledFor: new Date(scheduledFor),
      isScheduled: true,
      publishStatus: 'SCHEDULED'
    }
  });

  await prisma.scheduledPublish.create({
    data: {
      contentId,
      scheduledFor: new Date(scheduledFor),
      timezone
    }
  });

  return json({ success: true });
}

// GET /api/artist/content/calendar
// Returns scheduled content for calendar view
export async function GET(req: Request) {
  const { month, year } = req.query;

  const scheduled = await prisma.content.findMany({
    where: {
      artistId: session.user.id,
      isScheduled: true,
      scheduledFor: {
        gte: new Date(year, month, 1),
        lt: new Date(year, month + 1, 1)
      }
    },
    orderBy: { scheduledFor: 'asc' }
  });

  return json({ content: scheduled });
}

// GET /api/artist/content/optimal-times
// AI-powered suggestions based on fan engagement
export async function GET(req: Request) {
  // Analyze when fans are most active
  const engagement = await analyzeEngagementTimes(session.user.id);

  return json({
    optimalTimes: [
      { day: 'Monday', time: '18:00', engagement: 'High' },
      { day: 'Wednesday', time: '20:00', engagement: 'Very High' },
      { day: 'Friday', time: '19:00', engagement: 'High' },
    ]
  });
}
```

#### UI Components
```jsx
// Calendar View
<ContentCalendar>
  <MonthNavigation>
    <PrevMonth />
    <CurrentMonth>October 2024</CurrentMonth>
    <NextMonth />
  </MonthNavigation>

  <Calendar>
    <Day date="2024-10-24">
      <ScheduledPost time="18:00">
        🎵 New Track: "Summer Nights"
      </ScheduledPost>
    </Day>

    <Day date="2024-10-27">
      <ScheduledPost time="20:00">
        📹 Behind-the-scenes video
      </ScheduledPost>
      <ScheduledPost time="21:00">
        📸 Photo gallery
      </ScheduledPost>
    </Day>
  </Calendar>

  <QuickActions>
    <Button>Upload & Schedule</Button>
    <Button>View List</Button>
  </QuickActions>
</ContentCalendar>

// Schedule Modal
<ScheduleModal>
  <DateTimePicker
    value={scheduledDate}
    onChange={setScheduledDate}
    minDate={new Date()}
  />

  <OptimalTimesSuggestion>
    🎯 Suggested times for best engagement:
    <SuggestionChip onClick={() => setScheduledDate('Mon 6pm')}>
      Monday 6pm
    </SuggestionChip>
    <SuggestionChip onClick={() => setScheduledDate('Wed 8pm')}>
      Wednesday 8pm ⭐ Best
    </SuggestionChip>
  </OptimalTimesSuggestion>

  <TimezoneSelect>
    <Select value={timezone} onChange={setTimezone}>
      <Option>America/Los_Angeles (PST)</Option>
      <Option>America/New_York (EST)</Option>
      <Option>Europe/London (GMT)</Option>
    </Select>
  </TimezoneSelect>

  <ScheduleButton>Schedule Post</ScheduleButton>
</ScheduleModal>
```

---

## Feature #5: Personalized Discovery Feed

### **Priority**: 🟡 HIGH
### **Impact**: ↑ Artist discovery by 200%, ↑ Subscriptions by 35%
### **Complexity**: 🔴 High
### **Timeline**: 2-3 weeks

---

### User Story
```
As a fan,
I want to discover artists I'll love,
Without having to search manually.
```

### Acceptance Criteria
- [x] "Recommended for You" section
- [x] "Trending Now" section
- [x] "New & Noteworthy" section
- [x] "Similar Artists" recommendations
- [x] Genre/category browsing
- [x] Machine learning-based recommendations
- [x] Personalization improves over time

### Technical Specification

#### Database Schema
```prisma
model UserInteraction {
  id          String   @id @default(cuid())
  userId      String
  user        users    @relation(fields: [userId], references: [id])

  interactionType String // VIEW, LIKE, SUBSCRIBE, COMMENT, SHARE
  targetType      String // CONTENT, ARTIST, STREAM
  targetId        String

  duration    Int?     // For views (seconds)
  metadata    Json?    // Additional context

  createdAt   DateTime @default(now())

  @@index([userId, interactionType])
  @@index([targetType, targetId])
  @@index([createdAt])
}

model ArtistSimilarity {
  id              String @id @default(cuid())
  artistId        String
  artist          users  @relation("ArtistSimilarityFrom", fields: [artistId], references: [id])
  similarArtistId String
  similarArtist   users  @relation("ArtistSimilarityTo", fields: [similarArtistId], references: [id])

  similarityScore Float  // 0.0 to 1.0
  sharedTags      String[] // Common tags
  sharedGenre     String?

  calculatedAt    DateTime @default(now())

  @@unique([artistId, similarArtistId])
  @@index([artistId, similarityScore])
}
```

#### Recommendation Algorithm
```typescript
class RecommendationEngine {
  async getPersonalizedFeed(userId: string): Promise<Artist[]> {
    // 1. Get user's interaction history
    const interactions = await this.getUserInteractions(userId);

    // 2. Build user profile
    const profile = this.buildUserProfile(interactions);
    // { genres: ['electronic', 'indie'], tags: ['chill', 'upbeat'], priceRange: [5, 15] }

    // 3. Get candidate artists
    const candidates = await this.getCandidateArtists(profile);

    // 4. Score and rank
    const ranked = await this.rankArtists(candidates, profile, interactions);

    // 5. Apply diversity filter
    const diverse = this.diversifyResults(ranked);

    // 6. Return top N
    return diverse.slice(0, 20);
  }

  private async rankArtists(
    candidates: Artist[],
    profile: UserProfile,
    interactions: UserInteraction[]
  ): Promise<ScoredArtist[]> {
    return candidates.map(artist => {
      let score = 0;

      // Genre match (30% weight)
      const genreScore = this.calculateGenreMatch(artist, profile);
      score += genreScore * 0.3;

      // Tag match (20% weight)
      const tagScore = this.calculateTagMatch(artist, profile);
      score += tagScore * 0.2;

      // Popularity (15% weight)
      const popularityScore = this.calculatePopularity(artist);
      score += popularityScore * 0.15;

      // Activity (10% weight)
      const activityScore = this.calculateActivity(artist);
      score += activityScore * 0.1;

      // Price match (10% weight)
      const priceScore = this.calculatePriceMatch(artist, profile);
      score += priceScore * 0.1;

      // Collaborative filtering (15% weight)
      const cfScore = this.collaborativeFiltering(artist, interactions);
      score += cfScore * 0.15;

      return { artist, score };
    }).sort((a, b) => b.score - a.score);
  }

  private collaborativeFiltering(
    artist: Artist,
    userInteractions: UserInteraction[]
  ): number {
    // Find users with similar tastes
    const similarUsers = this.findSimilarUsers(userInteractions);

    // Check if similar users like this artist
    const likedBySimilar = similarUsers.filter(u =>
      u.subscriptions.includes(artist.id)
    ).length;

    return likedBySimilar / similarUsers.length;
  }
}
```

#### API Routes
```typescript
// GET /api/discovery/recommended
export async function GET(req: Request) {
  const session = await getServerSession();
  const recommender = new RecommendationEngine();

  const recommended = await recommender.getPersonalizedFeed(session.user.id);

  return json({
    section: 'Recommended for You',
    artists: recommended
  });
}

// GET /api/discovery/trending
export async function GET(req: Request) {
  // Artists with fastest growth in last 7 days
  const trending = await prisma.artists.findMany({
    orderBy: {
      subscriptions: {
        _count: 'desc'
      }
    },
    where: {
      subscriptions: {
        some: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }
    },
    take: 20
  });

  return json({ artists: trending });
}

// GET /api/discovery/similar/{artistId}
export async function GET(req: Request) {
  const { artistId } = req.params;

  const similar = await prisma.artistSimilarity.findMany({
    where: { artistId },
    orderBy: { similarityScore: 'desc' },
    take: 10,
    include: { similarArtist: true }
  });

  return json({
    artists: similar.map(s => s.similarArtist)
  });
}

// POST /api/analytics/track-interaction
// Track user interactions for ML
export async function POST(req: Request) {
  const { type, targetId, duration, metadata } = await req.json();

  await prisma.userInteraction.create({
    data: {
      userId: session.user.id,
      interactionType: type,
      targetType: 'ARTIST',
      targetId,
      duration,
      metadata
    }
  });

  return json({ success: true });
}
```

#### UI Components
```jsx
// Discovery Page
<DiscoveryPage>
  <HeroSection>
    <FeaturedArtist />
  </HeroSection>

  <Section>
    <SectionTitle>Recommended for You</SectionTitle>
    <ArtistCarousel>
      {recommendedArtists.map(artist => (
        <ArtistCard
          key={artist.id}
          artist={artist}
          reason="Based on your interest in indie music"
        />
      ))}
    </ArtistCarousel>
  </Section>

  <Section>
    <SectionTitle>🔥 Trending Now</SectionTitle>
    <ArtistGrid>
      {trendingArtists.map(artist => (
        <TrendingArtistCard
          artist={artist}
          trendingRank={artist.rank}
          growthPercent={artist.growth}
        />
      ))}
    </ArtistGrid>
  </Section>

  <Section>
    <SectionTitle>Browse by Genre</SectionTitle>
    <GenreGrid>
      <GenreCard genre="Electronic" count={245} />
      <GenreCard genre="Indie" count={189} />
      <GenreCard genre="Hip-Hop" count={312} />
      {/* ... */}
    </GenreGrid>
  </Section>

  <Section>
    <SectionTitle>New & Noteworthy</SectionTitle>
    <ArtistList>
      {newArtists.map(artist => (
        <NewArtistCard
          artist={artist}
          joinedDaysAgo={artist.joinedDaysAgo}
        />
      ))}
    </ArtistList>
  </Section>
</DiscoveryPage>

// Similar Artists Widget (on artist page)
<SimilarArtistsWidget>
  <Title>If you like {currentArtist.name}, try:</Title>
  <SimilarArtistList>
    {similarArtists.map(artist => (
      <SimilarArtistItem
        artist={artist}
        matchScore={artist.similarityScore}
      />
    ))}
  </SimilarArtistList>
</SimilarArtistsWidget>
```

---

## Implementation Checklist

### Week 1-2: Foundation
- [ ] Implement Artist Setup Wizard
  - [ ] Database schema
  - [ ] API routes
  - [ ] UI components
  - [ ] Progress tracking
- [ ] Implement Stripe Onboarding Flow
  - [ ] Modal trigger logic
  - [ ] Stripe Connect integration
  - [ ] Success/error handling
  - [ ] Dashboard indicators

### Week 3-4: Conversion
- [ ] Implement Free Trial System
  - [ ] Database schema
  - [ ] Stripe trial periods
  - [ ] Trial end emails
  - [ ] Conversion tracking
- [ ] Implement Content Scheduler (Phase 1)
  - [ ] Database schema
  - [ ] Scheduling API
  - [ ] Cron job for publishing
  - [ ] Basic calendar view

### Week 5-6: Growth
- [ ] Implement Content Scheduler (Phase 2)
  - [ ] Optimal time suggestions
  - [ ] Bulk scheduling
  - [ ] Timezone support
- [ ] Implement Discovery Feed (Phase 1)
  - [ ] Database schema
  - [ ] Trending algorithm
  - [ ] Basic recommendations
  - [ ] Category browsing

### Week 7-8: Intelligence
- [ ] Implement Discovery Feed (Phase 2)
  - [ ] ML recommendation engine
  - [ ] Similar artists calculation
  - [ ] Personalization tuning
  - [ ] A/B testing framework

---

## Success Metrics

### Artist Activation (Setup Wizard + Stripe)
- **Target**: 75% of artists complete all 5 steps within 7 days
- **Measure**: Completion rate, time to completion
- **Success**: 60% improvement over baseline

### Subscription Conversion (Free Trials)
- **Target**: 40% of trial users convert to paid
- **Measure**: Trial → Paid conversion rate
- **Success**: 2-3x improvement in overall subscription rate

### Content Consistency (Scheduler)
- **Target**: 3+ posts per week (up from 1.2)
- **Measure**: Average posts per artist per week
- **Success**: 2x increase in posting frequency

### Discovery Engagement (Personalized Feed)
- **Target**: 35% of new subscriptions from discovery page
- **Measure**: Subscription source attribution
- **Success**: 200% increase in artist discovery rate

---

## Next Steps

1. **Review & Approve**: Stakeholder sign-off on specs
2. **Design Sprints**: Create high-fidelity mockups
3. **Sprint Planning**: Break into 2-week sprints
4. **Development**: Implement features in order
5. **Testing**: QA each feature before release
6. **Deployment**: Gradual rollout with monitoring
7. **Iteration**: Collect feedback, optimize

**Timeline**: 8 weeks for all 5 critical features
**Resource Requirements**: 2-3 full-stack developers, 1 designer, 1 PM

---

*Specification Version: 1.0*
*Created: 2025-10-24*
*Status: Ready for Implementation*
