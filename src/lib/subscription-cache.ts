/**
 * Advanced Redis Caching Layer for Subscription Data
 *
 * This module provides:
 * 1. Intelligent caching strategies for subscription queries
 * 2. Automatic cache invalidation on data changes
 * 3. Cache warming for frequently accessed data
 * 4. Performance monitoring and metrics
 * 5. Fallback strategies for cache failures
 */

import {
  getCachedData,
  setCachedData,
  deleteCachedData,
  deleteCachedPattern,
  withCache,
  CACHE_TTL,
  CACHE_KEYS,
} from './redis';
import { logger } from './logger';
import { prisma } from './prisma';

// Enhanced cache TTL for subscription data
export const SUBSCRIPTION_CACHE_TTL = {
  REAL_TIME: 30, // 30 seconds for real-time data (active subscriptions)
  SHORT: 120, // 2 minutes for frequently changing data
  MEDIUM: 600, // 10 minutes for analytics data
  LONG: 3600, // 1 hour for user subscription lists
  VERY_LONG: 21600, // 6 hours for tier information
} as const;

// Enhanced cache keys for subscription-specific data
export const SUBSCRIPTION_CACHE_KEYS = {
  // Individual subscription
  SUBSCRIPTION_DETAIL: 'sub:detail:',

  // User-based caches
  FAN_SUBSCRIPTIONS: 'sub:fan:',
  FAN_ACTIVE_SUBSCRIPTIONS: 'sub:fan:active:',
  FAN_SUBSCRIPTION_COUNT: 'sub:fan:count:',

  // Artist-based caches
  ARTIST_SUBSCRIPTIONS: 'sub:artist:',
  ARTIST_ACTIVE_SUBSCRIPTIONS: 'sub:artist:active:',
  ARTIST_SUBSCRIPTION_METRICS: 'sub:artist:metrics:',
  ARTIST_REVENUE_SUMMARY: 'sub:artist:revenue:',

  // Tier-based caches
  TIER_SUBSCRIPTIONS: 'sub:tier:',
  TIER_SUBSCRIBER_COUNT: 'sub:tier:count:',
  TIER_REVENUE: 'sub:tier:revenue:',

  // Analytics caches (leveraging optimized queries)
  ANALYTICS_EARNINGS: 'analytics:earnings:',
  ANALYTICS_SUBSCRIBERS: 'analytics:subscribers:',
  ANALYTICS_TIERS: 'analytics:tiers:',
  ANALYTICS_ACTIVITY: 'analytics:activity:',
  ANALYTICS_DAILY_SUMMARY: 'analytics:daily:',
  ANALYTICS_CHURN: 'analytics:churn:',

  // Aggregated/computed data
  SUBSCRIPTION_STATS: 'sub:stats:',
  TRENDING_TIERS: 'sub:trending:',
  REVENUE_PROJECTIONS: 'sub:projections:',
} as const;

