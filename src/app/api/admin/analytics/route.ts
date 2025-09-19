import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const analyticsSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  metrics: z
    .array(z.enum(['users', 'revenue', 'content', 'subscriptions', 'retention']))
    .default(['users', 'revenue', 'content', 'subscriptions']),
});

export async function GET(request: NextRequest) {
  return withAdminApi(request, async req => {
    try {
      const { searchParams } = new URL(request.url);

      const params = analyticsSchema.parse({
        period: searchParams.get('period') || '30d',
        metrics: searchParams.get('metrics')?.split(',') || [
          'users',
          'revenue',
          'content',
          'subscriptions',
        ],
      });

      const periodStart = getPeriodStart(params.period);
      const analytics: any = {};

      // User analytics
      if (params.metrics.includes('users')) {
        const [totalUsers, newUsers, artistCount, fanCount] = await Promise.all([
          prisma.users.count(),
          prisma.users.count({
            where: { createdAt: { gte: periodStart } },
          }),
          prisma.users.count({
            where: { role: 'ARTIST' },
          }),
          prisma.users.count({
            where: { role: 'FAN' },
          }),
        ]);

        // Daily user registrations for the period
        const dailyRegistrations = await getDailyRegistrations(periodStart);

        analytics.users = {
          total: totalUsers,
          new: newUsers,
          artists: artistCount,
          fans: fanCount,
          artistToFanRatio: fanCount > 0 ? (artistCount / fanCount).toFixed(2) : 0,
          dailyRegistrations,
        };
      }

      // Revenue analytics
      if (params.metrics.includes('revenue')) {
        const [totalRevenue, periodRevenue, avgRevenuePerArtist, topEarningArtists] =
          await Promise.all([
            prisma.artists.aggregate({
              _sum: { totalEarnings: true },
            }),
            prisma.invoices.aggregate({
              where: {
                status: 'PAID',
                paidAt: { gte: periodStart },
              },
              _sum: { amount: true },
            }),
            prisma.artists.aggregate({
              _avg: { totalEarnings: true },
            }),
            prisma.artists.findMany({
              include: {
                users: {
                  select: {
                    displayName: true,
                    avatar: true,
                  },
                },
              },
              orderBy: { totalEarnings: 'desc' },
              take: 10,
            }),
          ]);

        // Daily revenue for the period
        const dailyRevenue = await getDailyRevenue(periodStart);

        analytics.revenue = {
          total: totalRevenue._sum.totalEarnings || 0,
          period: periodRevenue._sum.amount || 0,
          averagePerArtist: avgRevenuePerArtist._avg.totalEarnings || 0,
          topEarners: topEarningArtists.map(artist => ({
            id: artist.userId,
            displayName: artist.users.displayName,
            avatar: artist.users.avatar,
            totalEarnings: artist.totalEarnings,
            totalSubscribers: artist.totalSubscribers,
          })),
          dailyRevenue,
        };
      }

      // Content analytics
      if (params.metrics.includes('content')) {
        const [totalContent, newContent, contentByType, topContent] = await Promise.all([
          prisma.content.count(),
          prisma.content.count({
            where: { createdAt: { gte: periodStart } },
          }),
          prisma.content.groupBy({
            by: ['type'],
            _count: { id: true },
          }),
          prisma.content.findMany({
            include: {
              users: {
                select: {
                  displayName: true,
                  avatar: true,
                },
              },
              _count: {
                select: {
                  comments: true,
                },
              },
            },
            orderBy: {
              comments: {
                _count: 'desc',
              },
            },
            take: 10,
          }),
        ]);

        const dailyUploads = await getDailyUploads(periodStart);

        analytics.content = {
          total: totalContent,
          new: newContent,
          byType: contentByType.reduce(
            (acc, item) => {
              acc[item.type.toLowerCase()] = item._count.id;
              return acc;
            },
            {} as Record<string, number>
          ),
          topContent: topContent.map(content => ({
            id: content.id,
            title: content.title,
            type: content.type,
            artist: content.users,
            commentCount: content._count.comments,
            createdAt: content.createdAt,
          })),
          dailyUploads,
        };
      }

      // Subscription analytics
      if (params.metrics.includes('subscriptions')) {
        const [totalSubscriptions, activeSubscriptions, newSubscriptions, canceledSubscriptions] =
          await Promise.all([
            prisma.subscriptions.count(),
            prisma.subscriptions.count({
              where: { status: 'ACTIVE' },
            }),
            prisma.subscriptions.count({
              where: { createdAt: { gte: periodStart } },
            }),
            prisma.subscriptions.count({
              where: {
                status: 'CANCELED',
                updatedAt: { gte: periodStart },
              },
            }),
          ]);

        // Average subscription value
        const avgSubscriptionValue = await prisma.subscriptions.aggregate({
          where: { status: 'ACTIVE' },
          _avg: { amount: true },
        });

        // Daily subscription changes
        const dailySubscriptions = await getDailySubscriptions(periodStart);

        // Churn rate calculation
        const startOfPeriodActive = activeSubscriptions + canceledSubscriptions - newSubscriptions;
        const churnRate =
          startOfPeriodActive > 0 ? (canceledSubscriptions / startOfPeriodActive) * 100 : 0;

        analytics.subscriptions = {
          total: totalSubscriptions,
          active: activeSubscriptions,
          new: newSubscriptions,
          canceled: canceledSubscriptions,
          averageValue: avgSubscriptionValue._avg.amount || 0,
          churnRate: churnRate.toFixed(2),
          retentionRate: (100 - churnRate).toFixed(2),
          dailySubscriptions,
        };
      }

      // Platform health metrics
      const healthMetrics = {
        monthlyActiveUsers: await getMonthlyActiveUsers(),
        avgSessionDuration: 25, // Placeholder - would need session tracking
        bounceRate: 35, // Placeholder - would need analytics integration
        conversionRate: await getConversionRate(),
      };

      analytics.health = healthMetrics;

      logger.info('Admin analytics fetched', {
        adminUserId: req.user.id,
        period: params.period,
        metrics: params.metrics,
      });

      return NextResponse.json({
        success: true,
        data: analytics,
        period: params.period,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid parameters',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Admin analytics endpoint error', { adminUserId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
  });
}

function getPeriodStart(period: string): Date {
  const now = new Date();

  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return new Date(0); // Beginning of time
  }
}

async function getDailyRegistrations(periodStart: Date) {
  const registrations = await prisma.$queryRaw`
    SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*)::int as count
    FROM users 
    WHERE "createdAt" >= ${periodStart}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC
  `;

  return registrations;
}

async function getDailyRevenue(periodStart: Date) {
  const revenue = await prisma.$queryRaw`
    SELECT DATE_TRUNC('day', "paidAt") as date, SUM(amount)::float as amount
    FROM invoices 
    WHERE "paidAt" >= ${periodStart} AND status = 'PAID'
    GROUP BY DATE_TRUNC('day', "paidAt")
    ORDER BY date ASC
  `;

  return revenue;
}

async function getDailyUploads(periodStart: Date) {
  const uploads = await prisma.$queryRaw`
    SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*)::int as count
    FROM content 
    WHERE "createdAt" >= ${periodStart}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC
  `;

  return uploads;
}

async function getDailySubscriptions(periodStart: Date) {
  const subscriptions = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('day', "createdAt") as date,
      COUNT(*)::int as new_subscriptions
    FROM subscriptions 
    WHERE "createdAt" >= ${periodStart}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC
  `;

  return subscriptions;
}

async function getMonthlyActiveUsers(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // This is a simplified calculation
  // In reality, you'd track user sessions/activities
  const activeUsers = await prisma.users.count({
    where: {
      updatedAt: { gte: thirtyDaysAgo },
    },
  });

  return activeUsers;
}

async function getConversionRate(): Promise<number> {
  const [totalVisitors, totalSubscribers] = await Promise.all([
    prisma.users.count({ where: { role: 'FAN' } }),
    prisma.subscriptions.count({ where: { status: 'ACTIVE' } }),
  ]);

  return totalVisitors > 0 ? (totalSubscribers / totalVisitors) * 100 : 0;
}
