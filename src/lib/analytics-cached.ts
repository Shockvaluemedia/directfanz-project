/**
 * Cached Analytics Functions
 *
 * This module wraps the optimized analytics functions with Redis caching
 * to provide even better performance for frequently accessed data.
 */

import {
  subscriptionCache,
  withSubscriptionCache,
  SUBSCRIPTION_CACHE_TTL,
  SUBSCRIPTION_CACHE_KEYS,
  SubscriptionCacheUtils,
} from './subscription-cache';

// Import optimized analytics functions
import {
  calculateEarningsDataOptimized,
  calculateSubscriberMetricsOptimized,
  calculateTierAnalyticsOptimized,
  getRecentActivityOptimized,
  getArtistAnalyticsOptimized,
  getDailyEarningsSummaryOptimized,
  getSubscriberCountPerTierOptimized,
  getChurnAnalysisOptimized,
  getEarningsForPeriodOptimized,
  getSubscriberGrowthForPeriodOptimized,
  type EarningsData,
  type SubscriberMetrics,
  type TierAnalytics,
  type RecentActivity,
} from './analytics-optimized';

import { logger } from './logger';

/**
 * Cached earnings data calculation
 * Cache TTL: 10 minutes (frequently changing data)
 */
export const calculateEarningsDataCached = withSubscriptionCache(
  calculateEarningsDataOptimized,
  (artistId: string) => `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_EARNINGS}${artistId}`,
  SUBSCRIPTION_CACHE_TTL.MEDIUM
);

/**
 * Cached subscriber metrics calculation
 * Cache TTL: 10 minutes (frequently changing data)
 */
export const calculateSubscriberMetricsCached = withSubscriptionCache(
  calculateSubscriberMetricsOptimized,
  (artistId: string) => `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_SUBSCRIBERS}${artistId}`,
  SUBSCRIPTION_CACHE_TTL.MEDIUM
);

/**
 * Cached tier analytics calculation
 * Cache TTL: 10 minutes
 */
export const calculateTierAnalyticsCached = withSubscriptionCache(
  calculateTierAnalyticsOptimized,
  (artistId: string) => `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_TIERS}${artistId}`,
  SUBSCRIPTION_CACHE_TTL.MEDIUM
);

/**
 * Cached recent activity
 * Cache TTL: 2 minutes (real-time data)
 */
export const getRecentActivityCached = withSubscriptionCache(
  getRecentActivityOptimized,
  (artistId: string, limit: number = 10) =>
    `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_ACTIVITY}${artistId}:${limit}`,
  SUBSCRIPTION_CACHE_TTL.SHORT
);

/**
 * Cached daily earnings summary
 * Cache TTL: 10 minutes
 */
export const getDailyEarningsSummaryCached = withSubscriptionCache(
  getDailyEarningsSummaryOptimized,
  (artistId: string) => `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_DAILY_SUMMARY}${artistId}`,
  SUBSCRIPTION_CACHE_TTL.MEDIUM
);

/**
 * Cached subscriber count per tier
 * Cache TTL: 10 minutes
 */
export const getSubscriberCountPerTierCached = withSubscriptionCache(
  getSubscriberCountPerTierOptimized,
  (artistId: string) => `${SUBSCRIPTION_CACHE_KEYS.TIER_SUBSCRIPTIONS}${artistId}:count`,
  SUBSCRIPTION_CACHE_TTL.MEDIUM
);

/**
 * Cached churn analysis
 * Cache TTL: 1 hour (slower changing data)
 */
export const getChurnAnalysisCached = withSubscriptionCache(
  getChurnAnalysisOptimized,
  (artistId: string) => `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_CHURN}${artistId}`,
  SUBSCRIPTION_CACHE_TTL.LONG
);

/**
 * Cached earnings for period with custom TTL based on date range
 * Recent periods: shorter cache, historical periods: longer cache
 */