/**
 * Cache performance metrics
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
}

class SubscriptionCacheManager {
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    totalRequests: 0,
    hitRate: 0,
  };

  /**
   * Get cache performance metrics
   */
  getMetrics(): CacheMetrics {
    this.metrics.totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate =
      this.metrics.totalRequests > 0 ? (this.metrics.hits / this.metrics.totalRequests) * 100 : 0;
    return { ...this.metrics };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = { hits: 0, misses: 0, errors: 0, totalRequests: 0, hitRate: 0 };
  }

  /**
   * Enhanced cache wrapper with performance tracking
   */
  async withPerformanceTracking<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = SUBSCRIPTION_CACHE_TTL.MEDIUM
  ): Promise<T> {
    try {
      const cachedData = await getCachedData<T>(key);

      if (cachedData !== null) {
        this.metrics.hits++;
        logger.debug('Cache hit', { key });
        return cachedData;
      }

      this.metrics.misses++;
      logger.debug('Cache miss', { key });

      const result = await fn();
      await setCachedData(key, result, ttl);

      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache operation error', { key }, error as Error);

      // Fallback to direct execution on cache error
      return await fn();
    }
  }

  /**
   * Cache fan's active subscriptions with tier and artist data
   */
  async getFanActiveSubscriptions(fanId: string) {
    const cacheKey = `${SUBSCRIPTION_CACHE_KEYS.FAN_ACTIVE_SUBSCRIPTIONS}${fanId}`;

    return this.withPerformanceTracking(
      cacheKey,
      async () => {
        // Use optimized query to get all data in one call
        const subscriptions = await prisma.$queryRaw<
          Array<{
            id: string;
            amount: number;
            status: string;
            current_period_start: Date;
            current_period_end: Date;
            created_at: Date;
            tier_id: string;
            tier_name: string;
            tier_price: number;
            artist_id: string;
            artist_name: string;
            artist_avatar: string | null;
          }>
        >`
          SELECT 
            s.id,
            s.amount,
            s.status,
            s."currentPeriodStart" as current_period_start,
            s."currentPeriodEnd" as current_period_end,
            s."createdAt" as created_at,
            t.id as tier_id,
            t.name as tier_name,
            t."minimumPrice" as tier_price,
            u.id as artist_id,
            u."displayName" as artist_name,
            u.avatar as artist_avatar
          FROM subscriptions s
          JOIN tiers t ON s."tierId" = t.id
          JOIN users u ON s."artistId" = u.id
          WHERE s."fanId" = ${fanId}
            AND s.status = 'ACTIVE'
          ORDER BY s."createdAt" DESC
        `;

        return subscriptions.map(sub => ({
          id: sub.id,
          amount: Number(sub.amount),
          status: sub.status,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          createdAt: sub.created_at,
          tier: {
            id: sub.tier_id,
            name: sub.tier_name,
            minimumPrice: Number(sub.tier_price),
          },
          artist: {
            id: sub.artist_id,
            displayName: sub.artist_name,
            avatar: sub.artist_avatar,
          },
        }));
      },
      SUBSCRIPTION_CACHE_TTL.LONG
    );
  }

  /**
   * Cache artist's subscription metrics with aggregated data
   */
  async getArtistSubscriptionMetrics(artistId: string) {
    const cacheKey = `${SUBSCRIPTION_CACHE_KEYS.ARTIST_SUBSCRIPTION_METRICS}${artistId}`;

    return this.withPerformanceTracking(
      cacheKey,
      async () => {
        const metrics = await prisma.$queryRaw<
          Array<{
            total_subscriptions: bigint;
            active_subscriptions: bigint;
            monthly_revenue: number;
            avg_subscription_value: number;
            new_subscriptions_this_month: bigint;
            churned_this_month: bigint;
            growth_rate: number;
          }>
        >`
          WITH subscription_stats AS (
            SELECT 
              COUNT(*) as total_subscriptions,
              COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_subscriptions,
              COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN amount ELSE 0 END), 0) as monthly_revenue,
              COALESCE(AVG(CASE WHEN status = 'ACTIVE' THEN amount ELSE NULL END), 0) as avg_subscription_value,
              COUNT(CASE WHEN "createdAt" >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_subscriptions_this_month,
              COUNT(CASE WHEN status = 'CANCELED' AND "updatedAt" >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as churned_this_month
            FROM subscriptions 
            WHERE "artistId" = ${artistId}
          ),
          last_month_stats AS (
            SELECT COUNT(*) as last_month_active
            FROM subscriptions
            WHERE "artistId" = ${artistId}
              AND status = 'ACTIVE'
              AND "createdAt" < DATE_TRUNC('month', CURRENT_DATE)
              AND "createdAt" >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          )
          SELECT 
            ss.*,
            CASE 
              WHEN lms.last_month_active > 0 THEN 
                ((ss.active_subscriptions::float - lms.last_month_active) / lms.last_month_active) * 100
              ELSE 0 
            END as growth_rate
          FROM subscription_stats ss, last_month_stats lms
        `;

        const data = metrics[0] || {
          total_subscriptions: 0n,
          active_subscriptions: 0n,
          monthly_revenue: 0,
          avg_subscription_value: 0,
          new_subscriptions_this_month: 0n,
          churned_this_month: 0n,
          growth_rate: 0,
        };

        return {
          totalSubscriptions: Number(data.total_subscriptions),
          activeSubscriptions: Number(data.active_subscriptions),
          monthlyRevenue: Number(data.monthly_revenue),
          averageSubscriptionValue: Number(data.avg_subscription_value),
          newSubscriptionsThisMonth: Number(data.new_subscriptions_this_month),
          churnedThisMonth: Number(data.churned_this_month),
          growthRate: Number(data.growth_rate),
        };
      },
      SUBSCRIPTION_CACHE_TTL.MEDIUM
    );
  }

  /**
   * Cache tier subscription analytics
   */
  async getTierSubscriptionAnalytics(artistId: string) {
    const cacheKey = `${SUBSCRIPTION_CACHE_KEYS.TIER_SUBSCRIPTIONS}${artistId}`;

    return this.withPerformanceTracking(
      cacheKey,
      async () => {
        const tierData = await prisma.$queryRaw<
          Array<{
            tier_id: string;
            tier_name: string;
            tier_price: number;
            total_subscribers: bigint;
            active_subscribers: bigint;
            monthly_revenue: number;
            conversion_rate: number;
            churn_rate: number;
          }>
        >`
          SELECT 
            t.id as tier_id,
            t.name as tier_name,
            t."minimumPrice" as tier_price,
            COUNT(s.id) as total_subscribers,
            COUNT(CASE WHEN s.status = 'ACTIVE' THEN 1 END) as active_subscribers,
            COALESCE(SUM(CASE WHEN s.status = 'ACTIVE' THEN s.amount ELSE 0 END), 0) as monthly_revenue,
            -- Placeholder for conversion rate (would need view tracking)
            0 as conversion_rate,
            -- Calculate churn rate
            CASE 
              WHEN COUNT(s.id) > 0 THEN
                (COUNT(CASE WHEN s.status = 'CANCELED' THEN 1 END)::float / COUNT(s.id)) * 100
              ELSE 0
            END as churn_rate
          FROM tiers t
          LEFT JOIN subscriptions s ON t.id = s."tierId"
          WHERE t."artistId" = ${artistId} AND t."isActive" = true
          GROUP BY t.id, t.name, t."minimumPrice"
          ORDER BY monthly_revenue DESC
        `;

        return tierData.map(tier => ({
          tierId: tier.tier_id,
          tierName: tier.tier_name,
          minimumPrice: Number(tier.tier_price),
          totalSubscribers: Number(tier.total_subscribers),
          activeSubscribers: Number(tier.active_subscribers),
          monthlyRevenue: Number(tier.monthly_revenue),
          conversionRate: Number(tier.conversion_rate),
          churnRate: Number(tier.churn_rate),
        }));
      },
      SUBSCRIPTION_CACHE_TTL.MEDIUM
    );
  }

  /**
   * Cache trending tiers across platform
   */
  async getTrendingTiers(limit: number = 10) {
    const cacheKey = `${SUBSCRIPTION_CACHE_KEYS.TRENDING_TIERS}${limit}`;

    return this.withPerformanceTracking(
      cacheKey,
      async () => {
        const trendingTiers = await prisma.$queryRaw<
          Array<{
            tier_id: string;
            tier_name: string;
            artist_name: string;
            tier_price: number;
            subscriber_growth: bigint;
            revenue_growth: number;
            trend_score: number;
          }>
        >`
          WITH tier_stats AS (
            SELECT 
              t.id as tier_id,
              t.name as tier_name,
              u."displayName" as artist_name,
              t."minimumPrice" as tier_price,
              COUNT(CASE WHEN s."createdAt" >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as subscriber_growth,
              COALESCE(SUM(CASE 
                WHEN s.status = 'ACTIVE' AND s."createdAt" >= CURRENT_DATE - INTERVAL '7 days' 
                THEN s.amount ELSE 0 
              END), 0) as revenue_growth
            FROM tiers t
            JOIN users u ON t."artistId" = u.id
            LEFT JOIN subscriptions s ON t.id = s."tierId"
            WHERE t."isActive" = true
            GROUP BY t.id, t.name, u."displayName", t."minimumPrice"
            HAVING COUNT(CASE WHEN s."createdAt" >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) > 0
          )
          SELECT 
            *,
            -- Calculate trend score based on growth and engagement
            (subscriber_growth::float * 0.7 + (revenue_growth / tier_price) * 0.3) as trend_score
          FROM tier_stats
          ORDER BY trend_score DESC
          LIMIT ${limit}
        `;

        return trendingTiers.map(tier => ({
          tierId: tier.tier_id,
          tierName: tier.tier_name,
          artistName: tier.artist_name,
          minimumPrice: Number(tier.tier_price),
          subscriberGrowth: Number(tier.subscriber_growth),
          revenueGrowth: Number(tier.revenue_growth),
          trendScore: Number(tier.trend_score),
        }));
      },
      SUBSCRIPTION_CACHE_TTL.MEDIUM
    );
  }

  /**
   * Intelligent cache invalidation on subscription changes
   */
  async invalidateSubscriptionCache(
    subscriptionId: string,
    fanId: string,
    artistId: string,
    tierId: string
  ): Promise<void> {
    const patterns = [
      // Individual subscription
      `${SUBSCRIPTION_CACHE_KEYS.SUBSCRIPTION_DETAIL}${subscriptionId}`,

      // Fan-related caches
      `${SUBSCRIPTION_CACHE_KEYS.FAN_SUBSCRIPTIONS}${fanId}*`,
      `${SUBSCRIPTION_CACHE_KEYS.FAN_ACTIVE_SUBSCRIPTIONS}${fanId}`,
      `${SUBSCRIPTION_CACHE_KEYS.FAN_SUBSCRIPTION_COUNT}${fanId}`,

      // Artist-related caches
      `${SUBSCRIPTION_CACHE_KEYS.ARTIST_SUBSCRIPTIONS}${artistId}*`,
      `${SUBSCRIPTION_CACHE_KEYS.ARTIST_SUBSCRIPTION_METRICS}${artistId}`,
      `${SUBSCRIPTION_CACHE_KEYS.ARTIST_REVENUE_SUMMARY}${artistId}`,

      // Tier-related caches
      `${SUBSCRIPTION_CACHE_KEYS.TIER_SUBSCRIPTIONS}${artistId}`,
      `${SUBSCRIPTION_CACHE_KEYS.TIER_SUBSCRIBER_COUNT}${tierId}`,
      `${SUBSCRIPTION_CACHE_KEYS.TIER_REVENUE}${tierId}`,

      // Analytics caches
      `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_EARNINGS}${artistId}*`,
      `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_SUBSCRIBERS}${artistId}*`,
      `${SUBSCRIPTION_CACHE_KEYS.ANALYTICS_TIERS}${artistId}*`,

      // Platform-wide caches that might be affected
      `${SUBSCRIPTION_CACHE_KEYS.TRENDING_TIERS}*`,
      `${SUBSCRIPTION_CACHE_KEYS.SUBSCRIPTION_STATS}*`,
    ];

    // Execute invalidation in parallel for better performance
    await Promise.all(patterns.map(pattern => deleteCachedPattern(pattern)));

    logger.info('Subscription cache invalidated', {
      subscriptionId,
      fanId,
      artistId,
      tierId,
      patternsInvalidated: patterns.length,
    });
  }

  /**
   * Cache warming for frequently accessed data
   */
  async warmCache(artistIds: string[], fanIds: string[]): Promise<void> {
    logger.info('Starting cache warming', {
      artistCount: artistIds.length,
      fanCount: fanIds.length,
    });

    const warmingTasks = [];

    // Warm artist subscription metrics
    for (const artistId of artistIds) {
      warmingTasks.push(
        this.getArtistSubscriptionMetrics(artistId),
        this.getTierSubscriptionAnalytics(artistId)
      );
    }

    // Warm fan active subscriptions
    for (const fanId of fanIds) {
      warmingTasks.push(this.getFanActiveSubscriptions(fanId));
    }

    // Warm trending tiers
    warmingTasks.push(this.getTrendingTiers(20));

    // Execute warming tasks in parallel with error handling
    const results = await Promise.allSettled(warmingTasks);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('Cache warming completed', {
      successful,
      failed,
      total: warmingTasks.length,
    });
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: CacheMetrics;
    redisConnected: boolean;
    lastError?: string;
  }> {
    try {
      // Test Redis connectivity
      const testKey = 'health_check_' + Date.now();
      await setCachedData(testKey, { test: true }, 10);
      const testResult = await getCachedData(testKey);
      await deleteCachedData(testKey);

      const metrics = this.getMetrics();
      const redisConnected = testResult !== null;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!redisConnected) {
        status = 'unhealthy';
      } else if (metrics.hitRate < 50 || metrics.errors > metrics.hits * 0.1) {
        status = 'degraded';
      }

      return {
        status,
        metrics,
        redisConnected,
      };
    } catch (error) {
      logger.error('Cache health check failed', {}, error as Error);

      return {
        status: 'unhealthy',
        metrics: this.getMetrics(),
        redisConnected: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const subscriptionCache = new SubscriptionCacheManager();

/**
 * Middleware-style cache wrapper for subscription operations
 */
export function withSubscriptionCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  cacheKeyGenerator: (...args: T) => string,
  ttl: number = SUBSCRIPTION_CACHE_TTL.MEDIUM
) {
  return async (...args: T): Promise<R> => {
    const cacheKey = cacheKeyGenerator(...args);

    return subscriptionCache.withPerformanceTracking(cacheKey, () => fn(...args), ttl);
  };
}

/**
 * Decorator for automatic cache invalidation
 */
export function invalidateOnChange(cachePatterns: string[]) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (...args: T): Promise<R> {
      const result = await method.apply(this, args);

      // Invalidate caches after successful execution
      await Promise.all(cachePatterns.map(pattern => deleteCachedPattern(pattern)));

      return result;
    };
  };
}

