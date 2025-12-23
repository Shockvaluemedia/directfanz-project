/**
 * Migration Progress API
 * Handles migration progress updates and phase management
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
    const overview = await tracker.getOverview();

    return NextResponse.json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('Failed to get migration progress', { error: error.message });
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { migrationId, action, phaseId, subTaskId, ...params } = body;

    if (!migrationId) {
      return NextResponse.json({
        success: false,
        error: 'Migration ID is required'
      }, { status: 400 });
    }

    const tracker = new MigrationProgressTracker(migrationId);

    switch (action) {
      case 'initialize':
        await tracker.initializeMigration(params.phases);
        break;
      
      case 'start_phase':
        if (!phaseId) {
          return NextResponse.json({
            success: false,
            error: 'Phase ID is required for start_phase action'
          }, { status: 400 });
        }
        await tracker.startPhase(phaseId);
        break;
      
      case 'update_phase_progress':
        if (!phaseId || params.progress === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Phase ID and progress are required for update_phase_progress action'
          }, { status: 400 });
        }
        await tracker.updatePhaseProgress(phaseId, params.progress, params.metadata);
        break;
      
      case 'complete_phase':
        if (!phaseId) {
          return NextResponse.json({
            success: false,
            error: 'Phase ID is required for complete_phase action'
          }, { status: 400 });
        }
        await tracker.completePhase(phaseId, params.metadata);
        break;
      
      case 'fail_phase':
        if (!phaseId || !params.error) {
          return NextResponse.json({
            success: false,
            error: 'Phase ID and error message are required for fail_phase action'
          }, { status: 400 });
        }
        await tracker.failPhase(phaseId, params.error, params.metadata);
        break;
      
      case 'start_subtask':
        if (!phaseId || !subTaskId) {
          return NextResponse.json({
            success: false,
            error: 'Phase ID and SubTask ID are required for start_subtask action'
          }, { status: 400 });
        }
        await tracker.startSubTask(phaseId, subTaskId);
        break;
      
      case 'update_subtask_progress':
        if (!phaseId || !subTaskId || params.progress === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Phase ID, SubTask ID, and progress are required for update_subtask_progress action'
          }, { status: 400 });
        }
        await tracker.updateSubTaskProgress(phaseId, subTaskId, params.progress, params.metadata);
        break;
      
      case 'complete_subtask':
        if (!phaseId || !subTaskId) {
          return NextResponse.json({
            success: false,
            error: 'Phase ID and SubTask ID are required for complete_subtask action'
          }, { status: 400 });
        }
        await tracker.completeSubTask(phaseId, subTaskId, params.metadata);
        break;
      
      case 'fail_subtask':
        if (!phaseId || !subTaskId || !params.error) {
          return NextResponse.json({
            success: false,
            error: 'Phase ID, SubTask ID, and error message are required for fail_subtask action'
          }, { status: 400 });
        }
        await tracker.failSubTask(phaseId, subTaskId, params.error, params.metadata);
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
    logger.error('Failed to execute migration progress action', { 
      error: error.message,
      action: body?.action,
      migrationId: body?.migrationId
    });
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { migrationId, estimateCompletion } = body;

    if (!migrationId) {
      return NextResponse.json({
        success: false,
        error: 'Migration ID is required'
      }, { status: 400 });
    }

    const tracker = new MigrationProgressTracker(migrationId);

    if (estimateCompletion) {
      const estimatedCompletion = await tracker.estimateCompletion();
      return NextResponse.json({
        success: true,
        data: {
          estimatedCompletion
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'No valid operation specified'
    }, { status: 400 });
  } catch (error) {
    logger.error('Failed to execute migration progress operation', { error: error.message });
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}