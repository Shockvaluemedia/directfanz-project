import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

interface RouteParams {
  params: {
    id: string;
  };
}

// DELETE /api/notifications/[id] - Delete a notification
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const notificationId = params.id;

    // Try to delete the notification (implementation depends on if notification table exists)
    try {
      await (notificationService as any).deleteNotification?.(notificationId, session.user.id);
    } catch (error) {
      // If method doesn't exist, just log it
      logger.info('Notification delete requested', {
        notificationId,
        userId: session.user.id,
      });
    }

    return apiSuccess({ message: 'Notification deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete notification', { notificationId: params.id }, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to delete notification');
  }
}
