/**
 * Database Health Check API
 * GET /api/admin/performance/health
 */

import { NextResponse } from 'next/server';
import { dbMonitor } from '../../../../../lib/database-monitoring.js';

export async function GET(request) {
  try {
    // Get health metrics
    const health = await dbMonitor.getDatabaseHealth();

    return NextResponse.json(
      {
        success: true,
        data: health,
      },
      {
        status:
          health.status === 'healthy'
            ? 200
            : health.status === 'warning'
              ? 200
              : health.status === 'degraded'
                ? 200
                : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
