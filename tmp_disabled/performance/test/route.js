/**
 * Performance Testing API
 * POST /api/admin/performance/test - Run performance tests
 * GET /api/admin/performance/test - Get test results
 */

import { NextResponse } from 'next/server';
import { PerformanceBaseline } from '../../../../../scripts/performance-baseline.js';
import { PerformanceTestSuite } from '../../../../../scripts/performance-test-suite.js';
import { dbMonitor } from '../../../../../lib/database-monitoring.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { testType = 'baseline', iterations = 5, concurrency = 3, loadTestDuration = 15 } = body;

    let results;
    let testInstance;

    switch (testType) {
      case 'baseline':
        testInstance = new PerformanceBaseline();
        testInstance.iterations = iterations;
        results = await testInstance.runAllTests();
        break;

      case 'full':
        testInstance = new PerformanceTestSuite({
          iterations,
          concurrency,
          loadTestDuration,
        });
        results = await testInstance.runFullSuite();
        break;

      case 'quick':
        // Quick test with fewer iterations
        testInstance = new PerformanceTestSuite({
          iterations: Math.min(iterations, 3),
          concurrency: Math.min(concurrency, 2),
          loadTestDuration: Math.min(loadTestDuration, 10),
        });
        await testInstance.testCorePerformance();
        results = testInstance.generatePerformanceReport();
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid test type. Use: baseline, full, or quick',
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        testType,
        results,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Performance test failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Performance test failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'export') {
      // Export current metrics to file
      const filePath = await dbMonitor.exportMetrics();

      return NextResponse.json({
        success: true,
        data: {
          message: 'Metrics exported successfully',
          filePath,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Default: return current monitoring status
    const health = await dbMonitor.getDatabaseHealth();
    const activeAlerts = dbMonitor.getActiveAlerts();
    const slowQueries = dbMonitor.getSlowQueries(10);

    return NextResponse.json({
      success: true,
      data: {
        status: 'monitoring_active',
        health,
        activeAlerts: activeAlerts.length,
        slowQueries: slowQueries.length,
        totalQueries: dbMonitor.stats.totalQueries,
        uptime: Date.now() - dbMonitor.stats.startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Performance status check failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get performance status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