// Export cache utilities for easier integration
export const SubscriptionCacheUtils = {
  // Cache key generators
  fanActiveSubscriptionsKey: (fanId: string) =>
    `${SUBSCRIPTION_CACHE_KEYS.FAN_ACTIVE_SUBSCRIPTIONS}${fanId}`,

  artistMetricsKey: (artistId: string) =>
    `${SUBSCRIPTION_CACHE_KEYS.ARTIST_SUBSCRIPTION_METRICS}${artistId}`,

  tierAnalyticsKey: (artistId: string) =>
    `${SUBSCRIPTION_CACHE_KEYS.TIER_SUBSCRIPTIONS}${artistId}`,

  // Batch operations
  invalidateArtistCaches: async (artistId: string) => {
    await subscriptionCache.invalidateSubscriptionCache('', '', artistId, '');
  },

  invalidateFanCaches: async (fanId: string) => {
    const patterns = [
      `${SUBSCRIPTION_CACHE_KEYS.FAN_SUBSCRIPTIONS}${fanId}*`,
      `${SUBSCRIPTION_CACHE_KEYS.FAN_ACTIVE_SUBSCRIPTIONS}${fanId}`,
      `${SUBSCRIPTION_CACHE_KEYS.FAN_SUBSCRIPTION_COUNT}${fanId}`,
    ];

    await Promise.all(patterns.map(pattern => deleteCachedPattern(pattern)));
  },
};
