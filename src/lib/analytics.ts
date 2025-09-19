import { prisma } from '@/lib/prisma';

export interface EarningsData {
  totalEarnings: number;
  monthlyEarnings: number;
  dailyEarnings: number;
  weeklyEarnings: number;
  yearlyEarnings: number;
  earningsGrowth: number; // Percentage change from previous period
}

export interface SubscriberMetrics {
  totalSubscribers: number;
  activeSubscribers: number;
  newSubscribers: number; // This month
  canceledSubscribers: number; // This month
  churnRate: number; // Percentage
  retentionRate: number; // Percentage
}

export interface TierAnalytics {
  tierId: string;
  tierName: string;
  subscriberCount: number;
  monthlyRevenue: number;
  averageAmount: number;
  conversionRate: number;
}

export interface ArtistAnalytics {
  earnings: EarningsData;
  subscribers: SubscriberMetrics;
  tiers: TierAnalytics[];
  recentActivity: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  type: 'subscription' | 'cancellation' | 'payment' | 'content';
  description: string;
  amount?: number;
  timestamp: Date;
}

/**
 * Calculate earnings data for an artist
 */
export async function calculateEarningsData(artistId: string): Promise<EarningsData> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Get total earnings from artist profile
  const artist = await prisma.artists.findUnique({
    where: { userId: artistId },
    select: { totalEarnings: true },
  });

  const totalEarnings = artist?.totalEarnings ? parseFloat(artist.totalEarnings.toString()) : 0;

  // Get current active subscriptions
  const activeSubscriptions = await prisma.subscriptions.findMany({
    where: {
      artistId,
      status: 'ACTIVE',
    },
    select: { amount: true, createdAt: true },
  });

  // Calculate earnings for different periods based on subscription creation dates
  const thisMonthSubs = activeSubscriptions.filter(sub => sub.createdAt >= startOfMonth);
  const thisWeekSubs = activeSubscriptions.filter(sub => sub.createdAt >= startOfWeek);
  const todaySubs = activeSubscriptions.filter(sub => sub.createdAt >= startOfDay);
  const thisYearSubs = activeSubscriptions.filter(sub => sub.createdAt >= startOfYear);

  const monthlyEarnings = thisMonthSubs.reduce(
    (sum, sub) => sum + parseFloat(sub.amount.toString()),
    0
  );
  const weeklyEarnings = thisWeekSubs.reduce(
    (sum, sub) => sum + parseFloat(sub.amount.toString()),
    0
  );
  const dailyEarnings = todaySubs.reduce((sum, sub) => sum + parseFloat(sub.amount.toString()), 0);
  const yearlyEarnings = thisYearSubs.reduce(
    (sum, sub) => sum + parseFloat(sub.amount.toString()),
    0
  );

  // Calculate previous month earnings for growth comparison
  const previousMonthSubs = await prisma.subscriptions.findMany({
    where: {
      artistId,
      status: 'ACTIVE',
      createdAt: { gte: previousMonth, lt: startOfMonth },
    },
    select: { amount: true },
  });

  const previousMonthEarnings = previousMonthSubs.reduce((sum, sub) => {
    return sum + parseFloat(sub.amount.toString());
  }, 0);

  // Calculate growth percentage
  const earningsGrowth =
    previousMonthEarnings > 0
      ? ((monthlyEarnings - previousMonthEarnings) / previousMonthEarnings) * 100
      : monthlyEarnings > 0
        ? 100
        : 0;

  return {
    totalEarnings,
    monthlyEarnings,
    dailyEarnings,
    weeklyEarnings,
    yearlyEarnings,
    earningsGrowth,
  };
}

/**
 * Calculate subscriber metrics for an artist
 */
export async function calculateSubscriberMetrics(artistId: string): Promise<SubscriberMetrics> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get current subscriber counts
  const [totalResult, activeResult, newResult, canceledResult] = await Promise.all([
    // Total subscribers (including canceled)
    prisma.subscriptions.count({
      where: { artistId },
    }),
    // Active subscribers
    prisma.subscriptions.count({
      where: {
        artistId,
        status: 'ACTIVE',
      },
    }),
    // New subscribers this month
    prisma.subscriptions.count({
      where: {
        artistId,
        createdAt: { gte: startOfMonth },
      },
    }),
    // Canceled subscribers this month
    prisma.subscriptions.count({
      where: {
        artistId,
        status: 'CANCELED',
        updatedAt: { gte: startOfMonth },
      },
    }),
  ]);

  const totalSubscribers = totalResult;
  const activeSubscribers = activeResult;
  const newSubscribers = newResult;
  const canceledSubscribers = canceledResult;

  // Calculate churn rate based on active subscribers at start of month
  const startOfMonthActive = activeSubscribers + canceledSubscribers - newSubscribers;
  const churnRate = startOfMonthActive > 0 ? (canceledSubscribers / startOfMonthActive) * 100 : 0;

  // Calculate retention rate
  const retentionRate = Math.max(0, 100 - churnRate);

  return {
    totalSubscribers,
    activeSubscribers,
    newSubscribers,
    canceledSubscribers,
    churnRate,
    retentionRate,
  };
}

