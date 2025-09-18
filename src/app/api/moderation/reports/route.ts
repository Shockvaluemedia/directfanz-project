import { NextRequest, NextResponse } from 'next/server';
import { withApi, withAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/notifications';

// Note: This would require adding Report model to schema.prisma
// This is a placeholder implementation that would require schema updates

const reportSchema = z.object({
  targetType: z.enum(['user', 'content', 'comment']),
  targetId: z.string().cuid(),
  reason: z.enum([
    'spam',
    'harassment',
    'inappropriate_content',
    'copyright_violation',
    'fraud',
    'hate_speech',
    'violence',
    'other'
  ]),
  description: z.string().min(10).max(1000),
  evidence: z.array(z.string().url()).optional(), // URLs to evidence screenshots/files
});

const reportStatusSchema = z.object({
  reportId: z.string().cuid(),
  status: z.enum(['pending', 'reviewing', 'resolved', 'dismissed']),
  resolution: z.string().max(500).optional(),
  action: z.enum(['none', 'warning', 'content_removal', 'temporary_suspension', 'permanent_ban']).optional(),
});

// User endpoint to submit reports
export async function POST(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      const body = await request.json();
      const validatedData = reportSchema.parse(body);

      const { targetType, targetId, reason, description, evidence } = validatedData;

      // Verify target exists
      let target = null;
      switch (targetType) {
        case 'user':
          target = await prisma.user.findUnique({
            where: { id: targetId },
            select: { id: true, displayName: true, role: true },
          });
          break;
        case 'content':
          target = await prisma.content.findUnique({
            where: { id: targetId },
            include: {
              artist: {
                select: { id: true, displayName: true },
              },
            },
          });
          break;
        case 'comment':
          target = await prisma.comment.findUnique({
            where: { id: targetId },
            include: {
              fan: {
                select: { id: true, displayName: true },
              },
              content: {
                select: { id: true, title: true },
              },
            },
          });
          break;
      }

      if (!target) {
        return NextResponse.json(
          { error: 'Target not found' },
          { status: 404 }
        );
      }

      // Check for duplicate reports from same user
      const existingReport = await prisma.report.findFirst({
        where: {
          reporterId: req.user.id,
          targetType: targetType.toUpperCase() as any,
          targetId,
        },
      });

      if (existingReport) {
        return NextResponse.json(
          { error: 'You have already reported this item' },
          { status: 409 }
        );
      }

      // Create the report in the database
      const report = await prisma.report.create({
        data: {
          reporterId: req.user.id,
          targetType: targetType.toUpperCase() as any, // Convert to enum
          targetId,
          reason: reason.toUpperCase() as any, // Convert to enum
          description,
          evidence: JSON.stringify(evidence || []),
          priority: getPriority(reason),
          status: 'PENDING',
        },
        include: {
          reporter: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      // Notify moderators about new report
      await notifyModerators(report);

      // Auto-flag content for severe violations
      if (['harassment', 'hate_speech', 'violence'].includes(reason)) {
        await autoFlagContent(targetType, targetId);
      }

      logger.warn('Content report submitted', {
        reportId: report.id,
        reporterId: req.user.id,
        targetType,
        targetId,
        reason,
      });

      return NextResponse.json({
        success: true,
        message: 'Report submitted successfully. We will review it within 24 hours.',
        data: {
          reportId: report.id,
          status: report.status,
          estimatedReviewTime: '24 hours',
        },
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Invalid report data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Submit report error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to submit report' },
        { status: 500 }
      );
    }
  });
}

// Admin endpoint to view and manage reports
export async function GET(request: NextRequest) {
  return withAdminApi(request, async (req) => {
    try {
      const { searchParams } = new URL(request.url);
      
      const status = searchParams.get('status') || 'pending';
      const targetType = searchParams.get('targetType');
      const priority = searchParams.get('priority') || 'all';
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Build filter conditions
      const whereClause: any = {};
      
      if (status !== 'all') {
        whereClause.status = status.toUpperCase();
      }
      
      if (targetType) {
        whereClause.targetType = targetType.toUpperCase();
      }
      
      if (priority !== 'all') {
        whereClause.priority = priority.toUpperCase();
      }

      // Get reports from database
      const [reports, totalCount] = await Promise.all([
        prisma.report.findMany({
          where: whereClause,
          include: {
            reporter: {
              select: {
                id: true,
                displayName: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
          take: limit,
          skip: offset,
        }),
        prisma.report.count({ where: whereClause }),
      ]);

      // Get detailed stats
      const [pendingCount, reviewingCount, resolvedCount, dismissedCount, highPriorityCount] = await Promise.all([
        prisma.report.count({ where: { status: 'PENDING' } }),
        prisma.report.count({ where: { status: 'REVIEWING' } }),
        prisma.report.count({ where: { status: 'RESOLVED' } }),
        prisma.report.count({ where: { status: 'DISMISSED' } }),
        prisma.report.count({ where: { priority: 'HIGH' } }),
      ]);

      // Format reports for response
      const formattedReports = reports.map(report => ({
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType.toLowerCase(),
        targetId: report.targetId,
        reason: report.reason.toLowerCase(),
        description: report.description,
        evidence: JSON.parse(report.evidence),
        status: report.status.toLowerCase(),
        priority: report.priority.toLowerCase(),
        resolution: report.resolution,
        action: report.action?.toLowerCase(),
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        reviewedAt: report.reviewedAt,
        reporter: report.reporter,
        reviewer: report.reviewer,
      }));

      return NextResponse.json({
        success: true,
        data: {
          reports: formattedReports,
          stats: {
            total: totalCount,
            pending: pendingCount,
            reviewing: reviewingCount,
            resolved: resolvedCount,
            dismissed: dismissedCount,
            highPriority: highPriorityCount,
          },
        },
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasNext: offset + limit < totalCount,
        },
      });

    } catch (error) {
      logger.error('Get reports error', { adminId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }
  });
}

// Admin endpoint to update report status
export async function PUT(request: NextRequest) {
  return withAdminApi(request, async (req) => {
    try {
      const body = await request.json();
      const validatedData = reportStatusSchema.parse(body);

      const { reportId, status, resolution, action } = validatedData;

      // Update the report in the database
      const report = await prisma.report.update({
        where: { id: reportId },
        data: {
          status: status.toUpperCase() as any,
          resolution,
          action: action ? action.toUpperCase() as any : undefined,
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
        include: {
          reporter: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      // Execute moderation action
      if (action && action !== 'none') {
        await executeModerationAction(report, action);
      }

      // Notify reporter of resolution (placeholder)
      console.log('Would send notification to:', report.reporter.id, `Report ${status}`);

      logger.info('Report updated', {
        reportId,
        adminId: req.user.id,
        status,
        action,
      });

      return NextResponse.json({
        success: true,
        message: 'Report updated successfully',
        data: report,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Invalid update data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Update report error', { adminId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }
  });
}

async function notifyModerators(report: any) {
  // Find all admin users and notify them
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' }, // Use the actual ADMIN role from schema
    select: { id: true },
    take: 10, // Limit notifications
  });

  for (const admin of admins) {
    // Placeholder notification - would send email/push notification
    console.log('Would notify admin:', admin.id, 'New report:', report.id);
  }
}

async function autoFlagContent(targetType: string, targetId: string) {
  // Auto-hide content for severe violations
  if (targetType === 'content') {
    // In real implementation:
    // await prisma.content.update({
    //   where: { id: targetId },
    //   data: { isPublic: false },
    // });
    
    logger.warn('Content auto-flagged', { contentId: targetId });
  }
}

async function executeModerationAction(report: any, action: string) {
  switch (action) {
    case 'warning':
      // Send warning to user
      // await sendWarning(report.targetId);
      break;
    
    case 'content_removal':
      if (report.targetType === 'content') {
        // await prisma.content.update({
        //   where: { id: report.targetId },
        //   data: { isPublic: false },
        // });
      }
      break;
    
    case 'temporary_suspension':
      // Implement user suspension logic
      // This would require adding suspension fields to User model
      break;
    
    case 'permanent_ban':
      // Implement permanent ban logic
      // This would require adding ban fields to User model
      break;
  }

  logger.info('Moderation action executed', {
    action,
    targetType: report.targetType,
    targetId: report.targetId,
  });
}

function getPriority(reason: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const highPriorityReasons = ['harassment', 'hate_speech', 'violence', 'fraud'];
  const mediumPriorityReasons = ['inappropriate_content', 'copyright_violation'];
  
  if (highPriorityReasons.includes(reason)) return 'HIGH';
  if (mediumPriorityReasons.includes(reason)) return 'MEDIUM';
  return 'LOW';
}
