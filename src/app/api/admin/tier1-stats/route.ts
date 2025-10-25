import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/tier1-stats
 * Returns comprehensive statistics for Tier 1 features
 * Admin only
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate all stats in parallel for performance
    const [
      onboardingStats,
      trialStats,
      schedulingStats,
      discoveryStats,
      healthStats,
    ] = await Promise.all([
      getOnboardingStats(),
      getTrialStats(),
      getSchedulingStats(),
      getDiscoveryStats(),
      getHealthStats(),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        onboarding: onboardingStats,
        trials: trialStats,
        scheduling: schedulingStats,
        discovery: discoveryStats,
        health: healthStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to get Tier 1 stats', { error });
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}

/**
 * Get artist onboarding statistics
 */
async function getOnboardingStats() {
  const totalArtists = await prisma.users.count({
    where: { role: 'ARTIST' },
  });

  const completedOnboarding = await prisma.onboarding_progress.count({
    where: {
      completionPercentage: 100,
      completedAt: { not: null },
    },
  });

  // Get average completion time
  const completedRecords = await prisma.onboarding_progress.findMany({
    where: {
      completionPercentage: 100,
      completedAt: { not: null },
    },
    select: {
      createdAt: true,
      completedAt: true,
    },
  });

  const avgCompletionTime =
    completedRecords.length > 0
      ? completedRecords.reduce((sum, record) => {
          const hours =
            (new Date(record.completedAt!).getTime() -
              new Date(record.createdAt).getTime()) /
            (1000 * 60 * 60);
          return sum + hours;
        }, 0) / completedRecords.length
      : 0;

  return {
    totalArtists,
    completedOnboarding,
    avgCompletionTime,
    completionRate:
      totalArtists > 0 ? (completedOnboarding / totalArtists) * 100 : 0,
  };
}

/**
 * Get free trial statistics
 */
async function getTrialStats() {
  const activeTrials = await prisma.subscriptions.count({
    where: {
      isTrialing: true,
      status: 'TRIALING',
    },
  });

  const totalConverted = await prisma.subscriptions.count({
    where: {
      convertedFromTrial: true,
    },
  });

  const totalTrialsStarted = await prisma.subscriptions.count({
    where: {
      OR: [
        { isTrialing: true },
        { convertedFromTrial: true },
      ],
    },
  });

  // Get trials ending in next 3 days
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const endingSoon = await prisma.subscriptions.count({
    where: {
      isTrialing: true,
      trialEndDate: {
        gte: new Date(),
        lte: threeDaysFromNow,
      },
    },
  });

  return {
    activeTrials,
    totalConverted,
    conversionRate:
      totalTrialsStarted > 0 ? (totalConverted / totalTrialsStarted) * 100 : 0,
    endingSoon,
  };
}

/**
 * Get content scheduling statistics
 */
async function getSchedulingStats() {
  const scheduledContent = await prisma.scheduled_publish.count({
    where: {
      published: false,
      scheduledFor: {
        gte: new Date(),
      },
    },
  });

  // Get content published today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const publishedToday = await prisma.scheduled_publish.count({
    where: {
      published: true,
      updatedAt: {
        gte: startOfDay,
      },
    },
  });

  const failedPublishes = await prisma.scheduled_publish.count({
    where: {
      failedAt: { not: null },
      published: false,
    },
  });

  // Calculate average time between scheduling and publish
  const recentPublished = await prisma.scheduled_publish.findMany({
    where: {
      published: true,
      updatedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    select: {
      createdAt: true,
      scheduledFor: true,
    },
    take: 100,
  });

  const avgScheduleTime =
    recentPublished.length > 0
      ? recentPublished.reduce((sum, record) => {
          const hours =
            (new Date(record.scheduledFor).getTime() -
              new Date(record.createdAt).getTime()) /
            (1000 * 60 * 60);
          return sum + hours;
        }, 0) / recentPublished.length
      : 0;

  return {
    scheduledContent,
    publishedToday,
    failedPublishes,
    avgScheduleTime,
  };
}

/**
 * Get discovery feed statistics
 */
async function getDiscoveryStats() {
  // Count interactions today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const recommendationViews = await prisma.user_interactions.count({
    where: {
      interactionType: 'VIEW',
      targetType: 'ARTIST',
      createdAt: {
        gte: startOfDay,
      },
    },
  });

  // Calculate click-through rate (views that led to subscriptions)
  const totalViews = await prisma.user_interactions.count({
    where: {
      interactionType: 'VIEW',
      targetType: 'ARTIST',
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const subscriptionClicks = await prisma.user_interactions.count({
    where: {
      interactionType: 'SUBSCRIBE',
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const clickThroughRate =
    totalViews > 0 ? (subscriptionClicks / totalViews) * 100 : 0;

  // Count total artist similarities calculated
  const similaritiesCalculated = await prisma.artist_similarity.count();

  // Get last calculation time
  const lastCalculation = await prisma.artist_similarity.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });

  return {
    recommendationViews,
    clickThroughRate,
    similaritiesCalculated,
    lastCalculation: lastCalculation?.updatedAt || null,
  };
}

/**
 * Get system health statistics
 */
async function getHealthStats() {
  // Check if database is connected
  let databaseConnected = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    databaseConnected = false;
  }

  // Mock cron job status (in production, this would check actual process)
  const cronJobsRunning = databaseConnected; // Simplified for now

  // Mock webhook delivery rate (in production, track from Stripe Dashboard)
  const webhookDeliveryRate = 0.98; // 98% success rate

  // Mock API response time (in production, calculate from actual metrics)
  const apiResponseTime = 250; // 250ms average

  return {
    cronJobsRunning,
    databaseConnected,
    webhookDeliveryRate,
    apiResponseTime,
  };
}
