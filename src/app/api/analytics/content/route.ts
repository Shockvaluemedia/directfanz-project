import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

const trackViewSchema = z.object({
  contentId: z.string().cuid(),
  duration: z.number().min(0).optional(), // How long the user viewed/listened (seconds)
  percentage: z.number().min(0).max(100).optional(), // Percentage of content consumed
});

const analyticsQuerySchema = z.object({
  contentId: z.string().cuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional().default('month'),
});

// POST /api/analytics/content - Track content view/engagement
export async function POST(request: NextRequest) {
  return withApi(request, async req => {
    try {
      const body = await request.json();
      const { contentId, duration, percentage } = trackViewSchema.parse(body);

      // Verify content exists and user has access
      const content = await prisma.content.findUnique({
        where: { id: contentId },
        select: {
          id: true,
          artistId: true,
          type: true,
          visibility: true,
          tiers: {
            select: { id: true },
          },
        },
      });

      if (!content) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      // Check access permissions
      let hasAccess = false;

      if (content.visibility === 'PUBLIC') {
        hasAccess = true;
      } else if (req.user.role === 'ARTIST' && content.artistId === req.user.id) {
        hasAccess = true; // Artist viewing their own content
      } else if (req.user.role === 'FAN' && content.tiers.length > 0) {
        // Check if fan has subscription to any of the content's tiers
        const subscriptions = await prisma.subscriptions.findMany({
          where: {
            fanId: req.user.id,
            status: 'ACTIVE',
            tierId: { in: content.tiers.map(t => t.id) },
          },
        });
        hasAccess = subscriptions.length > 0;
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Don't track views for artists viewing their own content
      if (req.user.role === 'ARTIST' && content.artistId === req.user.id) {
        return NextResponse.json({ success: true, tracked: false });
      }

      // Check if we already have a view record for this user/content today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingView = await prisma.content_views.findFirst({
        where: {
          contentId,
          viewerId: req.user.id,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (existingView) {
        // Update existing view with new metrics
        await prisma.content_views.update({
          where: { id: existingView.id },
          data: {
            viewCount: { increment: 1 },
            totalDuration: duration ? { increment: duration } : undefined,
            lastViewedAt: new Date(),
            maxPercentage: percentage
              ? Math.max(existingView.maxPercentage || 0, percentage)
              : existingView.maxPercentage,
          },
        });
      } else {
        // Create new view record
        await prisma.content_views.create({
          data: {
            id: crypto.randomUUID(),
            content: { connect: { id: contentId } },
            users: { connect: { id: req.user.id } },
            viewCount: 1,
            totalDuration: duration || 0,
            maxPercentage: percentage || 0,
            lastViewedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Increment unique views counter on content
        await prisma.content.update({
          where: { id: contentId },
          data: {
            uniqueViews: { increment: 1 },
            totalViews: { increment: 1 },
          },
        });
      }

      // Always increment total views
      await prisma.content.update({
        where: { id: contentId },
        data: {
          totalViews: { increment: 1 },
          lastViewedAt: new Date(),
        },
      });

      logger.info('Content view tracked', {
        contentId,
        viewerId: req.user.id,
        artistId: content.artistId,
        duration,
        percentage,
      });

      return NextResponse.json({ success: true, tracked: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid tracking data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Analytics tracking error', { userId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
    }
  });
}

// GET /api/analytics/content - Get content analytics
export async function GET(request: NextRequest) {
  return withApi(request, async req => {
    try {
      const { searchParams } = new URL(request.url);
      const query = analyticsQuerySchema.parse({
        contentId: searchParams.get('contentId') || undefined,
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        period: searchParams.get('period') || 'month',
      });

      // Only allow artists to view analytics for their own content
      if (req.user.role !== 'ARTIST') {
        return NextResponse.json(
          { error: 'Only artists can view content analytics' },
          { status: 403 }
        );
      }

      // Build date filter
      const dateFilter: any = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);

      // If no specific date range, use period-based filter
      if (!query.startDate && !query.endDate) {
        const now = new Date();
        const periodStart = new Date();

        switch (query.period) {
          case 'day':
            periodStart.setDate(now.getDate() - 1);
            break;
          case 'week':
            periodStart.setDate(now.getDate() - 7);
            break;
          case 'month':
            periodStart.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            periodStart.setFullYear(now.getFullYear() - 1);
            break;
        }

        dateFilter.gte = periodStart;
        dateFilter.lte = now;
      }

      // Build where clause for content filter
      const contentWhere: any = { artistId: req.user.id };
      if (query.contentId) {
        contentWhere.id = query.contentId;
      }

      // Get content analytics
      const [contentStats, topContent, recentViews, viewsOverTime] = await Promise.all([
        // Overall content statistics
        prisma.content.aggregate({
          where: contentWhere,
          _sum: {
            totalViews: true,
            uniqueViews: true,
          },
          _count: {
            id: true,
          },
        }),

        // Top performing content
        prisma.content.findMany({
          where: contentWhere,
          select: {
            id: true,
            title: true,
            type: true,
            totalViews: true,
            uniqueViews: true,
            thumbnailUrl: true,
            createdAt: true,
          },
          orderBy: { totalViews: 'desc' },
          take: 10,
        }),

        // Recent views
        prisma.content_views.findMany({
          where: {
            content: contentWhere,
            createdAt: dateFilter,
          },
          include: {
            users: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              },
            },
            content: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),

        // Views over time (grouped by day for the period)
        prisma.$queryRaw<Array<{ date: string; views: bigint; unique_viewers: bigint }>>`
          SELECT 
            DATE(cv.created_at) as date,
            COUNT(*) as views,
            COUNT(DISTINCT cv.viewer_id) as unique_viewers
          FROM content_views cv
          INNER JOIN content c ON cv.content_id = c.id
          WHERE c.artist_id = ${req.user.id}
            ${query.contentId ? `AND c.id = ${query.contentId}` : ''}
            AND cv.created_at >= ${dateFilter.gte}
            AND cv.created_at <= ${dateFilter.lte}
          GROUP BY DATE(cv.created_at)
          ORDER BY date ASC
        `,
      ]);

      // Get engagement metrics if specific content is requested
      let engagementMetrics = null;
      if (query.contentId) {
        engagementMetrics = await prisma.content_views.aggregate({
          where: {
            contentId: query.contentId,
            createdAt: dateFilter,
          },
          _avg: {
            totalDuration: true,
            maxPercentage: true,
          },
          _sum: {
            totalDuration: true,
            viewCount: true,
          },
        });
      }

      // Calculate additional metrics
      const avgViewsPerContent =
        contentStats._count.id > 0
          ? Math.round((contentStats._sum.totalViews || 0) / contentStats._count.id)
          : 0;

      const engagementRate =
        contentStats._sum.totalViews && contentStats._sum.uniqueViews
          ? Math.round(
              ((contentStats._sum.uniqueViews || 0) / (contentStats._sum.totalViews || 1)) * 100
            )
          : 0;

      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalViews: contentStats._sum.totalViews || 0,
            uniqueViews: contentStats._sum.uniqueViews || 0,
            totalContent: contentStats._count.id,
            avgViewsPerContent,
            engagementRate,
          },
          topContent,
          recentViews,
          viewsOverTime: viewsOverTime.map(row => ({
            date: row.date,
            views: Number(row.views),
            uniqueViewers: Number(row.unique_viewers),
          })),
          engagementMetrics: engagementMetrics
            ? {
                averageDuration: engagementMetrics._avg.totalDuration || 0,
                averageCompletion: engagementMetrics._avg.maxPercentage || 0,
                totalWatchTime: engagementMetrics._sum.totalDuration || 0,
                totalViews: engagementMetrics._sum.viewCount || 0,
              }
            : null,
          period: query.period,
          dateRange: {
            start: dateFilter.gte?.toISOString(),
            end: dateFilter.lte?.toISOString(),
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Analytics fetch error', { userId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
  });
}
