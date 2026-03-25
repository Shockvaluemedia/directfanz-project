import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateRequest } from '@/lib/security/validation';
import { applyRateLimit } from '@/lib/security/middleware';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const analyticsQuerySchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
  userId: z.string().optional(),
});

function getDateRange(timeRange: string) {
  const now = new Date();
  const ranges: Record<string, Date> = {
    '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
  };
  return ranges[timeRange] || ranges['30d'];
}

async function calculateRevenue(userId: string, startDate: Date, endDate: Date) {
  const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

  const [currentSubs, previousSubs] = await Promise.all([
    prisma.subscriptions.aggregate({
      where: {
        artistId: userId,
        status: 'ACTIVE',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    }),
    prisma.subscriptions.aggregate({
      where: {
        artistId: userId,
        status: 'ACTIVE',
        createdAt: { gte: previousStartDate, lte: startDate },
      },
      _sum: { amount: true },
    }),
  ]);

  const current = Number(currentSubs._sum.amount ?? 0);
  const previous = Number(previousSubs._sum.amount ?? 0);
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

  return { current, previous, change, currency: 'USD' };
}

async function calculateSubscribers(userId: string, startDate: Date, endDate: Date) {
  const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

  const [currentCount, previousCount] = await Promise.all([
    prisma.subscriptions.count({
      where: { artistId: userId, status: 'ACTIVE', createdAt: { lte: endDate } },
    }),
    prisma.subscriptions.count({
      where: { artistId: userId, status: 'ACTIVE', createdAt: { lte: startDate } },
    }),
  ]);

  const change = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : 0;

  return {
    current: currentCount,
    previous: previousCount,
    change,
    growth: currentCount - previousCount,
  };
}

async function calculateContentMetrics(userId: string, startDate: Date, endDate: Date) {
  const [viewsAgg, likesCount, contentCount] = await Promise.all([
    prisma.content_views.aggregate({
      where: {
        content: { artistId: userId },
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { viewCount: true },
    }),
    prisma.content_likes.count({
      where: {
        content: { artistId: userId },
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.content.count({
      where: { artistId: userId },
    }),
  ]);

  const totalViews = viewsAgg._sum.viewCount ?? 0;
  const totalLikes = likesCount;

  return {
    totalViews,
    totalLikes,
    totalContent: contentCount,
    avgEngagement: totalViews > 0 ? (totalLikes / totalViews) * 100 : 0,
  };
}

async function getTopContent(userId: string, startDate: Date, _endDate: Date) {
  const topContent = await prisma.content.findMany({
    where: { artistId: userId, createdAt: { gte: startDate } },
    orderBy: { totalViews: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      type: true,
      totalViews: true,
      totalLikes: true,
    },
  });

  return topContent.map(c => ({
    id: c.id,
    title: c.title,
    type: c.type,
    views: c.totalViews,
    likes: c.totalLikes,
    revenue: 0, // Revenue per content requires invoice-level join — omitted for now
  }));
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    await validateRequest(request);

    const queryData = analyticsQuerySchema.parse({
      timeRange: searchParams.get('timeRange') || '30d',
      userId: searchParams.get('userId') || undefined,
    });

    const { timeRange, userId } = queryData;

    const targetUserId = userId || session.user.id;
    if (targetUserId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const endDate = new Date();
    const startDate = getDateRange(timeRange);

    const [revenue, subscribers, content, topContent] = await Promise.all([
      calculateRevenue(targetUserId, startDate, endDate),
      calculateSubscribers(targetUserId, startDate, endDate),
      calculateContentMetrics(targetUserId, startDate, endDate),
      getTopContent(targetUserId, startDate, endDate),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        revenue,
        subscribers,
        content,
        topContent,
      },
      timeRange,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Analytics API error', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: 'Method not implemented' }, { status: 501 });
}
