import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Analytics tracking utilities for measuring Tier 1 feature success
 */

export interface FeatureMetrics {
  onboarding: OnboardingMetrics;
  trials: TrialMetrics;
  scheduling: SchedulingMetrics;
  discovery: DiscoveryMetrics;
}

export interface OnboardingMetrics {
  completionRate: number;
  avgTimeToComplete: number;
  dropOffByStep: Record<string, number>;
  completionsLastWeek: number;
}

export interface TrialMetrics {
  startRate: number; // % of new subscriptions that start with trial
  conversionRate: number; // % of trials that convert to paid
  avgTrialLength: number;
  cancellationRate: number;
}

export interface SchedulingMetrics {
  adoptionRate: number; // % of artists using scheduling
  avgScheduleAhead: number; // Hours scheduled in advance
  publishSuccessRate: number;
  optimalTimeUsage: number; // % using suggested times
}

export interface DiscoveryMetrics {
  recommendationCTR: number;
  trendingEngagement: number;
  similarityAccuracy: number;
  newArtistDiscoveryRate: number;
}

/**
 * Get comprehensive analytics for a date range
 */
export async function getFeatureMetrics(
  startDate: Date,
  endDate: Date
): Promise<FeatureMetrics> {
  const [onboarding, trials, scheduling, discovery] = await Promise.all([
    getOnboardingMetrics(startDate, endDate),
    getTrialMetrics(startDate, endDate),
    getSchedulingMetrics(startDate, endDate),
    getDiscoveryMetrics(startDate, endDate),
  ]);

  return {
    onboarding,
    trials,
    scheduling,
    discovery,
  };
}

/**
 * Calculate onboarding metrics
 */
async function getOnboardingMetrics(
  startDate: Date,
  endDate: Date
): Promise<OnboardingMetrics> {
  // Get all artists who started onboarding in period
  const startedOnboarding = await prisma.onboarding_progress.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      completionPercentage: true,
      completedAt: true,
      createdAt: true,
      profileComplete: true,
      stripeConnected: true,
      firstTierCreated: true,
      firstContentUploaded: true,
      profileShared: true,
    },
  });

  const totalStarted = startedOnboarding.length;
  const completed = startedOnboarding.filter((p) => p.completionPercentage === 100);

  // Calculate completion rate
  const completionRate =
    totalStarted > 0 ? (completed.length / totalStarted) * 100 : 0;

  // Calculate average time to complete
  const completionTimes = completed
    .filter((p) => p.completedAt)
    .map(
      (p) =>
        (new Date(p.completedAt!).getTime() - new Date(p.createdAt).getTime()) /
        (1000 * 60 * 60)
    );

  const avgTimeToComplete =
    completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

  // Calculate drop-off by step
  const dropOffByStep = {
    profile: (startedOnboarding.filter((p) => !p.profileComplete).length / totalStarted) * 100,
    stripe: (startedOnboarding.filter((p) => !p.stripeConnected).length / totalStarted) * 100,
    tier: (startedOnboarding.filter((p) => !p.firstTierCreated).length / totalStarted) * 100,
    content: (startedOnboarding.filter((p) => !p.firstContentUploaded).length / totalStarted) * 100,
    share: (startedOnboarding.filter((p) => !p.profileShared).length / totalStarted) * 100,
  };

  // Completions in last 7 days
  const weekAgo = new Date(endDate);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const completionsLastWeek = await prisma.onboarding_progress.count({
    where: {
      completedAt: {
        gte: weekAgo,
        lte: endDate,
      },
    },
  });

  return {
    completionRate,
    avgTimeToComplete,
    dropOffByStep,
    completionsLastWeek,
  };
}

/**
 * Calculate trial metrics
 */
async function getTrialMetrics(
  startDate: Date,
  endDate: Date
): Promise<TrialMetrics> {
  // All subscriptions created in period
  const allSubscriptions = await prisma.subscriptions.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      isTrialing: true,
      trialStartDate: true,
      trialEndDate: true,
      convertedFromTrial: true,
      canceledAt: true,
      status: true,
    },
  });

  const totalSubscriptions = allSubscriptions.length;
  const trialsStarted = allSubscriptions.filter((s) => s.isTrialing || s.convertedFromTrial);

  // Start rate
  const startRate =
    totalSubscriptions > 0 ? (trialsStarted.length / totalSubscriptions) * 100 : 0;

  // Conversion rate (of completed trials)
  const completedTrials = trialsStarted.filter(
    (s) => !s.isTrialing || s.trialEndDate! < new Date()
  );
  const converted = trialsStarted.filter((s) => s.convertedFromTrial);
  const conversionRate =
    completedTrials.length > 0 ? (converted.length / completedTrials.length) * 100 : 0;

  // Average trial length
  const trialLengths = trialsStarted
    .filter((s) => s.trialStartDate && s.trialEndDate)
    .map(
      (s) =>
        (new Date(s.trialEndDate!).getTime() - new Date(s.trialStartDate!).getTime()) /
        (1000 * 60 * 60 * 24)
    );

  const avgTrialLength =
    trialLengths.length > 0
      ? trialLengths.reduce((a, b) => a + b, 0) / trialLengths.length
      : 0;

  // Cancellation rate during trial
  const canceled = trialsStarted.filter((s) => s.canceledAt && s.isTrialing);
  const cancellationRate =
    trialsStarted.length > 0 ? (canceled.length / trialsStarted.length) * 100 : 0;

  return {
    startRate,
    conversionRate,
    avgTrialLength,
    cancellationRate,
  };
}

/**
 * Calculate scheduling metrics
 */
