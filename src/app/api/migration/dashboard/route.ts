/**
 * Migration Dashboard API
 * Provides real-time migration progress and monitoring data
 * Implements Requirements 11.6
 */

import { NextRequest } from 'next/server';
import { MigrationProgressTracker } from '@/lib/migration-progress-tracker';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const migrationId = searchParams.get('migrationId') || 'aws-conversion-2024';

    const tracker = new MigrationProgressTracker(migrationId);
    const dashboard = await tracker.getDashboard();

    return apiSuccess(dashboard);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get migration dashboard', { error: errorMessage });

    return apiError('INTERNAL_ERROR', errorMessage);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { migrationId, action, ...params } = body;

    if (!migrationId) {
      return apiError('BAD_REQUEST', 'Migration ID is required');
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
        return apiError('BAD_REQUEST', `Unknown action: ${action}`);
    }

    return apiSuccess({ message: `Action ${action} completed successfully` });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to execute migration dashboard action', { error: errorMessage });

    return apiError('INTERNAL_ERROR', errorMessage);
  }
}