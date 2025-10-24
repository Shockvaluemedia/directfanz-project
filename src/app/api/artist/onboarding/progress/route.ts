import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Setup Wizard Configuration
 * Defines the steps for artist onboarding
 */
const SETUP_STEPS = [
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Add profile photo, banner, and bio',
    action: 'Go to Profile',
    link: '/dashboard/artist/profile',
    weight: 20,
    field: 'profileComplete',
  },
  {
    id: 'stripe',
    title: 'Connect Stripe Account',
    description: 'Required to receive payouts',
    action: 'Connect Stripe',
    link: '/api/artist/stripe/onboard',
    weight: 30,
    required: true,
    field: 'stripeConnected',
  },
  {
    id: 'tier',
    title: 'Create Your First Tier',
    description: 'Set pricing for your exclusive content',
    action: 'Create Tier',
    link: '/dashboard/artist/tiers',
    weight: 25,
    field: 'firstTierCreated',
    templates: [
      { name: 'Supporter', price: 5, description: 'Basic exclusive content' },
      { name: 'Super Fan', price: 10, description: 'All content + early access' },
      { name: 'VIP', price: 25, description: 'Everything + personal perks' },
    ],
  },
  {
    id: 'content',
    title: 'Upload Your First Content',
    description: 'Share something exclusive with fans',
    action: 'Upload Content',
    link: '/dashboard/artist/content/upload',
    weight: 15,
    field: 'firstContentUploaded',
    suggestions: [
      'Welcome video introducing yourself',
      'Exclusive track or preview',
      'Behind-the-scenes photo/video',
      'Personal message to first fans',
    ],
  },
  {
    id: 'share',
    title: 'Share Your Profile',
    description: 'Invite fans from your social media',
    action: 'Get Share Link',
    link: '/dashboard/artist/share',
    weight: 10,
    field: 'profileShared',
  },
] as const;

/**
 * GET /api/artist/onboarding/progress
 * Returns current onboarding status and next steps
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Only artists can access onboarding' }, { status: 403 });
    }

    // Get or create onboarding progress
    let progress = await prisma.onboarding_progress.findUnique({
      where: { userId: session.user.id },
    });

    if (!progress) {
      // Create initial progress record
      progress = await prisma.onboarding_progress.create({
        data: {
          userId: session.user.id,
          completionPercentage: 0,
        },
      });
    }

    // Calculate current status for each step
    const status = await calculateOnboardingStatus(session.user.id);

    // Update progress if changed
    const newPercentage = calculateCompletionPercentage(status);
    if (newPercentage !== progress.completionPercentage) {
      progress = await prisma.onboarding_progress.update({
        where: { userId: session.user.id },
        data: {
          ...status,
          completionPercentage: newPercentage,
          completedAt: newPercentage === 100 ? new Date() : null,
        },
      });
    }

    // Build steps with status
    const stepsWithStatus = SETUP_STEPS.map(step => ({
      ...step,
      completed: status[step.field],
      isActive: !status[step.field],
    }));

    // Find next incomplete step
    const nextStep = stepsWithStatus.find(s => !s.completed);

    return NextResponse.json({
      success: true,
      data: {
        progress,
        steps: stepsWithStatus,
        nextStep,
        isComplete: progress.completionPercentage === 100,
        isDismissed: !!progress.dismissedAt,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get onboarding progress', { error });
    return NextResponse.json(
      { error: 'Failed to get onboarding progress' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/artist/onboarding/progress
 * Updates onboarding progress for a specific step
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { step, completed } = body;

    if (!step || typeof completed !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const stepConfig = SETUP_STEPS.find(s => s.id === step);
    if (!stepConfig) {
      return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
    }

    // Update progress
    const status = await calculateOnboardingStatus(session.user.id);
    status[stepConfig.field] = completed;

    const completionPercentage = calculateCompletionPercentage(status);

    const progress = await prisma.onboarding_progress.upsert({
      where: { userId: session.user.id },
      update: {
        ...status,
        completionPercentage,
        currentStep: completed ? null : step,
        completedAt: completionPercentage === 100 ? new Date() : null,
      },
      create: {
        userId: session.user.id,
        ...status,
        completionPercentage,
        currentStep: step,
      },
    });

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    logger.error('Failed to update onboarding progress', { error });
    return NextResponse.json(
      { error: 'Failed to update onboarding progress' },
      { status: 500 }
    );
  }
}

/**
 * Calculate current onboarding status by checking database
 */
async function calculateOnboardingStatus(userId: string) {
  // Check profile completion
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: { artists: true },
  });

  const profileComplete = !!(
    user?.avatar &&
    user?.bio &&
    user?.artists?.[0]?.isStripeOnboarded !== undefined
  );

  // Check Stripe connection
  const stripeConnected = !!(user?.artists?.[0]?.stripeAccountId);

  // Check first tier created
  const tierCount = await prisma.tiers.count({
    where: { artistId: userId },
  });
  const firstTierCreated = tierCount > 0;

  // Check first content uploaded
  const contentCount = await prisma.content.count({
    where: { artistId: userId },
  });
  const firstContentUploaded = contentCount > 0;

  // Check if profile shared (this would be tracked elsewhere)
  const progress = await prisma.onboarding_progress.findUnique({
    where: { userId },
  });
  const profileShared = progress?.profileShared || false;

  return {
    profileComplete,
    stripeConnected,
    firstTierCreated,
    firstContentUploaded,
    profileShared,
  };
}

/**
 * Calculate completion percentage based on step weights
 */
function calculateCompletionPercentage(status: {
  profileComplete: boolean;
  stripeConnected: boolean;
  firstTierCreated: boolean;
  firstContentUploaded: boolean;
  profileShared: boolean;
}): number {
  let totalWeight = 0;
  let completedWeight = 0;

  for (const step of SETUP_STEPS) {
    totalWeight += step.weight;
    if (status[step.field]) {
      completedWeight += step.weight;
    }
  }

  return Math.round((completedWeight / totalWeight) * 100);
}
