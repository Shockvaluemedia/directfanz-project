import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/artist/content/calendar
 * Returns scheduled content for calendar view
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth()));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // Validate month/year
    if (month < 0 || month > 11) {
      return NextResponse.json({ error: 'Invalid month (0-11)' }, { status: 400 });
    }

    if (year < 2020 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    // Calculate date range for the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);

    // Get scheduled content for this month
    const scheduledContent = await prisma.content.findMany({
      where: {
        artistId: session.user.id,
        isScheduled: true,
        scheduledFor: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        scheduled_publish: true,
        tiers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        scheduledFor: 'asc',
      },
    });

    // Group by day for easier calendar rendering
    const contentByDay: Record<string, any[]> = {};

    scheduledContent.forEach((content) => {
      if (!content.scheduledFor) return;

      const dayKey = content.scheduledFor.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!contentByDay[dayKey]) {
        contentByDay[dayKey] = [];
      }

      contentByDay[dayKey].push({
        id: content.id,
        title: content.title,
        type: content.type,
        scheduledFor: content.scheduledFor,
        timezone: content.scheduled_publish?.timezone || 'UTC',
        publishStatus: content.publishStatus,
        thumbnailUrl: content.thumbnailUrl,
        tiers: content.tiers,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        contentByDay,
        totalScheduled: scheduledContent.length,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get calendar data', { error });
    return NextResponse.json(
      { error: 'Failed to get calendar data' },
      { status: 500 }
    );
  }
}
