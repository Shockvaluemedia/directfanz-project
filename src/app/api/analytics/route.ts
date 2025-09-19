import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateRequest } from '@/lib/security/validation';
import { applyRateLimit } from '@/lib/security/middleware';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
  userId: z.string().optional(),
});

interface AnalyticsMetrics {
  revenue: {
    current: number;
    previous: number;
    change: number;
    currency: string;
  };
  subscribers: {
    current: number;
    previous: number;
    change: number;
    growth: number;
  };
  content: {
    totalViews: number;
    totalLikes: number;
    totalContent: number;
    avgEngagement: number;
  };
  demographics: {
    locations: Array<{ country: string; percentage: number; count: number }>;
    devices: Array<{ type: string; percentage: number; count: number }>;
    ageGroups: Array<{ range: string; percentage: number; count: number }>;
  };
  timeSeriesData: Array<{
    date: string;
    revenue: number;
    subscribers: number;
    views: number;
    engagement: number;
  }>;
  topContent: Array<{
    id: string;
    title: string;
    type: string;
    views: number;
    likes: number;
    revenue: number;
  }>;
}

function getDateRange(timeRange: string) {
  const now = new Date();
  const ranges = {
    '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
  };
  return ranges[timeRange as keyof typeof ranges] || ranges['30d'];
}

async function calculateRevenue(userId?: string, startDate?: Date, endDate?: Date) {
  // Mock calculation - in real app, this would calculate from transactions
  const baseRevenue = Math.floor(Math.random() * 3000) + 1000;
  const previousRevenue = baseRevenue * 0.8;

  return {
    current: baseRevenue,
    previous: previousRevenue,
    change: ((baseRevenue - previousRevenue) / previousRevenue) * 100,
    currency: 'USD',
  };
}

async function calculateSubscribers(userId?: string, startDate?: Date, endDate?: Date) {
  // Mock calculation - in real app, this would query subscription data
  const current = Math.floor(Math.random() * 2000) + 500;
  const previous = current * 0.75;

  return {
    current,
    previous: Math.floor(previous),
    change: ((current - previous) / previous) * 100,
    growth: current - Math.floor(previous),
  };
}

async function calculateContentMetrics(userId?: string, startDate?: Date, endDate?: Date) {
  // Mock calculation - in real app, this would aggregate content metrics
  const totalViews = Math.floor(Math.random() * 100000) + 10000;
  const totalLikes = Math.floor(totalViews * 0.08);
  const totalContent = Math.floor(Math.random() * 100) + 20;

  return {
    totalViews,
    totalLikes,
    totalContent,
    avgEngagement: (totalLikes / totalViews) * 100,
  };
}

async function calculateDemographics(userId?: string, startDate?: Date, endDate?: Date) {
  // Mock demographics - in real app, this would come from user analytics
  return {
    locations: [
      { country: 'United States', percentage: 35.2, count: 437 },
      { country: 'United Kingdom', percentage: 18.7, count: 232 },
      { country: 'Canada', percentage: 12.4, count: 154 },
      { country: 'Australia', percentage: 9.8, count: 122 },
      { country: 'Germany', percentage: 8.3, count: 103 },
      { country: 'Others', percentage: 15.6, count: 195 },
    ],
    devices: [
      { type: 'Mobile', percentage: 68.4, count: 850 },
      { type: 'Desktop', percentage: 24.7, count: 307 },
      { type: 'Tablet', percentage: 6.9, count: 86 },
    ],
    ageGroups: [
      { range: '18-24', percentage: 28.5, count: 354 },
      { range: '25-34', percentage: 42.1, count: 523 },
      { range: '35-44', percentage: 19.8, count: 246 },
      { range: '45-54', percentage: 7.2, count: 89 },
      { range: '55+', percentage: 2.4, count: 31 },
    ],
  };
}

async function generateTimeSeriesData(timeRange: string, startDate: Date, endDate: Date) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const data = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    data.push({
      date: date.toISOString().split('T')[0],
      revenue: Math.floor(Math.random() * 200) + 50,
      subscribers: Math.floor(Math.random() * 50) + 1200,
      views: Math.floor(Math.random() * 2000) + 1000,
      engagement: Math.floor(Math.random() * 10) + 5,
    });
  }

  return data;
}

async function getTopContent(userId?: string, startDate?: Date, endDate?: Date) {
  // Mock top content - in real app, this would query content performance
  const contentTypes = ['AUDIO', 'VIDEO', 'IMAGE', 'TEXT'];

  return Array.from({ length: 5 }, (_, i) => ({
    id: `content-${i + 1}`,
    title: [
      'Midnight Melodies Vol. 1',
      'Behind the Scenes: Studio Session',
      'Exclusive Interview',
      'Acoustic Sessions',
      'Fan Q&A Session',
    ][i],
    type: contentTypes[Math.floor(Math.random() * contentTypes.length)],
    views: Math.floor(Math.random() * 15000) + 5000,
    likes: Math.floor(Math.random() * 1000) + 200,
    revenue: Math.floor(Math.random() * 500) + 100,
  })).sort((a, b) => b.views - a.views);
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request);

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Get and validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request
    const { searchParams } = new URL(request.url);
    const validation = await validateRequest(request);

    // Parse query parameters
    const queryData = analyticsQuerySchema.parse({
      timeRange: searchParams.get('timeRange') || '30d',
      userId: searchParams.get('userId') || undefined,
    });

    // Extract parsed data
    const { timeRange, userId } = queryData;

    // Check permissions
    const targetUserId = userId || session.user.id;
    if (targetUserId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Calculate date ranges
    const endDate = new Date();
    const startDate = getDateRange(timeRange);

    // Fetch analytics data
    const [revenue, subscribers, content, demographics, timeSeriesData, topContent] =
      await Promise.all([
        calculateRevenue(targetUserId, startDate, endDate),
        calculateSubscribers(targetUserId, startDate, endDate),
        calculateContentMetrics(targetUserId, startDate, endDate),
        calculateDemographics(targetUserId, startDate, endDate),
        generateTimeSeriesData(timeRange, startDate, endDate),
        getTopContent(targetUserId, startDate, endDate),
      ]);

    const analyticsData: AnalyticsMetrics = {
      revenue,
      subscribers,
      content,
      demographics,
      timeSeriesData,
      topContent,
    };

    return NextResponse.json({
      success: true,
      data: analyticsData,
      timeRange,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // For future implementation - custom analytics queries
  return NextResponse.json({ error: 'Method not implemented' }, { status: 501 });
}
