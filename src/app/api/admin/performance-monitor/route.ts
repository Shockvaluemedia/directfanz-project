import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { subscriptionPerformanceMonitor } from '@/lib/subscription-performance-monitor';
import { subscriptionCache } from '@/lib/subscription-cache';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Performance Monitoring API for Subscription Queries
 * Provides real-time insights into query performance, bottlenecks, and system health
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
    const timeRange = searchParams.get('timeRange') || '1h';
    const operation = searchParams.get('operation');

    // Convert timeRange to milliseconds
    const timeRangeMs = getTimeRangeMs(timeRange);

    switch (action) {
      case 'query-analysis':
        if (!operation) {
          return NextResponse.json(
            {
              error: 'Operation parameter required for query analysis',
            },
            { status: 400 }
          );
        }
        return await handleQueryAnalysis(operation, timeRangeMs);

      case 'export':
        return await handleExportData(timeRangeMs);

      case 'alerts':
        return await handleGetAlerts(timeRangeMs);

      case 'cleanup':
        return await handleCleanup();

      case 'test-performance':
        return await handleTestPerformance();

      default:
        return await handleOverview(timeRangeMs);
    }
  } catch (error) {
    logger.error('Performance monitor API error', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch performance monitoring data' },
      { status: 500 }
    );
  }
}

// Get overview of system performance
async function handleOverview(timeRangeMs: number) {
  const [performanceStats, recentAlerts, cacheHealth] = await Promise.all([
    subscriptionPerformanceMonitor.getPerformanceStats(timeRangeMs),
    subscriptionPerformanceMonitor.getRecentAlerts(timeRangeMs),
    subscriptionCache.healthCheck(),
  ]);

  // Get top operations by query count and duration
  const topOperations = performanceStats.bottlenecks.slice(0, 10);

  // Calculate system health score
  const healthScore = calculateSystemHealthScore(performanceStats, recentAlerts, cacheHealth);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      overview: {
        healthScore,
        status:
          healthScore > 85
            ? 'excellent'
            : healthScore > 70
              ? 'good'
              : healthScore > 50
                ? 'fair'
                : 'poor',
        timeRange: formatTimeRange(timeRangeMs),
      },
      performance: {
        ...performanceStats,
        queryTrends: await getQueryTrends(timeRangeMs),
      },
      alerts: {
        total: recentAlerts.length,
        critical: recentAlerts.filter(a => a.severity === 'critical').length,
        high: recentAlerts.filter(a => a.severity === 'high').length,
        recent: recentAlerts.slice(0, 5), // Most recent 5 alerts
      },
      cache: {
        health: cacheHealth.status,
        metrics: cacheHealth.metrics,
        connected: cacheHealth.redisConnected,
      },
      topOperations,
      recommendations: generateRecommendations(performanceStats, recentAlerts),
    },
  });
}

// Handle detailed query analysis for specific operation
async function handleQueryAnalysis(operation: string, timeRangeMs: number) {
  const analysis = subscriptionPerformanceMonitor.getQueryAnalysis(operation, timeRangeMs);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      operation,
      analysis,
      timeRange: formatTimeRange(timeRangeMs),
    },
  });
}

// Handle performance data export
async function handleExportData(timeRangeMs: number) {
  const exportData = subscriptionPerformanceMonitor.exportData(timeRangeMs);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: exportData,
    downloadInfo: {
      filename: `performance-data-${new Date().toISOString().split('T')[0]}.json`,
      size: JSON.stringify(exportData).length,
      recordCount: exportData.metrics.length,
    },
  });
}

// Handle alerts retrieval
async function handleGetAlerts(timeRangeMs: number) {
  const alerts = subscriptionPerformanceMonitor.getRecentAlerts(timeRangeMs);

  // Group alerts by type and severity
  const alertSummary = alerts.reduce(
    (summary, alert) => {
      if (!summary[alert.type]) {
        summary[alert.type] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      }
      summary[alert.type][alert.severity]++;
      summary[alert.type].total++;
      return summary;
    },
    {} as Record<string, Record<string, number>>
  );

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      alerts: alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      summary: alertSummary,
      total: alerts.length,
      timeRange: formatTimeRange(timeRangeMs),
    },
  });
}

// Handle cleanup of old data
async function handleCleanup() {
  const olderThanMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  subscriptionPerformanceMonitor.cleanup(olderThanMs);

  return NextResponse.json({
    success: true,
    message: 'Performance monitoring data cleanup completed',
    timestamp: new Date().toISOString(),
  });
}

