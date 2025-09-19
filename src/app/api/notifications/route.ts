import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import { logger } from '@/lib/logger';

// GET /api/notifications - Fetch user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get notifications
    const result = await notificationService.getUserNotifications(
      session.user.id,
      limit,
      offset,
      filter === 'unread' || unreadOnly
    );

    logger.info('Notifications fetched', {
      userId: session.user.id,
      filter,
      count: result.notifications.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to fetch notifications', {}, error as Error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST /api/notifications - Create a new notification (for testing/admin use)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, title, message, channels, priority, data } = body;

    // Validate required fields
    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, message' },
        { status: 400 }
      );
    }

    // Send notification
    const notificationData = {
      userId: session.user.id,
      type,
      title,
      message,
      channels: channels || ['in_app'],
      priority: priority || 'medium',
      data: data || {},
    };

    const notificationId = await notificationService.send(notificationData);

    logger.info('Notification created', {
      notificationId,
      userId: session.user.id,
      type,
    });

    return NextResponse.json({
      id: notificationId,
      message: 'Notification sent successfully',
    });
  } catch (error) {
    logger.error('Failed to create notification', {}, error as Error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
