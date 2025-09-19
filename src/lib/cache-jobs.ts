/**
 * Background Cache Jobs
 *
 * This module provides scheduled jobs and utilities for maintaining
 * the subscription and analytics cache system.
 */

import { subscriptionCache } from './subscription-cache';
import { CachedAnalytics } from './analytics-cached';
import { prisma } from './prisma';
import { logger } from './logger';

interface CacheWarmerConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxArtistsPerBatch: number;
  maxFansPerBatch: number;
  onlyActiveUsers: boolean;
}

interface CacheMaintenanceConfig {
  enabled: boolean;
  intervalHours: number;
  cleanupOldKeys: boolean;
  maxKeyAge: number; // hours
}

interface CacheJobMetrics {
  lastWarmingRun: Date | null;
  lastMaintenanceRun: Date | null;
  totalWarmingRuns: number;
  totalMaintenanceRuns: number;
  averageWarmingDuration: number;
  averageMaintenanceDuration: number;
  lastError: string | null;
}

class CacheJobManager {
  private warmingConfig: CacheWarmerConfig = {
    enabled: process.env.NODE_ENV === 'production',
    intervalMinutes: 30, // Warm cache every 30 minutes
    maxArtistsPerBatch: 50, // Process up to 50 artists at once
    maxFansPerBatch: 100, // Process up to 100 fans at once
    onlyActiveUsers: true, // Only warm cache for users active in last 7 days
  };

  private maintenanceConfig: CacheMaintenanceConfig = {
    enabled: true,
    intervalHours: 6, // Run maintenance every 6 hours
    cleanupOldKeys: true,
    maxKeyAge: 24, // Clean up keys older than 24 hours
  };

  private metrics: CacheJobMetrics = {
    lastWarmingRun: null,
    lastMaintenanceRun: null,
    totalWarmingRuns: 0,
    totalMaintenanceRuns: 0,
    averageWarmingDuration: 0,
    averageMaintenanceDuration: 0,
    lastError: null,
  };

  private warmingInterval: NodeJS.Timeout | null = null;
  private maintenanceInterval: NodeJS.Timeout | null = null;

  /**
   * Start all background cache jobs
   */
  async startJobs(): Promise<void> {
    logger.info('Starting cache background jobs', {
      warming: this.warmingConfig.enabled,
      maintenance: this.maintenanceConfig.enabled,
    });

    // Start cache warming job
    if (this.warmingConfig.enabled) {
      // Run immediately, then at intervals
      this.runCacheWarming();

      this.warmingInterval = setInterval(
        () => this.runCacheWarming(),
        this.warmingConfig.intervalMinutes * 60 * 1000
      );
    }

    // Start maintenance job
    if (this.maintenanceConfig.enabled) {
      // Run immediately, then at intervals
      this.runMaintenance();

      this.maintenanceInterval = setInterval(
        () => this.runMaintenance(),
        this.maintenanceConfig.intervalHours * 60 * 60 * 1000
      );
    }

    logger.info('Cache background jobs started successfully');
  }

  /**
   * Stop all background cache jobs
   */
  stopJobs(): void {
    logger.info('Stopping cache background jobs');

    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    logger.info('Cache background jobs stopped');
  }

  /**
   * Run cache warming for active artists and fans
   */
  private async runCacheWarming(): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('Starting cache warming job');

      // Get active artists (those with recent activity)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Last 7 days

      let artistQuery = `
        SELECT DISTINCT u.id 
        FROM users u 
        WHERE u.role = 'ARTIST'
      `;

      let fanQuery = `
        SELECT DISTINCT u.id 
        FROM users u 
        WHERE u.role = 'FAN'
      `;

      // If only warming for active users, add activity filters
      if (this.warmingConfig.onlyActiveUsers) {
        artistQuery += `
          AND (
            EXISTS (
              SELECT 1 FROM subscriptions s 
              WHERE s."artistId" = u.id 
                AND s."updatedAt" >= $1
            ) OR EXISTS (
              SELECT 1 FROM content c 
              WHERE c."artistId" = u.id 
                AND c."createdAt" >= $1
            )
          )
        `;

        fanQuery += `
          AND EXISTS (
            SELECT 1 FROM subscriptions s 
            WHERE s."fanId" = u.id 
              AND s."updatedAt" >= $1
          )
        `;
      }