export async function getEarningsForPeriodCached(
  artistId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; earnings: number }>> {
  // Generate cache key including date range
  const dateRange = `${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}`;
  const cacheKey = `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_EARNINGS}${artistId}:period:${dateRange}`;

  // Calculate appropriate TTL based on how recent the end date is
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

  let ttl: number;
  if (daysDiff < 1) {
    ttl = SUBSCRIPTION_CACHE_TTL.SHORT; // 2 minutes for today's data
  } else if (daysDiff < 7) {
    ttl = SUBSCRIPTION_CACHE_TTL.MEDIUM; // 10 minutes for this week's data
  } else if (daysDiff < 30) {
    ttl = SUBSCRIPTION_CACHE_TTL.LONG; // 1 hour for this month's data
  } else {
    ttl = SUBSCRIPTION_CACHE_TTL.VERY_LONG; // 6 hours for historical data
  }

  return subscriptionCache.withPerformanceTracking(
    cacheKey,
    () => getEarningsForPeriodOptimized(artistId, startDate, endDate),
    ttl
  );
}

/**
 * Cached subscriber growth for period with custom TTL based on date range
 */
export async function getSubscriberGrowthForPeriodCached(
  artistId: string,
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    date: string;
    subscribers: number;
    newSubscribers: number;
    canceledSubscribers: number;
  }>
> {
  // Generate cache key including date range
  const dateRange = `${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}`;
  const cacheKey = `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_SUBSCRIBERS}${artistId}:growth:${dateRange}`;

  // Calculate appropriate TTL based on how recent the end date is
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

  let ttl: number;
  if (daysDiff < 1) {
    ttl = SUBSCRIPTION_CACHE_TTL.SHORT; // 2 minutes for today's data
  } else if (daysDiff < 7) {
    ttl = SUBSCRIPTION_CACHE_TTL.MEDIUM; // 10 minutes for this week's data
  } else if (daysDiff < 30) {
    ttl = SUBSCRIPTION_CACHE_TTL.LONG; // 1 hour for this month's data
  } else {
    ttl = SUBSCRIPTION_CACHE_TTL.VERY_LONG; // 6 hours for historical data
  }

  return subscriptionCache.withPerformanceTracking(
    cacheKey,
    () => getSubscriberGrowthForPeriodOptimized(artistId, startDate, endDate),
    ttl
  );
}

/**
 * Cached comprehensive artist analytics
 * This function benefits significantly from caching since it makes multiple DB queries
 */
export async function getArtistAnalyticsCached(artistId: string) {
  const cacheKey = `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_EARNINGS}${artistId}:comprehensive`;

  return subscriptionCache.withPerformanceTracking(
    cacheKey,
    async () => {
      // Execute all analytics in parallel (already optimized in the original function)
      const [earnings, subscribers, tiers, recentActivity] = await Promise.all([
        calculateEarningsDataOptimized(artistId),
        calculateSubscriberMetricsOptimized(artistId),
        calculateTierAnalyticsOptimized(artistId),
        getRecentActivityOptimized(artistId),
      ]);

      return {
        earnings,
        subscribers,
        tiers,
        recentActivity,
      };
    },
    SUBSCRIPTION_CACHE_TTL.MEDIUM
  );
}

/**
 * Batch analytics refresh for multiple artists
 * Useful for dashboard views or administrative interfaces
 */
export async function refreshAnalyticsForArtists(artistIds: string[]): Promise<void> {
  logger.info('Starting analytics refresh', { artistCount: artistIds.length });

  const refreshTasks = artistIds.map(async artistId => {
    try {
      // Pre-warm caches for each artist
      await Promise.all([
        calculateEarningsDataCached(artistId),
        calculateSubscriberMetricsCached(artistId),
        calculateTierAnalyticsCached(artistId),
        getDailyEarningsSummaryCached(artistId),
      ]);

      logger.debug('Analytics refreshed for artist', { artistId });
    } catch (error) {
      logger.error('Failed to refresh analytics for artist', { artistId }, error as Error);
    }
  });

  await Promise.all(refreshTasks);
  logger.info('Analytics refresh completed', { artistCount: artistIds.length });
}