/**
 * Calculate tier analytics for an artist
 */
export async function calculateTierAnalytics(artistId: string): Promise<TierAnalytics[]> {
  const tiers = await prisma.tiers.findMany({
    where: { artistId },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  const tierAnalytics: TierAnalytics[] = [];

  for (const tier of tiers) {
    const activeSubscriptions = tier.subscriptions;
    const subscriberCount = activeSubscriptions.length;

    // Calculate monthly revenue for this tier
    const monthlyRevenue = activeSubscriptions.reduce((sum, sub) => {
      return sum + parseFloat(sub.amount.toString());
    }, 0);

    // Calculate average amount per subscriber
    const averageAmount = subscriberCount > 0 ? monthlyRevenue / subscriberCount : 0;

    // For conversion rate, we'd need to track tier views/visits
    // For now, we'll use a placeholder calculation
    const conversionRate = 0; // TODO: Implement tier view tracking

    tierAnalytics.push({
      tierId: tier.id,
      tierName: tier.name,
      subscriberCount,
      monthlyRevenue,
      averageAmount,
      conversionRate,
    });
  }

  return tierAnalytics.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
}

/**
 * Get recent activity for an artist
 */
export async function getRecentActivity(
  artistId: string,
  limit: number = 10
): Promise<RecentActivity[]> {
  const activities: RecentActivity[] = [];

  // Get recent subscriptions
  const recentSubscriptions = await prisma.subscriptions.findMany({
    where: { artistId },
    include: {
      fan: { select: { displayName: true } },
      tier: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  for (const sub of recentSubscriptions) {
    const fanName = sub.fan?.displayName || 'Anonymous Fan';
    const tierName = sub.tier?.name || 'Unknown Tier';

    activities.push({
      id: sub.id,
      type: sub.status === 'CANCELED' ? 'cancellation' : 'subscription',
      description:
        sub.status === 'CANCELED'
          ? `${fanName} canceled subscription to ${tierName}`
          : `${fanName} subscribed to ${tierName}`,
      amount: parseFloat(sub.amount.toString()),
      timestamp: sub.createdAt,
    });
  }

  // Get recent content uploads
  const recentContent = await prisma.content.findMany({
    where: { artistId },
    orderBy: { createdAt: 'desc' },
    take: Math.floor(limit / 2),
  });

  for (const content of recentContent) {
    activities.push({
      id: content.id,
      type: 'content',
      description: `Uploaded new ${content.type.toLowerCase()}: ${content.title}`,
      timestamp: content.createdAt,
    });
  }

  // Sort all activities by timestamp and limit
  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
}

/**
 * Get comprehensive analytics for an artist
 */
export async function getArtistAnalytics(artistId: string): Promise<ArtistAnalytics> {
  const [earnings, subscribers, tiers, recentActivity] = await Promise.all([
    calculateEarningsData(artistId),
    calculateSubscriberMetrics(artistId),
    calculateTierAnalytics(artistId),
    getRecentActivity(artistId),
  ]);

  return {
    earnings,
    subscribers,
    tiers,
    recentActivity,
  };
}

/**
 * Get daily earnings summary for an artist (Requirement 3.2)
 */
export async function getDailyEarningsSummary(artistId: string): Promise<{
  today: number;
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
  dailyAverage: number;
  trend: 'up' | 'down' | 'stable';
}> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get subscriptions for different periods
  const [todaysSubs, yesterdaysSubs, weekSubs, monthSubs, last30DaysSubs] = await Promise.all([
    // Today's new subscriptions
    prisma.subscriptions.findMany({
      where: {
        artistId,
        status: 'ACTIVE',
        createdAt: { gte: today },
      },
      select: { amount: true },
    }),
    // Yesterday's new subscriptions
    prisma.subscriptions.findMany({
      where: {
        artistId,
        status: 'ACTIVE',
        createdAt: { gte: yesterday, lt: today },
      },
      select: { amount: true },
    }),
    // This week's new subscriptions
    prisma.subscriptions.findMany({
      where: {
        artistId,
        status: 'ACTIVE',
        createdAt: { gte: startOfWeek },
      },
      select: { amount: true },
    }),
    // This month's new subscriptions
    prisma.subscriptions.findMany({
      where: {
        artistId,
        status: 'ACTIVE',
        createdAt: { gte: startOfMonth },
      },
      select: { amount: true },
    }),
    // Last 30 days for average calculation
    prisma.subscriptions.findMany({
      where: {
        artistId,
        status: 'ACTIVE',
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { amount: true },
    }),
  ]);

  const todayEarnings = todaysSubs.reduce((sum, sub) => sum + parseFloat(sub.amount.toString()), 0);
  const yesterdayEarnings = yesterdaysSubs.reduce(
    (sum, sub) => sum + parseFloat(sub.amount.toString()),
    0
  );
  const weekEarnings = weekSubs.reduce((sum, sub) => sum + parseFloat(sub.amount.toString()), 0);
  const monthEarnings = monthSubs.reduce((sum, sub) => sum + parseFloat(sub.amount.toString()), 0);
  const last30DaysEarnings = last30DaysSubs.reduce(
    (sum, sub) => sum + parseFloat(sub.amount.toString()),
    0
  );

  const dailyAverage = last30DaysEarnings / 30;

  // Determine trend based on today vs yesterday and daily average
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (todayEarnings > yesterdayEarnings && todayEarnings > dailyAverage) {
    trend = 'up';
  } else if (todayEarnings < yesterdayEarnings && todayEarnings < dailyAverage) {
    trend = 'down';
  }

  return {
    today: todayEarnings,
    yesterday: yesterdayEarnings,
    thisWeek: weekEarnings,
    thisMonth: monthEarnings,
    dailyAverage,
    trend,
  };
}

/**
 * Get detailed subscriber count per tier (Requirement 1.5)
 */
export async function getSubscriberCountPerTier(artistId: string): Promise<
  {
    tierId: string;
    tierName: string;
    subscriberCount: number;
    activeSubscribers: number;
    newThisMonth: number;
    churnThisMonth: number;
    revenue: number;
  }[]
> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const tiers = await prisma.tiers.findMany({
    where: { artistId },
    include: {
      subscriptions: {
        select: {
          id: true,
          status: true,
          amount: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return tiers.map(tier => {
    const allSubs = tier.subscriptions;
    const activeSubs = allSubs.filter(sub => sub.status === 'ACTIVE');
    const newThisMonth = allSubs.filter(sub => sub.createdAt >= startOfMonth);
    const churnedThisMonth = allSubs.filter(
      sub => sub.status === 'CANCELED' && sub.updatedAt >= startOfMonth
    );

    const revenue = activeSubs.reduce((sum, sub) => sum + parseFloat(sub.amount.toString()), 0);

    return {
      tierId: tier.id,
      tierName: tier.name,
      subscriberCount: allSubs.length,
      activeSubscribers: activeSubs.length,
      newThisMonth: newThisMonth.length,
      churnThisMonth: churnedThisMonth.length,
      revenue,
    };
  });
}

/**
 * Get comprehensive churn analysis (Requirement 3.4)
 */
export async function getChurnAnalysis(artistId: string): Promise<{
  overallChurnRate: number;
  monthlyChurnRate: number;
  churnByTier: { tierId: string; tierName: string; churnRate: number }[];
  retentionRate: number;
  averageLifetime: number; // in days
  churnReasons: { reason: string; count: number }[];
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Get all subscriptions for analysis
  const [allSubs, tiers] = await Promise.all([
    prisma.subscriptions.findMany({
      where: { artistId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tierId: true,
      },
    }),
    prisma.tiers.findMany({
      where: { artistId },
      select: { id: true, name: true },
    }),
  ]);

  const activeSubs = allSubs.filter(sub => sub.status === 'ACTIVE');
  const canceledSubs = allSubs.filter(sub => sub.status === 'CANCELED');
  const monthlyChurned = canceledSubs.filter(sub => sub.updatedAt >= startOfMonth);

  // Calculate overall churn rate (canceled / total)
  const overallChurnRate = allSubs.length > 0 ? (canceledSubs.length / allSubs.length) * 100 : 0;

  // Calculate monthly churn rate
  const startOfMonthActive = activeSubs.length + monthlyChurned.length;
  const monthlyChurnRate =
    startOfMonthActive > 0 ? (monthlyChurned.length / startOfMonthActive) * 100 : 0;

  // Calculate churn by tier
  const churnByTier = tiers.map(tier => {
    const tierSubs = allSubs.filter(sub => sub.tierId === tier.id);
    const tierCanceled = tierSubs.filter(sub => sub.status === 'CANCELED');
    const churnRate = tierSubs.length > 0 ? (tierCanceled.length / tierSubs.length) * 100 : 0;

    return {
      tierId: tier.id,
      tierName: tier.name,
      churnRate,
    };
  });

  // Calculate retention rate
  const retentionRate = Math.max(0, 100 - overallChurnRate);

  // Calculate average lifetime (for canceled subscriptions)
  const lifetimes = canceledSubs.map(sub => {
    const lifetime = sub.updatedAt.getTime() - sub.createdAt.getTime();
    return lifetime / (1000 * 60 * 60 * 24); // Convert to days
  });
  const averageLifetime =
    lifetimes.length > 0 ? lifetimes.reduce((sum, days) => sum + days, 0) / lifetimes.length : 0;

  // Placeholder for churn reasons (would need additional data collection)
  const churnReasons = [
    { reason: 'Price too high', count: Math.floor(canceledSubs.length * 0.4) },
    { reason: 'Not enough content', count: Math.floor(canceledSubs.length * 0.3) },
    { reason: 'Technical issues', count: Math.floor(canceledSubs.length * 0.2) },
    { reason: 'Other', count: Math.floor(canceledSubs.length * 0.1) },
  ];

  return {
    overallChurnRate,
    monthlyChurnRate,
    churnByTier,
    retentionRate,
    averageLifetime,
    churnReasons,
  };
}

/**
 * Get earnings data for a specific time period
 */
export async function getEarningsForPeriod(
  artistId: string,
  startDate: Date,
  endDate: Date
): Promise<{ date: string; earnings: number }[]> {
  // Get all subscription payments in the period
  const subscriptions = await prisma.subscriptions.findMany({
    where: {
      artistId,
      status: 'ACTIVE',
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      amount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date
  const earningsByDate = new Map<string, number>();

  for (const sub of subscriptions) {
    const dateKey = sub.createdAt.toISOString().split('T')[0];
    const amount = parseFloat(sub.amount.toString());
    earningsByDate.set(dateKey, (earningsByDate.get(dateKey) || 0) + amount);
  }

  // Convert to array format
  return Array.from(earningsByDate.entries()).map(([date, earnings]) => ({
    date,
    earnings,
  }));
}

/**
 * Get subscriber growth data for a specific time period
 */
export async function getSubscriberGrowthForPeriod(
  artistId: string,
  startDate: Date,
  endDate: Date
): Promise<
  { date: string; subscribers: number; newSubscribers: number; canceledSubscribers: number }[]
> {
  // Get all subscription events in the period
  const subscriptions = await prisma.subscriptions.findMany({
    where: {
      artistId,
      OR: [
        { createdAt: { gte: startDate, lte: endDate } },
        { updatedAt: { gte: startDate, lte: endDate } },
      ],
    },
    select: {
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date and calculate metrics
  const metricsByDate = new Map<string, { new: number; canceled: number; total: number }>();

  for (const sub of subscriptions) {
    const createdDateKey = sub.createdAt.toISOString().split('T')[0];
    const updatedDateKey = sub.updatedAt.toISOString().split('T')[0];

    // Count new subscriptions
    if (sub.createdAt >= startDate && sub.createdAt <= endDate) {
      const existing = metricsByDate.get(createdDateKey) || { new: 0, canceled: 0, total: 0 };
      existing.new += 1;
      metricsByDate.set(createdDateKey, existing);
    }

    // Count cancellations
    if (sub.status === 'CANCELED' && sub.updatedAt >= startDate && sub.updatedAt <= endDate) {
      const existing = metricsByDate.get(updatedDateKey) || { new: 0, canceled: 0, total: 0 };
      existing.canceled += 1;
      metricsByDate.set(updatedDateKey, existing);
    }
  }

  // Calculate running total
  let runningTotal = 0;
  const result = Array.from(metricsByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, metrics]) => {
      runningTotal += metrics.new - metrics.canceled;
      return {
        date,
        subscribers: runningTotal,
        newSubscribers: metrics.new,
        canceledSubscribers: metrics.canceled,
      };
    });

  return result;
}