async function getSchedulingMetrics(
  startDate: Date,
  endDate: Date
): Promise<SchedulingMetrics> {
  // Total artists in period
  const totalArtists = await prisma.users.count({
    where: {
      role: 'ARTIST',
      createdAt: { lte: endDate },
    },
  });

  // Artists who used scheduling
  const artistsUsingScheduling = await prisma.scheduled_publish.groupBy({
    by: ['contentId'],
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const adoptionRate =
    totalArtists > 0 ? (artistsUsingScheduling.length / totalArtists) * 100 : 0;

  // Get all scheduled items in period
  const scheduledItems = await prisma.scheduled_publish.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      createdAt: true,
      scheduledFor: true,
      published: true,
      failedAt: true,
    },
  });

  // Average schedule ahead time
  const scheduleAheadTimes = scheduledItems.map(
    (item) =>
      (new Date(item.scheduledFor).getTime() - new Date(item.createdAt).getTime()) /
      (1000 * 60 * 60)
  );

  const avgScheduleAhead =
    scheduleAheadTimes.length > 0
      ? scheduleAheadTimes.reduce((a, b) => a + b, 0) / scheduleAheadTimes.length
      : 0;

  // Publish success rate
  const totalPublishAttempts = scheduledItems.filter(
    (item) => item.published || item.failedAt
  ).length;
  const successful = scheduledItems.filter((item) => item.published).length;
  const publishSuccessRate =
    totalPublishAttempts > 0 ? (successful / totalPublishAttempts) * 100 : 0;

  // TODO: Optimal time usage (requires tracking if suggested time was used)
  const optimalTimeUsage = 0;

  return {
    adoptionRate,
    avgScheduleAhead,
    publishSuccessRate,
    optimalTimeUsage,
  };
}

/**
 * Calculate discovery metrics
 */
async function getDiscoveryMetrics(
  startDate: Date,
  endDate: Date
): Promise<DiscoveryMetrics> {
  // Get all artist views in period
  const artistViews = await prisma.user_interactions.findMany({
    where: {
      interactionType: 'VIEW',
      targetType: 'ARTIST',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      userId: true,
      targetId: true,
      createdAt: true,
    },
  });

  // Get subscriptions that happened after views
  const subscriptions = await prisma.user_interactions.findMany({
    where: {
      interactionType: 'SUBSCRIBE',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      userId: true,
      targetId: true,
      createdAt: true,
    },
  });

  // Calculate CTR (views that led to subscription within 24 hours)
  let clicks = 0;
  artistViews.forEach((view) => {
    const subscription = subscriptions.find(
      (sub) =>
        sub.userId === view.userId &&
        sub.targetId === view.targetId &&
        new Date(sub.createdAt).getTime() - new Date(view.createdAt).getTime() <
          24 * 60 * 60 * 1000
    );
    if (subscription) clicks++;
  });

  const recommendationCTR = artistViews.length > 0 ? (clicks / artistViews.length) * 100 : 0;

  // Trending engagement (placeholder - would need more detailed tracking)
  const trendingEngagement = 0;

  // Similarity accuracy (placeholder - would need user feedback)
  const similarityAccuracy = 0;

  // New artist discovery rate
  const newArtists = await prisma.users.count({
    where: {
      role: 'ARTIST',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const newArtistViews = artistViews.filter((view) => {
    // Would need to check if artist was new
    return false; // Placeholder
  });

  const newArtistDiscoveryRate =
    newArtists > 0 ? (newArtistViews.length / newArtists) * 100 : 0;

  return {
    recommendationCTR,
    trendingEngagement,
    similarityAccuracy,
    newArtistDiscoveryRate,
  };
}

/**
 * Track a feature usage event
 */
export async function trackFeatureEvent(params: {
  feature: 'onboarding' | 'trial' | 'scheduling' | 'discovery';
  action: string;
  userId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    logger.info('Feature event tracked', {
      feature: params.feature,
      action: params.action,
      userId: params.userId,
      metadata: params.metadata,
    });

    // In production, send to analytics service (Mixpanel, Amplitude, etc.)
  } catch (error: any) {
    logger.error('Failed to track feature event', { params, error });
  }
}

/**
 * Export metrics to CSV format
 */
export function metricsToCSV(metrics: FeatureMetrics): string {
  const rows = [
    ['Category', 'Metric', 'Value'],
    ['Onboarding', 'Completion Rate', `${metrics.onboarding.completionRate.toFixed(2)}%`],
    ['Onboarding', 'Avg Time to Complete', `${metrics.onboarding.avgTimeToComplete.toFixed(1)}h`],
    ['Onboarding', 'Completions Last Week', metrics.onboarding.completionsLastWeek.toString()],
    ['Trials', 'Start Rate', `${metrics.trials.startRate.toFixed(2)}%`],
    ['Trials', 'Conversion Rate', `${metrics.trials.conversionRate.toFixed(2)}%`],
    ['Trials', 'Avg Trial Length', `${metrics.trials.avgTrialLength.toFixed(1)} days`],
    ['Trials', 'Cancellation Rate', `${metrics.trials.cancellationRate.toFixed(2)}%`],
    ['Scheduling', 'Adoption Rate', `${metrics.scheduling.adoptionRate.toFixed(2)}%`],
    ['Scheduling', 'Avg Schedule Ahead', `${metrics.scheduling.avgScheduleAhead.toFixed(1)}h`],
    ['Scheduling', 'Publish Success Rate', `${metrics.scheduling.publishSuccessRate.toFixed(2)}%`],
    ['Discovery', 'Recommendation CTR', `${metrics.discovery.recommendationCTR.toFixed(2)}%`],
  ];

  return rows.map((row) => row.join(',')).join('\n');
}
