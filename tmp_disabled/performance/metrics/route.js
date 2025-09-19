/**
 * Database Performance Metrics API
 * GET /api/admin/performance/metrics
 */

import { NextResponse } from 'next/server';
import { dbMonitor } from '../../../../../lib/database-monitoring.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const queryType = url.searchParams.get('type'); // 'summary', 'detailed', or null for all
    const limit = parseInt(url.searchParams.get('limit')) || 50;

    let data;

    switch (queryType) {
      case 'summary':
        data = {
          globalStats: dbMonitor.stats,
          topQueries: Object.fromEntries(
            Array.from(dbMonitor.queryMetrics.entries())
              .sort(([, a], [, b]) => b.avgTime - a.avgTime)
              .slice(0, 10)
              .map(([key, metrics]) => [
                key,
                {
                  avgTime: metrics.avgTime,
                  count: metrics.count,
                  errorRate:
                    metrics.count > 0 ? ((metrics.errorCount / metrics.count) * 100).toFixed(2) : 0,
                },
              ])
          ),
          slowQueriesCount: dbMonitor.slowQueries.length,
          activeAlertsCount: dbMonitor.alerts.filter(a => !a.acknowledged).length,
        };
        break;

      case 'detailed':
        data = {
          metrics: dbMonitor.getQueryMetrics(),
          slowQueries: dbMonitor.getSlowQueries(limit),
          recentErrors: dbMonitor.getRecentErrors(limit),
          alerts: dbMonitor.getActiveAlerts(),
        };
        break;

      default:
        // Full metrics
        data = {
          health: await dbMonitor.getDatabaseHealth(),
          metrics: dbMonitor.getQueryMetrics(),
          slowQueries: dbMonitor.getSlowQueries(20),
          recentErrors: dbMonitor.getRecentErrors(20),
          alerts: dbMonitor.getActiveAlerts(),
        };
    }

    return NextResponse.json(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Metrics fetch failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    // Reset metrics (admin only)
    dbMonitor.resetMetrics();

    return NextResponse.json({
      success: true,
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Metrics reset failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset metrics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
