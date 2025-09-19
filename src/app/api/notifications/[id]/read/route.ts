import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: {
    id: string;
  };
}

// POST /api/notifications/[id]/read - Mark notification as read
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationId = params.id;

    // Mark notification as read
    await notificationService.markAsRead(notificationId, session.user.id);

    logger.info('Notification marked as read', {
      notificationId,
      userId: session.user.id,
    });

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    logger.error(
      'Failed to mark notification as read',
      {
        notificationId: params.id,
      },
      error as Error
    );

    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
}
