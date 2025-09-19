import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { subscriptionCache } from '@/lib/subscription-cache';
import { CachedAnalytics } from '@/lib/analytics-cached';
import { cacheJobManager } from '@/lib/cache-jobs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Admin API for monitoring cache performance and system health
 * Provides insights into cache efficiency, job status, and performance metrics
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin access
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const period = searchParams.get('period') || '24h';

    // Handle specific monitoring actions
    switch (action) {
      case 'performance-test':
        return await handlePerformanceTest(searchParams.get('artistId') || '');

      case 'cache-warming':
        return await handleCacheWarming();

      case 'cache-invalidation':
        const scope = searchParams.get('scope') || 'all';
        const artistId = searchParams.get('artistId');
        return await handleCacheInvalidation(artistId, scope);

      case 'job-trigger':
        const jobType = searchParams.get('type');
        return await handleJobTrigger(jobType);
    }

    // Get comprehensive cache monitoring data
    const [cacheHealth, cacheMetrics, analyticsHealth, jobStatus, systemStats] = await Promise.all([
      subscriptionCache.healthCheck(),
      subscriptionCache.getMetrics(),
      CachedAnalytics.getAnalyticsCacheHealth(),
      cacheJobManager.getStatus(),
      getSystemStats(period),
    ]);

    // Calculate cache efficiency insights
    const insights = generateCacheInsights(cacheMetrics, jobStatus);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        // Cache health and metrics
        cache: {
          health: cacheHealth,
          metrics: {
            ...cacheMetrics,
            efficiency:
              cacheMetrics.hitRate > 80
                ? 'excellent'
                : cacheMetrics.hitRate > 60
                  ? 'good'
                  : cacheMetrics.hitRate > 40
                    ? 'fair'
                    : 'poor',
          },
        },

        // Analytics cache health
        analytics: analyticsHealth,

        // Background job status
        jobs: jobStatus,

        // System statistics
        system: systemStats,

        // Performance insights and recommendations
        insights,

        // Quick actions available
        actions: ['performance-test', 'cache-warming', 'cache-invalidation', 'job-trigger'],
      },
    });
  } catch (error) {
    logger.error('Cache monitor API error', {}, error as Error);
    return NextResponse.json({ error: 'Failed to fetch cache monitoring data' }, { status: 500 });
  }
}