/**
 * Smart cache invalidation for analytics data
 * Call this when subscription data changes to ensure cache consistency
 */
export async function invalidateAnalyticsCache(
  artistId: string,
  scope: 'earnings' | 'subscribers' | 'tiers' | 'all' = 'all'
): Promise<void> {
  const patterns: string[] = [];

  switch (scope) {
    case 'earnings':
      patterns.push(`${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_EARNINGS}${artistId}*`);
      break;
    case 'subscribers':
      patterns.push(`${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_SUBSCRIBERS}${artistId}*`);
      break;
    case 'tiers':
      patterns.push(`${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_TIERS}${artistId}*`);
      break;
    case 'all':
    default:
      patterns.push(
        `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_EARNINGS}${artistId}*`,
        `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_SUBSCRIBERS}${artistId}*`,
        `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_TIERS}${artistId}*`,
        `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_ACTIVITY}${artistId}*`,
        `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_DAILY_SUMMARY}${artistId}*`,
        `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_CHURN}${artistId}*`
      );
      break;
  }

  // Use existing cache invalidation utility
  await SubscriptionCacheUtils.invalidateArtistCaches(artistId);

  logger.info('Analytics cache invalidated', {
    artistId,
    scope,
    patternsInvalidated: patterns.length,
  });
}

/**
 * Analytics cache health monitoring
 */
export async function getAnalyticsCacheHealth() {
  const health = await subscriptionCache.healthCheck();

  return {
    ...health,
    analyticsSpecific: {
      // Could add analytics-specific metrics here
      lastRefreshTime: new Date().toISOString(),
      supportedOperations: [
        'calculateEarningsData',
        'calculateSubscriberMetrics',
        'calculateTierAnalytics',
        'getRecentActivity',
        'getDailyEarningsSummary',
        'getChurnAnalysis',
      ],
    },
  };
}

/**
 * Performance comparison utility
 * Helps track the improvement from caching
 */
export async function comparePerformance(artistId: string) {
  const startTime = Date.now();

  // Test cached version
  await getArtistAnalyticsCached(artistId);
  const cachedTime = Date.now() - startTime;

  // Clear cache and test uncached version
  await invalidateAnalyticsCache(artistId);
  const uncachedStart = Date.now();
  await getArtistAnalyticsOptimized(artistId);
  const uncachedTime = Date.now() - uncachedStart;

  const improvement = uncachedTime > 0 ? ((uncachedTime - cachedTime) / uncachedTime) * 100 : 0;

  return {
    cachedTime,
    uncachedTime,
    improvementPercentage: Math.max(0, improvement),
    recommendation:
      improvement > 50
        ? 'Caching provides significant performance benefit'
        : improvement > 20
          ? 'Caching provides moderate performance benefit'
          : 'Consider optimizing queries further',
  };
}

// Export all cached functions with a clear naming convention
export const CachedAnalytics = {
  // Core analytics functions
  calculateEarningsData: calculateEarningsDataCached,
  calculateSubscriberMetrics: calculateSubscriberMetricsCached,
  calculateTierAnalytics: calculateTierAnalyticsCached,
  getRecentActivity: getRecentActivityCached,
  getArtistAnalytics: getArtistAnalyticsCached,

  // Time-based analytics
  getDailyEarningsSummary: getDailyEarningsSummaryCached,
  getEarningsForPeriod: getEarningsForPeriodCached,
  getSubscriberGrowthForPeriod: getSubscriberGrowthForPeriodCached,

  // Advanced analytics
  getSubscriberCountPerTier: getSubscriberCountPerTierCached,
  getChurnAnalysis: getChurnAnalysisCached,

  // Utility functions
  refreshAnalyticsForArtists,
  invalidateAnalyticsCache,
  getAnalyticsCacheHealth,
  comparePerformance,
};

// Default export for convenience
export default CachedAnalytics;
