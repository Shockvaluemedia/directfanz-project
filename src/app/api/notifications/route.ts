import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// GET /api/notifications - Fetch user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
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

    return apiSuccess(result);
  } catch (error) {
    logger.error('Failed to fetch notifications', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch notifications');
  }
}

// POST /api/notifications - Create a new notification (for testing/admin use)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { type, title, message, channels, priority, data } = body;

    // Validate required fields
    if (!type || !title || !message) {
      return apiError('BAD_REQUEST', 'Missing required fields: type, title, message');
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

    return apiSuccess({
      id: notificationId,
      message: 'Notification sent successfully',
    });
  } catch (error) {
    logger.error('Failed to create notification', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to create notification');
  }
}
