/**
 * Migration Dashboard API
 * Provides real-time migration progress and monitoring data
 * Implements Requirements 11.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { MigrationProgressTracker } from '@/lib/migration-progress-tracker';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const migrationId = searchParams.get('migrationId') || 'aws-conversion-2024';

    const tracker = new MigrationProgressTracker(migrationId);
    const dashboard = await tracker.getDashboard();

    return NextResponse.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Failed to get migration dashboard', { error: error.message });
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { migrationId, action, ...params } = body;

    if (!migrationId) {
      return NextResponse.json({
        success: false,
        error: 'Migration ID is required'
      }, { status: 400 });
    }

    const tracker = new MigrationProgressTracker(migrationId);

    switch (action) {
      case 'pause':
        await tracker.pauseMigration();
        break;
      
      case 'resume':
        await tracker.resumeMigration();
        break;
      
      case 'create_alert':
        const { type, message, phase, subTask, metadata } = params;
        await tracker.createAlert(type, message, phase, subTask, metadata);
        break;
      
      case 'update_metrics':
        await tracker.updateMetrics(params.metrics);
        break;
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Action ${action} completed successfully`
    });
  } catch (error) {
    logger.error('Failed to execute migration dashboard action', { error: error.message });
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}