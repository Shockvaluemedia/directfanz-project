import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { UserRole } from '@prisma/client';

// Secure random number generator
function secureRandom(max: number): number {
  return Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1) * max);
}

// Secure random float between 0 and max
function secureRandomFloat(max: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1) * max;
}
import client from 'prom-client';

interface BusinessMetricsResponse {
  summary: {
    totalUsers: number;
    totalCreators: number;
    totalFans: number;
    activeSubscriptions: number;
    monthlyRecurringRevenue: number;
    totalRevenue: number;
    conversionRate: number;
    churnRate: number;
    averageRevenuePerUser: number;
  };
  userMetrics: {
    registrations: {
      today: number;
      thisWeek: number;
      thisMonth: number;
      growth: number;
    };
    activeUsers: {
      hourly: number;
      daily: number;
      weekly: number;
      monthly: number;
    };
    retention: {
      day1: number;
      day7: number;
      day30: number;
    };
  };
  contentMetrics: {
    totalContent: number;
    contentUploads: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    contentViews: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    engagementRate: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    monthlyRecurringRevenue: number;
    averageOrderValue: number;
    lifetimeValue: number;
    revenueGrowth: number;
    subscriptionMetrics: {
      newSubscriptions: number;
      cancelledSubscriptions: number;
      churnRate: number;
      upgradeRate: number;
    };
  };
  performanceMetrics: {
    paymentSuccessRate: number;
    paymentFailureRate: number;
    averageLoadTime: number;
    errorRate: number;
    uptime: number;
  };
  trends: {
    userGrowth: Array<{ date: string; users: number; creators: number; fans: number }>;
    revenueGrowth: Array<{ date: string; revenue: number; subscriptions: number }>;
    engagementTrends: Array<{ date: string; views: number; interactions: number }>;
  };
}

/**
 * Get comprehensive business metrics for admin dashboard
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('range') || '30d'; // 1d, 7d, 30d, 90d
    const format = searchParams.get('format') || 'json'; // json, prometheus

    // If requesting Prometheus metrics
    if (format === 'prometheus') {
      const prometheusMetrics = await client.register.metrics();
      return new NextResponse(prometheusMetrics, {
        headers: {
          'Content-Type': client.register.contentType,
        },
      });
    }

    const startTime = Date.now();

    // Calculate date ranges
    const now = new Date();
    const timeRangeMap = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const daysBack = timeRangeMap[timeRange as keyof typeof timeRangeMap] || 30;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Fetch metrics from database
    const [
      userStats,
      contentStats,
      subscriptionStats,
      paymentStats,
      engagementStats,
    ] = await Promise.all([
      getUserMetrics(startDate, now),
      getContentMetrics(startDate, now),
      getSubscriptionMetrics(startDate, now),
      getPaymentMetrics(startDate, now),
      getEngagementMetrics(startDate, now),
    ]);

    // Compile comprehensive metrics response
    const metrics: BusinessMetricsResponse = {
      summary: {
        totalUsers: userStats.totalUsers,
        totalCreators: userStats.totalCreators,
        totalFans: userStats.totalFans,
        activeSubscriptions: subscriptionStats.activeSubscriptions,
        monthlyRecurringRevenue: subscriptionStats.monthlyRecurringRevenue,
        totalRevenue: paymentStats.totalRevenue,
        conversionRate: calculateConversionRate(userStats, subscriptionStats),
        churnRate: subscriptionStats.churnRate,
        averageRevenuePerUser: calculateARPU(paymentStats.totalRevenue, userStats.totalUsers),
      },
      userMetrics: {
        registrations: userStats.registrations,
        activeUsers: userStats.activeUsers,
        retention: userStats.retention,
      },
      contentMetrics: {
        totalContent: contentStats.totalContent,
        contentUploads: contentStats.uploads,
        contentViews: contentStats.views,
        engagementRate: engagementStats.averageEngagementRate,
      },
      revenueMetrics: {
        totalRevenue: paymentStats.totalRevenue,
        monthlyRecurringRevenue: subscriptionStats.monthlyRecurringRevenue,
        averageOrderValue: paymentStats.averageOrderValue,
        lifetimeValue: paymentStats.lifetimeValue,
        revenueGrowth: paymentStats.revenueGrowth,
        subscriptionMetrics: {
          newSubscriptions: subscriptionStats.newSubscriptions,
          cancelledSubscriptions: subscriptionStats.cancelledSubscriptions,
          churnRate: subscriptionStats.churnRate,
          upgradeRate: subscriptionStats.upgradeRate,
        },
      },
      performanceMetrics: {
        paymentSuccessRate: paymentStats.successRate,
        paymentFailureRate: paymentStats.failureRate,
        averageLoadTime: 0, // Would need to implement
        errorRate: 0, // Would need to implement
        uptime: 99.9, // Would need to implement
      },
      trends: {
        userGrowth: userStats.trends,
        revenueGrowth: paymentStats.trends,
        engagementTrends: engagementStats.trends,
      },
    };

    const processingTime = Date.now() - startTime;

    logger.info('Business metrics retrieved', {
      timeRange,
      processingTime,
      adminUser: session.user.id,
      dataPoints: {
        users: metrics.summary.totalUsers,
        revenue: metrics.summary.totalRevenue,
        subscriptions: metrics.summary.activeSubscriptions,
      },
    });

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        'X-Processing-Time': `${processingTime}ms`,
      },
    });

  } catch (error) {
    logger.error('Failed to retrieve business metrics', {}, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get user-related metrics
 */
