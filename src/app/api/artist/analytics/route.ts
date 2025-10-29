import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getArtistAnalytics,
  getEarningsForPeriod,
  getSubscriberGrowthForPeriod,
  getDailyEarningsSummary,
  getSubscriberCountPerTier,
  getChurnAnalysis,
} from '@/lib/analytics';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is an artist
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Access denied. Artist role required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type'); // 'daily', 'tiers', 'churn'
    const summary = searchParams.get('summary'); // 'true' for dashboard summary

    // Handle dashboard summary request
    if (summary === 'true') {
      // Optimized: Get all artist stats in fewer, more efficient queries
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const [artistProfile, subscriptionStats, contentCount, unreadMessages] = await Promise.all([
        // Get artist profile with cached subscriber count
        prisma.artists.findUnique({
          where: { userId: session.user.id },
          select: {
            totalSubscribers: true,
            totalEarnings: true,
          },
        }),
        
        // Get subscription stats in a single optimized query
        prisma.subscriptions.aggregate({
          where: {
            artistId: session.user.id,
            status: 'ACTIVE',
          },
          _count: {
            id: true,
          },
          _sum: {
            amount: true,
          },
        }).then(async (activeStats) => {
          // Get monthly revenue separately for efficiency
          const monthlyRevenue = await prisma.subscriptions.aggregate({
            where: {
              artistId: session.user.id,
              status: 'ACTIVE',
              currentPeriodStart: {
                gte: thisMonth,
              },
            },
            _sum: {
              amount: true,
            },
          });
          
          return {
            activeCount: activeStats._count.id,
            totalRevenue: Number(activeStats._sum.amount || 0),
            monthlyRevenue: Number(monthlyRevenue._sum.amount || 0),
          };
        }),
        
        // Get content count
        prisma.content.count({
          where: { artistId: session.user.id },
        }),
        
        // Get unread messages count
        prisma.messages.count({
          where: {
            recipientId: session.user.id,
            readAt: null,
          },
        }),
      ]);

      // Calculate engagement rate (simplified but more efficient)
      const totalSubscribers = artistProfile?.totalSubscribers || 0;
      const activeSubscribers = subscriptionStats.activeCount;
      const engagementRate =
        totalSubscribers > 0
          ? Math.min(100, Math.round((activeSubscribers / totalSubscribers) * 100))
          : 0;

      return NextResponse.json({
        success: true,
        data: {
          stats: {
            totalSubscribers,
            monthlyRevenue: subscriptionStats.monthlyRevenue,
            totalContent: contentCount,
            engagementRate,
            unreadMessages: unreadMessages,
            pendingNotifications: 0, // TODO: implement notifications system
          },
        },
      });
    }

    // Handle specific analytics types
    if (type === 'daily') {
      const dailySummary = await getDailyEarningsSummary(session.user.id);
      return NextResponse.json({
        success: true,
        data: dailySummary,
      });
    }

    if (type === 'tiers') {
      const tierData = await getSubscriberCountPerTier(session.user.id);
      return NextResponse.json({
        success: true,
        data: tierData,
      });
    }

    if (type === 'churn') {
      const churnData = await getChurnAnalysis(session.user.id);
      return NextResponse.json({
        success: true,
        data: churnData,
      });
    }

    // If period parameters are provided, return time-series data
    if (period || (startDate && endDate)) {
      let start: Date;
      let end: Date = new Date();

      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        // Default periods
        const now = new Date();
        switch (period) {
          case '7d':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case '1y':
            start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
      }

      const [earningsData, subscriberData] = await Promise.all([
        getEarningsForPeriod(session.user.id, start, end),
        getSubscriberGrowthForPeriod(session.user.id, start, end),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          earnings: earningsData,
          subscribers: subscriberData,
          period: { start, end },
        },
      });
    }

    // Return comprehensive analytics
    const analytics = await getArtistAnalytics(session.user.id);

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}
