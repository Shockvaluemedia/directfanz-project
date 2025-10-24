import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/artist/content/optimal-times
 * Returns AI-powered suggestions for optimal posting times
 * based on fan engagement patterns
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const artistId = session.user.id;

    // Analyze engagement patterns
    const engagementData = await analyzeEngagementTimes(artistId);

    // Get optimal times based on engagement data
    const optimalTimes = calculateOptimalTimes(engagementData);

    return NextResponse.json({
      success: true,
      data: {
        optimalTimes,
        analyzed: {
          contentCount: engagementData.contentCount,
          viewCount: engagementData.totalViews,
          subscriberCount: engagementData.subscriberCount,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to calculate optimal times', { error });
    return NextResponse.json(
      { error: 'Failed to calculate optimal times' },
      { status: 500 }
    );
  }
}

/**
 * Analyzes when fans are most active based on view patterns
 */
async function analyzeEngagementTimes(artistId: string) {
  // Get all content views for this artist's content in the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const views = await prisma.content_views.findMany({
    where: {
      content: {
        artistId: artistId,
      },
      viewedAt: {
        gte: ninetyDaysAgo,
      },
    },
    select: {
      viewedAt: true,
    },
  });

  // Count views by hour of day and day of week
  const hourCounts: Record<number, number> = {};
  const dayHourCounts: Record<string, Record<number, number>> = {
    '0': {}, '1': {}, '2': {}, '3': {}, '4': {}, '5': {}, '6': {}, // Sun-Sat
  };

  views.forEach((view) => {
    const hour = view.viewedAt.getHours();
    const day = view.viewedAt.getDay(); // 0 = Sunday

    // Count by hour
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;

    // Count by day and hour
    if (!dayHourCounts[day][hour]) {
      dayHourCounts[day][hour] = 0;
    }
    dayHourCounts[day][hour]++;
  });

  // Get subscriber count
  const subscriberCount = await prisma.subscriptions.count({
    where: {
      artistId: artistId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
  });

  // Get content count
  const contentCount = await prisma.content.count({
    where: {
      artistId: artistId,
      publishedAt: { not: null },
    },
  });

  return {
    hourCounts,
    dayHourCounts,
    totalViews: views.length,
    subscriberCount,
    contentCount,
  };
}

/**
 * Calculates optimal posting times based on engagement data
 */
function calculateOptimalTimes(engagementData: any) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const { dayHourCounts, totalViews } = engagementData;

  // If insufficient data, return default recommendations
  if (totalViews < 50) {
    return getDefaultOptimalTimes();
  }

  // Find top engagement times for each day
  const suggestions: Array<{
    day: string;
    dayOfWeek: number;
    hour: number;
    time: string;
    engagement: string;
    score: number;
  }> = [];

  for (let day = 0; day < 7; day++) {
    const dayCounts = dayHourCounts[day];
    if (!dayCounts || Object.keys(dayCounts).length === 0) continue;

    // Find peak hour for this day
    let maxHour = 0;
    let maxCount = 0;

    for (const [hour, count] of Object.entries(dayCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxHour = parseInt(hour);
      }
    }

    if (maxCount > 0) {
      suggestions.push({
        day: dayNames[day],
        dayOfWeek: day,
        hour: maxHour,
        time: formatTime(maxHour),
        engagement: getEngagementLevel(maxCount, totalViews),
        score: maxCount,
      });
    }
  }

  // Sort by engagement score
  suggestions.sort((a, b) => b.score - a.score);

  // Return top 5
  return suggestions.slice(0, 5);
}

/**
 * Returns default optimal times when insufficient data
 */
function getDefaultOptimalTimes() {
  return [
    {
      day: 'Wednesday',
      dayOfWeek: 3,
      hour: 20,
      time: '8:00 PM',
      engagement: 'Recommended',
      score: 0,
      isDefault: true,
    },
    {
      day: 'Friday',
      dayOfWeek: 5,
      hour: 19,
      time: '7:00 PM',
      engagement: 'Recommended',
      score: 0,
      isDefault: true,
    },
    {
      day: 'Sunday',
      dayOfWeek: 0,
      hour: 18,
      time: '6:00 PM',
      engagement: 'Recommended',
      score: 0,
      isDefault: true,
    },
    {
      day: 'Monday',
      dayOfWeek: 1,
      hour: 18,
      time: '6:00 PM',
      engagement: 'Recommended',
      score: 0,
      isDefault: true,
    },
    {
      day: 'Thursday',
      dayOfWeek: 4,
      hour: 20,
      time: '8:00 PM',
      engagement: 'Recommended',
      score: 0,
      isDefault: true,
    },
  ];
}

/**
 * Formats hour (0-23) to readable time string
 */
function formatTime(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

/**
 * Categorizes engagement level based on view count
 */
function getEngagementLevel(count: number, totalViews: number): string {
  const percentage = (count / totalViews) * 100;

  if (percentage >= 15) return 'Very High';
  if (percentage >= 10) return 'High';
  if (percentage >= 5) return 'Medium';
  return 'Low';
}