async function getUserMetrics(startDate: Date, endDate: Date) {
  const [totalUsers, totalCreators, totalFans, recentRegistrations, activeUsers, retentionData] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.ARTIST } }),
    prisma.user.count({ where: { role: UserRole.FAN } }),
    prisma.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        createdAt: true,
        role: true,
      },
    }),
    // Mock active users data - in real implementation, you'd track sessions
    Promise.resolve({
      hourly: secureRandom(100),
      daily: secureRandom(1000),
      weekly: secureRandom(5000),
      monthly: secureRandom(20000),
    }),
    // Mock retention data - in real implementation, you'd calculate from session data
    Promise.resolve({
      day1: 0.85,
      day7: 0.65,
      day30: 0.45,
    }),
  ]);

  // Process registrations by time period
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const registrationsToday = recentRegistrations.filter(u => u.createdAt >= today).length;
  const registrationsThisWeek = recentRegistrations.filter(u => u.createdAt >= thisWeek).length;
  const registrationsThisMonth = recentRegistrations.filter(u => u.createdAt >= thisMonth).length;
  const registrationsLastMonth = recentRegistrations.filter(u => 
    u.createdAt >= lastMonth && u.createdAt < thisMonth
  ).length;

  const growth = registrationsLastMonth > 0 
    ? ((registrationsThisMonth - registrationsLastMonth) / registrationsLastMonth) * 100 
    : 0;

  // Generate trend data
  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayRegistrations = recentRegistrations.filter(u => 
      u.createdAt.toDateString() === date.toDateString()
    );
    trends.push({
      date: date.toISOString().split('T')[0],
      users: dayRegistrations.length,
      creators: dayRegistrations.filter(u => u.role === UserRole.ARTIST).length,
      fans: dayRegistrations.filter(u => u.role === UserRole.FAN).length,
    });
  }

  return {
    totalUsers,
    totalCreators,
    totalFans,
    registrations: {
      today: registrationsToday,
      thisWeek: registrationsThisWeek,
      thisMonth: registrationsThisMonth,
      growth,
    },
    activeUsers,
    retention: retentionData,
    trends,
  };
}

/**
 * Get content-related metrics
 */
async function getContentMetrics(startDate: Date, endDate: Date) {
  // Mock implementation - replace with actual content queries
  const totalContent = secureRandom(10000);
  
  return {
    totalContent,
    uploads: {
      today: secureRandom(50),
      thisWeek: secureRandom(300),
      thisMonth: secureRandom(1200),
    },
    views: {
      today: secureRandom(5000),
      thisWeek: secureRandom(30000),
      thisMonth: secureRandom(120000),
    },
  };
}

/**
 * Get subscription-related metrics
 */
async function getSubscriptionMetrics(startDate: Date, endDate: Date) {
  // Mock implementation - replace with actual subscription queries
  return {
    activeSubscriptions: secureRandom(5000),
    monthlyRecurringRevenue: secureRandom(100000),
    newSubscriptions: secureRandom(500),
    cancelledSubscriptions: secureRandom(50),
    churnRate: secureRandomFloat(5),
    upgradeRate: secureRandomFloat(10),
  };
}

/**
 * Get payment-related metrics
 */
async function getPaymentMetrics(startDate: Date, endDate: Date) {
  // Mock implementation - replace with actual payment queries
  const totalRevenue = secureRandom(500000);
  const successfulPayments = secureRandom(1000);
  const failedPayments = secureRandom(50);
  
  const trends = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    trends.push({
      date: date.toISOString().split('T')[0],
      revenue: secureRandom(10000),
      subscriptions: secureRandom(100),
    });
  }

  return {
    totalRevenue,
    averageOrderValue: totalRevenue / (successfulPayments || 1),
    lifetimeValue: secureRandom(1000),
    revenueGrowth: secureRandomFloat(20),
    successRate: successfulPayments / (successfulPayments + failedPayments) * 100,
    failureRate: failedPayments / (successfulPayments + failedPayments) * 100,
    trends,
  };
}

/**
 * Get engagement-related metrics
 */
async function getEngagementMetrics(startDate: Date, endDate: Date) {
  const trends = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    trends.push({
      date: date.toISOString().split('T')[0],
      views: secureRandom(5000),
      interactions: secureRandom(1000),
    });
  }

  return {
    averageEngagementRate: secureRandomFloat(15),
    trends,
  };
}

/**
 * Calculate conversion rate
 */
function calculateConversionRate(userStats: any, subscriptionStats: any): number {
  if (userStats.totalUsers === 0) return 0;
  return (subscriptionStats.activeSubscriptions / userStats.totalUsers) * 100;
}

/**
 * Calculate Average Revenue Per User
 */
function calculateARPU(totalRevenue: number, totalUsers: number): number {
  if (totalUsers === 0) return 0;
  return totalRevenue / totalUsers;
}