// Handle performance testing
async function handlePerformanceTest(artistId: string) {
  if (!artistId) {
    // Find a test artist with data
    const testArtist = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT u.id 
      FROM users u
      JOIN subscriptions s ON s."artistId" = u.id
      WHERE u.role = 'ARTIST'
      GROUP BY u.id
      HAVING COUNT(s.id) > 0
      LIMIT 1
    `;

    if (testArtist.length === 0) {
      return NextResponse.json(
        {
          error: 'No artists with subscription data found for testing',
        },
        { status: 400 }
      );
    }

    artistId = testArtist[0].id;
  }

  try {
    const performance = await CachedAnalytics.comparePerformance(artistId);

    return NextResponse.json({
      success: true,
      action: 'performance-test',
      data: {
        artistId,
        ...performance,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Performance test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle cache warming
async function handleCacheWarming() {
  try {
    await cacheJobManager.triggerCacheWarming();

    return NextResponse.json({
      success: true,
      action: 'cache-warming',
      message: 'Cache warming job triggered successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Cache warming failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle cache invalidation
async function handleCacheInvalidation(artistId: string | null, scope: string) {
  try {
    if (artistId) {
      await CachedAnalytics.invalidateAnalyticsCache(
        artistId,
        scope as 'earnings' | 'subscribers' | 'tiers' | 'all'
      );
    } else {
      // Global cache invalidation (be careful!)
      logger.warn('Global cache invalidation requested');
      // This would be implemented based on specific needs
      return NextResponse.json(
        {
          error: 'Global cache invalidation not implemented for safety',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      action: 'cache-invalidation',
      message: `Cache invalidated for artist ${artistId}, scope: ${scope}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Cache invalidation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle job triggers
async function handleJobTrigger(jobType: string | null) {
  try {
    switch (jobType) {
      case 'warming':
        await cacheJobManager.triggerCacheWarming();
        break;
      case 'maintenance':
        await cacheJobManager.triggerMaintenance();
        break;
      default:
        return NextResponse.json(
          {
            error: 'Invalid job type. Use "warming" or "maintenance"',
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action: 'job-trigger',
      message: `${jobType} job triggered successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Job trigger failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Get system statistics
async function getSystemStats(period: string) {
  const now = new Date();
  let cutoffDate: Date;

  switch (period) {
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
    default:
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  try {
    const [subscriptionStats, contentStats, userStats] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          total_subscriptions: bigint;
          active_subscriptions: bigint;
          recent_subscriptions: bigint;
          recent_cancellations: bigint;
        }>
      >`
        SELECT 
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_subscriptions,
          COUNT(CASE WHEN "createdAt" >= ${cutoffDate} THEN 1 END) as recent_subscriptions,
          COUNT(CASE WHEN status = 'CANCELED' AND "updatedAt" >= ${cutoffDate} THEN 1 END) as recent_cancellations
        FROM subscriptions
      `,

      prisma.$queryRaw<
        Array<{
          total_content: bigint;
          recent_content: bigint;
        }>
      >`
        SELECT 
          COUNT(*) as total_content,
          COUNT(CASE WHEN "createdAt" >= ${cutoffDate} THEN 1 END) as recent_content
        FROM content
      `,

      prisma.$queryRaw<
        Array<{
          total_users: bigint;
          total_artists: bigint;
          total_fans: bigint;
          active_users: bigint;
        }>
      >`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'ARTIST' THEN 1 END) as total_artists,
          COUNT(CASE WHEN role = 'FAN' THEN 1 END) as total_fans,
          COUNT(CASE WHEN "lastLoginAt" >= ${cutoffDate} THEN 1 END) as active_users
        FROM users
      `,
    ]);

    return {
      period,
      subscriptions: {
        total: Number(subscriptionStats[0]?.total_subscriptions || 0),
        active: Number(subscriptionStats[0]?.active_subscriptions || 0),
        recentNew: Number(subscriptionStats[0]?.recent_subscriptions || 0),
        recentCanceled: Number(subscriptionStats[0]?.recent_cancellations || 0),
      },
      content: {
        total: Number(contentStats[0]?.total_content || 0),
        recent: Number(contentStats[0]?.recent_content || 0),
      },
      users: {
        total: Number(userStats[0]?.total_users || 0),
        artists: Number(userStats[0]?.total_artists || 0),
        fans: Number(userStats[0]?.total_fans || 0),
        activeRecently: Number(userStats[0]?.active_users || 0),
      },
    };
  } catch (error) {
    logger.error('Failed to get system stats', {}, error as Error);
    return {
      period,
      error: 'Failed to fetch system statistics',
    };
  }
}

// Generate cache insights and recommendations
function generateCacheInsights(metrics: any, jobStatus: any) {
  const insights = [];
  const recommendations = [];

  // Hit rate analysis
  if (metrics.hitRate > 90) {
    insights.push({
      type: 'success',
      message: 'Excellent cache hit rate indicates optimal performance',
      metric: `${metrics.hitRate.toFixed(1)}% hit rate`,
    });
  } else if (metrics.hitRate > 70) {
    insights.push({
      type: 'info',
      message: "Good cache hit rate, but there's room for improvement",
      metric: `${metrics.hitRate.toFixed(1)}% hit rate`,
    });
    recommendations.push('Consider increasing cache TTL for stable data');
  } else if (metrics.hitRate > 50) {
    insights.push({
      type: 'warning',
      message: 'Moderate cache hit rate suggests optimization opportunities',
      metric: `${metrics.hitRate.toFixed(1)}% hit rate`,
    });
    recommendations.push('Review cache warming strategy');
    recommendations.push('Analyze cache key patterns for optimization');
  } else {
    insights.push({
      type: 'error',
      message: 'Low cache hit rate indicates potential performance issues',
      metric: `${metrics.hitRate.toFixed(1)}% hit rate`,
    });
    recommendations.push('Urgent: Review cache implementation');
    recommendations.push('Consider cache warming for frequently accessed data');
  }

  // Error rate analysis
  if (metrics.errors > 0) {
    const errorRate = (metrics.errors / metrics.totalRequests) * 100;
    if (errorRate > 5) {
      insights.push({
        type: 'error',
        message: 'High cache error rate detected',
        metric: `${errorRate.toFixed(1)}% error rate`,
      });
      recommendations.push('Check Redis connectivity and health');
    } else if (errorRate > 1) {
      insights.push({
        type: 'warning',
        message: 'Some cache errors detected',
        metric: `${errorRate.toFixed(1)}% error rate`,
      });
      recommendations.push('Monitor Redis performance');
    }
  }

  // Job status analysis
  if (!jobStatus.warming.enabled) {
    insights.push({
      type: 'warning',
      message: 'Cache warming is disabled',
      metric: 'Background jobs status',
    });
    recommendations.push('Enable cache warming for better performance');
  }

  if (jobStatus.metrics.lastError) {
    insights.push({
      type: 'error',
      message: 'Recent job execution error detected',
      metric: jobStatus.metrics.lastError,
    });
    recommendations.push('Check job logs and system health');
  }

  // Performance recommendations based on request volume
  if (metrics.totalRequests > 10000) {
    insights.push({
      type: 'info',
      message: 'High request volume detected - cache is critical',
      metric: `${metrics.totalRequests} total requests`,
    });
    recommendations.push('Consider implementing cache sharding');
    recommendations.push('Monitor Redis memory usage');
  }

  return {
    insights,
    recommendations,
    summary: {
      overallStatus:
        metrics.hitRate > 80 && metrics.errors < metrics.totalRequests * 0.01
          ? 'excellent'
          : metrics.hitRate > 60
            ? 'good'
            : 'needs-attention',
      primaryConcern: recommendations.length > 0 ? recommendations[0] : null,
      lastAnalysis: new Date().toISOString(),
    },
  };
}

// Configuration endpoint
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin access
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, config } = body;

    switch (action) {
      case 'update-warming-config':
        cacheJobManager.updateWarmingConfig(config);
        break;
      case 'update-maintenance-config':
        cacheJobManager.updateMaintenanceConfig(config);
        break;
      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache monitor configuration error', {}, error as Error);
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }
}