      artistQuery += ` LIMIT ${this.warmingConfig.maxArtistsPerBatch}`;
      fanQuery += ` LIMIT ${this.warmingConfig.maxFansPerBatch}`;

      const [activeArtists, activeFans] = await Promise.all([
        this.warmingConfig.onlyActiveUsers
          ? prisma.$queryRaw<Array<{ id: string }>>`${artistQuery}`
          : prisma.$queryRaw<Array<{ id: string }>>`${artistQuery}`,
        this.warmingConfig.onlyActiveUsers
          ? prisma.$queryRaw<Array<{ id: string }>>`${fanQuery}`
          : prisma.$queryRaw<Array<{ id: string }>>`${fanQuery}`,
      ]);

      const artistIds = activeArtists.map(a => a.id);
      const fanIds = activeFans.map(f => f.id);

      logger.info('Cache warming targets identified', {
        artists: artistIds.length,
        fans: fanIds.length,
        onlyActive: this.warmingConfig.onlyActiveUsers,
      });

      // Warm subscription cache
      await subscriptionCache.warmCache(artistIds, fanIds);

      // Warm analytics cache for top artists
      const topArtistIds = artistIds.slice(0, Math.min(20, artistIds.length));
      await CachedAnalytics.refreshAnalyticsForArtists(topArtistIds);

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateWarmingMetrics(duration);

      logger.info('Cache warming completed', {
        duration,
        artistsWarmed: artistIds.length,
        fansWarmed: fanIds.length,
      });
    } catch (error) {
      this.metrics.lastError = error instanceof Error ? error.message : 'Unknown warming error';
      logger.error('Cache warming failed', {}, error as Error);
    }
  }

  /**
   * Run cache maintenance tasks
   */
  private async runMaintenance(): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('Starting cache maintenance job');

      // Perform health check
      const health = await subscriptionCache.healthCheck();

      if (health.status === 'unhealthy') {
        logger.warn('Cache system is unhealthy', health);
      }

      // Log current performance metrics
      const cacheMetrics = subscriptionCache.getMetrics();
      logger.info('Cache performance metrics', cacheMetrics);

      // Reset metrics if needed (to prevent overflow)
      if (cacheMetrics.totalRequests > 100000) {
        subscriptionCache.resetMetrics();
        logger.info('Cache metrics reset due to high request count');
      }

      // Update maintenance metrics
      const duration = Date.now() - startTime;
      this.updateMaintenanceMetrics(duration);

      logger.info('Cache maintenance completed', {
        duration,
        cacheHealth: health.status,
        hitRate: cacheMetrics.hitRate,
      });
    } catch (error) {
      this.metrics.lastError = error instanceof Error ? error.message : 'Unknown maintenance error';
      logger.error('Cache maintenance failed', {}, error as Error);
    }
  }

  /**
   * Update warming metrics
   */
  private updateWarmingMetrics(duration: number): void {
    this.metrics.lastWarmingRun = new Date();
    this.metrics.totalWarmingRuns += 1;
    this.metrics.averageWarmingDuration =
      (this.metrics.averageWarmingDuration * (this.metrics.totalWarmingRuns - 1) + duration) /
      this.metrics.totalWarmingRuns;
  }

  /**
   * Update maintenance metrics
   */
  private updateMaintenanceMetrics(duration: number): void {
    this.metrics.lastMaintenanceRun = new Date();
    this.metrics.totalMaintenanceRuns += 1;
    this.metrics.averageMaintenanceDuration =
      (this.metrics.averageMaintenanceDuration * (this.metrics.totalMaintenanceRuns - 1) +
        duration) /
      this.metrics.totalMaintenanceRuns;
  }

  /**
   * Get current job metrics
   */
  getMetrics(): CacheJobMetrics {
    return { ...this.metrics };
  }

  /**
   * Update warming configuration
   */
  updateWarmingConfig(config: Partial<CacheWarmerConfig>): void {
    this.warmingConfig = { ...this.warmingConfig, ...config };
    logger.info('Cache warming configuration updated', this.warmingConfig);
  }

  /**
   * Update maintenance configuration
   */
  updateMaintenanceConfig(config: Partial<CacheMaintenanceConfig>): void {
    this.maintenanceConfig = { ...this.maintenanceConfig, ...config };
    logger.info('Cache maintenance configuration updated', this.maintenanceConfig);
  }

  /**
   * Manually trigger cache warming
   */
  async triggerCacheWarming(): Promise<void> {
    logger.info('Manual cache warming triggered');
    await this.runCacheWarming();
  }

  /**
   * Manually trigger cache maintenance
   */
  async triggerMaintenance(): Promise<void> {
    logger.info('Manual cache maintenance triggered');
    await this.runMaintenance();
  }

  /**
   * Get job status
   */
  getStatus(): {
    warming: { enabled: boolean; running: boolean; nextRun?: Date };
    maintenance: { enabled: boolean; running: boolean; nextRun?: Date };
    metrics: CacheJobMetrics;
  } {
    return {
      warming: {
        enabled: this.warmingConfig.enabled,
        running: this.warmingInterval !== null,
        nextRun:
          this.warmingInterval && this.metrics.lastWarmingRun
            ? new Date(
                this.metrics.lastWarmingRun.getTime() +
                  this.warmingConfig.intervalMinutes * 60 * 1000
              )
            : undefined,
      },
      maintenance: {
        enabled: this.maintenanceConfig.enabled,
        running: this.maintenanceInterval !== null,
        nextRun:
          this.maintenanceInterval && this.metrics.lastMaintenanceRun
            ? new Date(
                this.metrics.lastMaintenanceRun.getTime() +
                  this.maintenanceConfig.intervalHours * 60 * 60 * 1000
              )
            : undefined,
      },
      metrics: this.getMetrics(),
    };
  }
}

