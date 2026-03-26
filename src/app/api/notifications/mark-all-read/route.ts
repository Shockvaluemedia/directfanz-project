import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// POST /api/notifications/mark-all-read - Mark all notifications as read
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Mark all notifications as read
    await notificationService.markAllAsRead(session.user.id);

    logger.info('All notifications marked as read', {
      userId: session.user.id,
    });

    return apiSuccess({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Failed to mark all notifications as read', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to mark all notifications as read');
  }
}
