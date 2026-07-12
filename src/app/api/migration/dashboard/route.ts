/**
 * Migration Dashboard API
 * Provides real-time migration progress and monitoring data
 * Implements Requirements 11.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MigrationProgressTracker } from '@/lib/migration-progress-tracker';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// This endpoint exposes migration state and destructive pause/resume controls;
// it must be ADMIN-only. Returns a NextResponse to short-circuit when denied.
async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Access denied. Admin role required.' },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const migrationId = searchParams.get('migrationId') || 'aws-conversion-2024';

    const tracker = new MigrationProgressTracker(migrationId);
    const dashboard = await tracker.getDashboard();

    return NextResponse.json({
      success: true,
      data: dashboard
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get migration dashboard', { error: errorMessage });

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to execute migration dashboard action', { error: errorMessage });

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}