// Export singleton instance
export const cacheJobManager = new CacheJobManager();

/**
 * Smart cache warming based on user activity patterns
 */
export async function warmCacheForActiveUsers(
  timeRange: '1h' | '6h' | '24h' | '7d' = '24h'
): Promise<void> {
  const now = new Date();
  let cutoffDate: Date;

  switch (timeRange) {
    case '1h':
      cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '6h':
      cutoffDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case '24h':
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
  }

  logger.info(`Warming cache for users active since ${cutoffDate.toISOString()}`);

  // Get users with recent activity
  const recentlyActiveUsers = await prisma.$queryRaw<
    Array<{
      id: string;
      role: string;
      activity_count: bigint;
    }>
  >`
    SELECT 
      u.id,
      u.role,
      COUNT(*) as activity_count
    FROM users u
    LEFT JOIN subscriptions s ON (
      s."fanId" = u.id OR s."artistId" = u.id
    ) AND s."updatedAt" >= ${cutoffDate}
    LEFT JOIN content c ON c."artistId" = u.id AND c."createdAt" >= ${cutoffDate}
    WHERE (s.id IS NOT NULL OR c.id IS NOT NULL)
      AND (u.role = 'ARTIST' OR u.role = 'FAN')
    GROUP BY u.id, u.role
    ORDER BY activity_count DESC
    LIMIT 100
  `;

  const artistIds = recentlyActiveUsers.filter(u => u.role === 'ARTIST').map(u => u.id);

  const fanIds = recentlyActiveUsers.filter(u => u.role === 'FAN').map(u => u.id);

  // Warm caches
  await Promise.all([
    subscriptionCache.warmCache(artistIds, fanIds),
    CachedAnalytics.refreshAnalyticsForArtists(artistIds.slice(0, 20)),
  ]);

  logger.info('Smart cache warming completed', {
    timeRange,
    artistsWarmed: artistIds.length,
    fansWarmed: fanIds.length,
  });
}

/**
 * Initialize cache job system (call this on application startup)
 */
export async function initializeCacheJobs(): Promise<void> {
  try {
    await cacheJobManager.startJobs();
    logger.info('Cache job system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize cache job system', {}, error as Error);
  }
}

/**
 * Cleanup cache job system (call this on application shutdown)
 */
export function cleanupCacheJobs(): void {
  try {
    cacheJobManager.stopJobs();
    logger.info('Cache job system cleaned up successfully');
  } catch (error) {
    logger.error('Failed to cleanup cache job system', {}, error as Error);
  }
}

// Export utilities for external use
export const CacheJobs = {
  manager: cacheJobManager,
  warmCacheForActiveUsers,
  initialize: initializeCacheJobs,
  cleanup: cleanupCacheJobs,
};