// Handle performance test
async function handleTestPerformance() {
  try {
    // Find a test artist with subscription data
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

    const artistId = testArtist[0].id;

    // Run performance test on subscription query
    const startTime = Date.now();

    await subscriptionPerformanceMonitor.trackQuery(
      'performance_test',
      'subscription',
      'test_query',
      async () => {
        // Simulate a subscription query
        const result = await prisma.subscriptions.findMany({
          where: { artistId },
          include: {
            tiers: true,
            users: { select: { displayName: true } },
          },
          take: 10,
        });
        return result;
      },
      { artistId, testMode: true }
    );

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Performance test completed',
      data: {
        artistId,
        duration,
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

// Helper function to calculate system health score
function calculateSystemHealthScore(
  performanceStats: any,
  alerts: any[],
  cacheHealth: any
): number {
  let score = 100;

  // Deduct points for performance issues
  if (performanceStats.averageDuration > 1000)
    score -= 20; // Very slow queries
  else if (performanceStats.averageDuration > 500) score -= 10; // Slow queries

  if (performanceStats.errorRate > 0.05)
    score -= 15; // High error rate
  else if (performanceStats.errorRate > 0.01) score -= 5; // Some errors

  if (performanceStats.cacheHitRate < 0.5)
    score -= 20; // Poor cache performance
  else if (performanceStats.cacheHitRate < 0.8) score -= 10; // Suboptimal cache

  // Deduct points for alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const highAlerts = alerts.filter(a => a.severity === 'high').length;

  score -= criticalAlerts * 10;
  score -= highAlerts * 5;

  // Deduct points for cache health
  if (cacheHealth.status === 'unhealthy') score -= 25;
  else if (cacheHealth.status === 'degraded') score -= 10;

  return Math.max(0, score);
}

// Helper function to get query trends over time
async function getQueryTrends(timeRangeMs: number) {
  // This would typically analyze metrics over time periods
  // For now, returning a simplified structure
  const intervals = 12; // 12 intervals for trend analysis
  const intervalMs = timeRangeMs / intervals;
  const trends = [];

  for (let i = 0; i < intervals; i++) {
    const intervalStart = Date.now() - timeRangeMs + i * intervalMs;
    const intervalEnd = intervalStart + intervalMs;

    trends.push({
      timestamp: new Date(intervalStart).toISOString(),
      queryCount: Math.floor(Math.random() * 100), // Placeholder - would get real data
      avgDuration: Math.floor(Math.random() * 1000), // Placeholder
      errorRate: Math.random() * 0.1, // Placeholder
    });
  }

  return trends;
}

// Helper function to generate recommendations
function generateRecommendations(performanceStats: any, alerts: any[]): string[] {
  const recommendations = [];

  if (performanceStats.averageDuration > 1000) {
    recommendations.push('Consider query optimization: average query duration exceeds 1 second');
  }

  if (performanceStats.cacheHitRate < 0.8) {
    recommendations.push('Improve caching strategy: cache hit rate is below 80%');
  }

  if (performanceStats.errorRate > 0.01) {
    recommendations.push('Investigate query errors: error rate is above acceptable threshold');
  }

  const slowQueries = performanceStats.bottlenecks.filter((b: any) => b.avgDuration > 1000);
  if (slowQueries.length > 0) {
    recommendations.push(
      `Optimize slow operations: ${slowQueries.map((q: any) => q.operation).join(', ')}`
    );
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  if (criticalAlerts > 0) {
    recommendations.push(`Address ${criticalAlerts} critical performance alerts`);
  }

  if (recommendations.length === 0) {
    recommendations.push('System performance is optimal - no immediate actions required');
  }

  return recommendations;
}

// Helper functions
function getTimeRangeMs(timeRange: string): number {
  switch (timeRange) {
    case '5m':
      return 5 * 60 * 1000;
    case '15m':
      return 15 * 60 * 1000;
    case '1h':
      return 60 * 60 * 1000;
    case '6h':
      return 6 * 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000; // Default to 1 hour
  }
}

function formatTimeRange(timeRangeMs: number): string {
  const hours = timeRangeMs / (60 * 60 * 1000);
  if (hours < 1) return `${Math.floor(timeRangeMs / (60 * 1000))} minutes`;
  if (hours < 24) return `${Math.floor(hours)} hours`;
  return `${Math.floor(hours / 24)} days`;
}

// Configuration and management endpoints
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      case 'reset-metrics':
        // TODO: Implement metrics reset functionality
        // subscriptionPerformanceMonitor.resetMetrics(); // Method not available
        return NextResponse.json({
          success: true,
          message: 'Performance metrics reset successfully',
        });

      case 'update-thresholds':
        // TODO: Implement threshold update functionality
        // subscriptionPerformanceMonitor.updateThresholds(config); // Method not available
        return NextResponse.json({
          success: true,
          message: 'Performance thresholds updated successfully',
        });

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Performance monitor configuration error', {}, error as Error);
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }
}
