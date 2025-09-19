/**
 * Performance Alerts Management API
 * GET /api/admin/performance/alerts - Get active alerts
 * POST /api/admin/performance/alerts - Acknowledge alerts
 */

import { NextResponse } from 'next/server';
import { dbMonitor } from '../../../../../lib/database-monitoring.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type'); // 'active', 'all', or null for active
    const limit = parseInt(url.searchParams.get('limit')) || 50;

    let alerts;

    if (type === 'all') {
      alerts = dbMonitor.alerts
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } else {
      // Default to active alerts
      alerts = dbMonitor.getActiveAlerts();
    }

    // Group alerts by type for summary
    const alertSummary = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary: {
          total: alerts.length,
          byType: alertSummary,
          activeCount: dbMonitor.getActiveAlerts().length,
          totalCount: dbMonitor.alerts.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Alerts fetch failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alerts',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { alertId, action } = body;

    if (action === 'acknowledge' && alertId) {
      dbMonitor.acknowledgeAlert(alertId);

      return NextResponse.json({
        success: true,
        message: 'Alert acknowledged',
        alertId,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'acknowledge_all') {
      const activeAlerts = dbMonitor.getActiveAlerts();
      activeAlerts.forEach(alert => {
        dbMonitor.acknowledgeAlert(alert.id);
      });

      return NextResponse.json({
        success: true,
        message: `${activeAlerts.length} alerts acknowledged`,
        acknowledgedCount: activeAlerts.length,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action or missing alertId',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Alert action failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process alert action',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
