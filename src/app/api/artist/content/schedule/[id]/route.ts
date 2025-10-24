import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * PUT /api/artist/content/schedule/[id]
 * Updates scheduled content (reschedule)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentId = params.id;
    const body = await req.json();
    const { scheduledFor, timezone } = body;

    if (!scheduledFor) {
      return NextResponse.json(
        { error: 'scheduledFor is required' },
        { status: 400 }
      );
    }

    // Validate future date
    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
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

    // Verify content is scheduled
    if (!content.isScheduled || content.publishStatus !== 'SCHEDULED') {
      return NextResponse.json(
        { error: 'Content is not scheduled' },
        { status: 400 }
      );
    }

    // Update content
    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: {
        scheduledFor: scheduledDate,
      },
    });

    // Update scheduled publish record
    await prisma.scheduled_publish.update({
      where: { contentId },
      data: {
        scheduledFor: scheduledDate,
        ...(timezone && { timezone }),
      },
    });

    logger.info('Content rescheduled', {
      contentId,
      newScheduledFor: scheduledDate.toISOString(),
      artistId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: updatedContent,
    });
  } catch (error: any) {
    logger.error('Failed to update scheduled content', { error });
    return NextResponse.json(
      { error: 'Failed to update scheduled content' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/artist/content/schedule/[id]
 * Cancels scheduled content (unschedules and optionally deletes)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentId = params.id;
    const { searchParams } = new URL(req.url);
    const deleteContent = searchParams.get('delete') === 'true';

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

    if (deleteContent) {
      // Delete the content entirely (cascade will delete scheduled_publish)
      await prisma.content.delete({
        where: { id: contentId },
      });

      logger.info('Scheduled content deleted', {
        contentId,
        artistId: session.user.id,
      });

      return NextResponse.json({
        success: true,
        message: 'Content deleted',
      });
    } else {
      // Just unschedule (convert to draft)
      await prisma.content.update({
        where: { id: contentId },
        data: {
          scheduledFor: null,
          isScheduled: false,
          publishStatus: 'DRAFT',
        },
      });

      // Delete scheduled publish record
      await prisma.scheduled_publish.delete({
        where: { contentId },
      });

      logger.info('Content unscheduled', {
        contentId,
        artistId: session.user.id,
      });

      return NextResponse.json({
        success: true,
        message: 'Content unscheduled',
      });
    }
  } catch (error: any) {
    logger.error('Failed to cancel scheduled content', { error });
    return NextResponse.json(
      { error: 'Failed to cancel scheduled content' },
      { status: 500 }
    );
  }
}
