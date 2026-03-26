/**
 * Migration Progress API
 * Handles migration progress updates and phase management
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
    const overview = await tracker.getOverview();

    return apiSuccess(overview);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get migration progress', { error: errMessage });

    return apiError('INTERNAL_ERROR', errMessage);
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
    const { migrationId, action, phaseId, subTaskId, ...params } = body;

    if (!migrationId) {
      return apiError('BAD_REQUEST', 'Migration ID is required');
    }

    const tracker = new MigrationProgressTracker(migrationId);

    switch (action) {
      case 'initialize':
        await tracker.initializeMigration(params.phases);
        break;
      
      case 'start_phase':
        if (!phaseId) {
          return apiError('BAD_REQUEST', 'Phase ID is required for start_phase action');
        }
        await tracker.startPhase(phaseId);
        break;
      
      case 'update_phase_progress':
        if (!phaseId || params.progress === undefined) {
          return apiError('BAD_REQUEST', 'Phase ID and progress are required for update_phase_progress action');
        }
        await tracker.updatePhaseProgress(phaseId, params.progress, params.metadata);
        break;
      
      case 'complete_phase':
        if (!phaseId) {
          return apiError('BAD_REQUEST', 'Phase ID is required for complete_phase action');
        }
        await tracker.completePhase(phaseId, params.metadata);
        break;
      
      case 'fail_phase':
        if (!phaseId || !params.error) {
          return apiError('BAD_REQUEST', 'Phase ID and error message are required for fail_phase action');
        }
        await tracker.failPhase(phaseId, params.error, params.metadata);
        break;
      
      case 'start_subtask':
        if (!phaseId || !subTaskId) {
          return apiError('BAD_REQUEST', 'Phase ID and SubTask ID are required for start_subtask action');
        }
        await tracker.startSubTask(phaseId, subTaskId);
        break;
      
      case 'update_subtask_progress':
        if (!phaseId || !subTaskId || params.progress === undefined) {
          return apiError('BAD_REQUEST', 'Phase ID, SubTask ID, and progress are required for update_subtask_progress action');
        }
        await tracker.updateSubTaskProgress(phaseId, subTaskId, params.progress, params.metadata);
        break;
      
      case 'complete_subtask':
        if (!phaseId || !subTaskId) {
          return apiError('BAD_REQUEST', 'Phase ID and SubTask ID are required for complete_subtask action');
        }
        await tracker.completeSubTask(phaseId, subTaskId, params.metadata);
        break;
      
      case 'fail_subtask':
        if (!phaseId || !subTaskId || !params.error) {
          return apiError('BAD_REQUEST', 'Phase ID, SubTask ID, and error are required for fail_subtask action');
        }
        await tracker.failSubTask(phaseId, subTaskId, params.error, params.metadata);
        break;
      
      default:
        return apiError('BAD_REQUEST', `Unknown action: ${action}`);
    }

    return apiSuccess({ message: `Action ${action} completed successfully` });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to execute migration progress action', {
      error: errMessage,
      action: body?.action,
      migrationId: body?.migrationId
    });

    return apiError('INTERNAL_ERROR', errMessage);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { migrationId, estimateCompletion } = body;

    if (!migrationId) {
      return apiError('BAD_REQUEST', 'Migration ID is required');
    }

    const tracker = new MigrationProgressTracker(migrationId);

    if (estimateCompletion) {
      const estimatedCompletion = await tracker.estimateCompletion();
      return apiSuccess({
          estimatedCompletion
        });
    }

    return apiError('BAD_REQUEST', 'No valid operation specified');
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to execute migration progress operation', { error: errMessage });

    return apiError('INTERNAL_ERROR', errMessage);
  }
}