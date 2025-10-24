import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/artist/content/schedule
 * Schedules content for future publication
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { contentId, scheduledFor, timezone = 'UTC' } = body;

    if (!contentId || !scheduledFor) {
      return NextResponse.json(
        { error: 'contentId and scheduledFor are required' },
        { status: 400 }
      );
    }

    // Validate future date
    const scheduledDate = new Date(scheduledFor);
    const now = new Date();

    if (scheduledDate <= now) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    // Verify content exists and belongs to artist
    const content = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if (content.artistId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if content is already published
    if (content.publishedAt) {
      return NextResponse.json(
        { error: 'Content is already published' },
        { status: 400 }
      );
    }

    // Update content
    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: {
        scheduledFor: scheduledDate,
        isScheduled: true,
        publishStatus: 'SCHEDULED',
      },
    });

    // Create or update scheduled publish record
    const scheduledPublish = await prisma.scheduled_publish.upsert({
      where: { contentId },
      create: {
        contentId,
        scheduledFor: scheduledDate,
        timezone,
      },
      update: {
        scheduledFor: scheduledDate,
        timezone,
        published: false,
        failedAt: null,
        error: null,
        retryCount: 0,
      },
    });

    logger.info('Content scheduled', {
      contentId,
      scheduledFor: scheduledDate.toISOString(),
      timezone,
      artistId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        content: updatedContent,
        schedule: scheduledPublish,
      },
    });
  } catch (error: any) {
    logger.error('Failed to schedule content', { error });
    return NextResponse.json(
      { error: 'Failed to schedule content' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/artist/content/schedule
 * Lists all scheduled content for the authenticated artist
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'pending' | 'published' | 'failed'

    const whereClause: any = {
      artistId: session.user.id,
      isScheduled: true,
    };

    // Add status filter if provided
    if (status === 'pending') {
      whereClause.publishStatus = 'SCHEDULED';
      whereClause.scheduledFor = { gte: new Date() };
    } else if (status === 'published') {
      whereClause.publishStatus = 'PUBLISHED';
    }

    const scheduledContent = await prisma.content.findMany({
      where: whereClause,
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

    return NextResponse.json({
      success: true,
      data: scheduledContent,
      count: scheduledContent.length,
    });
  } catch (error: any) {
    logger.error('Failed to get scheduled content', { error });
    return NextResponse.json(
      { error: 'Failed to get scheduled content' },
      { status: 500 }
    );
  }
}
