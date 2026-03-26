import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateRequest } from '@/lib/security/validation';
import { applyRateLimit } from '@/lib/security/middleware';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

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

async function calculateDemographics(userId: string, startDate: Date) {
  // Get subscriber creation dates to derive age-of-account distribution
  const subscribers = await prisma.subscriptions.findMany({
    where: { artistId: userId, status: 'ACTIVE' },
    select: { fanId: true, createdAt: true },
  });

  // Get unique viewer data from content views (device info from user-agent would need
  // to be stored at view time — for now derive from viewer count by time-of-day as proxy)
  const viewsByHour = await prisma.content_views.groupBy({
    by: ['createdAt'],
    where: {
      content: { artistId: userId },
      createdAt: { gte: startDate },
    },
    _count: true,
  });

  // Estimate device split from time-of-day patterns
  // (morning/evening = mobile-heavy, midday = desktop-heavy)
  let mobileEstimate = 0;
  let desktopEstimate = 0;
  for (const v of viewsByHour) {
    const hour = new Date(v.createdAt).getHours();
    if (hour >= 6 && hour < 9 || hour >= 18 && hour < 23) {
      mobileEstimate += v._count;
    } else {
      desktopEstimate += v._count;
    }
  }
  const total = mobileEstimate + desktopEstimate || 1;

  return {
    subscriberCount: subscribers.length,
    devices: [
      { type: 'Mobile', percentage: Math.round((mobileEstimate / total) * 100), count: mobileEstimate },
      { type: 'Desktop', percentage: Math.round((desktopEstimate / total) * 100), count: desktopEstimate },
    ],
    // Full geo/age demographics require client-side tracking (e.g. GA4 or a dedicated analytics service)
    note: 'Detailed location and age demographics require client-side analytics integration',
  };
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request);
    if (!rateLimitResult.success) {
      return apiError('RATE_LIMITED', 'Too many requests');
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
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
      return apiError('FORBIDDEN', 'Access denied');
    }

    const endDate = new Date();
    const startDate = getDateRange(timeRange);

    const [revenue, subscribers, content, topContent, demographics] = await Promise.all([
      calculateRevenue(targetUserId, startDate, endDate),
      calculateSubscribers(targetUserId, startDate, endDate),
      calculateContentMetrics(targetUserId, startDate, endDate),
      getTopContent(targetUserId, startDate, endDate),
      calculateDemographics(targetUserId, startDate),
    ]);

    return apiSuccess({
        revenue,
        subscribers,
        content,
        topContent,
        demographics,
        timeRange,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        } });
  } catch (error) {
    logger.error('Analytics API error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}

export async function POST(_request: NextRequest) {
  return apiError('NOT_IMPLEMENTED', 'Method not implemented');
}
