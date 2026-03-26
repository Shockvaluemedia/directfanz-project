import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiCreated, apiError } from '@/lib/api-response';

const sendMessageSchema = z.object({
  message: z.string().min(1).max(500),
  type: z.enum(['MESSAGE', 'JOIN', 'LEAVE', 'TIP', 'SYSTEM']).default('MESSAGE'),
  senderName: z.string().min(1).max(50).optional(),
});

// GET /api/livestream/[streamId]/chat - Get chat messages
export async function GET(request: NextRequest, { params }: { params: { streamId: string } }) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const before = searchParams.get('before'); // Cursor for pagination

    // Verify stream exists and user has access
    const stream = await prisma.live_streams.findUnique({
      where: { id: params.streamId },
      select: {
        id: true,
        artistId: true,
        isPublic: true,
        tierIds: true,
        status: true,
      },
    });

    if (!stream) {
      return apiError('NOT_FOUND', 'Stream not found');
    }

    // Check access for non-public streams
    if (!stream.isPublic && session?.user?.id) {
      const hasAccess =
        stream.artistId === session.user.id || (await checkStreamAccess(session.user.id, stream));

      if (!hasAccess) {
        return apiError('FORBIDDEN', 'Access denied');
      }
    }

    const where: any = {
      streamId: params.streamId,
      isModerated: false, // Don't show moderated messages
    };

    if (before) {
      where.createdAt = {
        lt: new Date(before),
      };
    }

    const messages = await prisma.stream_chat_messages.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    // Reverse to show oldest first
    const formattedMessages = messages.reverse().map(msg => ({
      id: msg.id,
      streamId: msg.streamId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      message: msg.message,
      type: msg.type,
      isHighlighted: msg.isHighlighted,
      createdAt: msg.createdAt,
      sender: msg.users
        ? {
            id: msg.users.id,
            displayName: msg.users.displayName,
            avatar: msg.users.avatar,
            role: msg.users.role,
          }
        : null,
    }));

    return apiSuccess({
        messages: formattedMessages,
        hasMore: messages.length === limit,
        cursor: messages.length > 0 ? messages[messages.length - 1].createdAt : null,
      });
  } catch (error) {
    logger.error(
      'Failed to fetch chat messages',
      {
        streamId: params.streamId,
        userId: session?.user?.id,
      },
      error as Error
    );

    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}

// POST /api/livestream/[streamId]/chat - Send chat message
export async function POST(request: NextRequest, { params }: { params: { streamId: string } }) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    const body = await request.json();
    const validatedData = sendMessageSchema.parse(body);

    // Verify stream exists and is live
    const stream = await prisma.live_streams.findUnique({
      where: { id: params.streamId },
      select: {
        id: true,
        artistId: true,
        isPublic: true,
        tierIds: true,
        status: true,
      },
    });

    if (!stream) {
      return apiError('NOT_FOUND', 'Stream not found');
    }

    if (stream.status !== 'LIVE') {
      return apiError('BAD_REQUEST', 'Stream is not live');
    }

    // Check access for non-public streams
    if (!stream.isPublic && session?.user?.id) {
      const hasAccess =
        stream.artistId === session.user.id || (await checkStreamAccess(session.user.id, stream));

      if (!hasAccess) {
        return apiError('FORBIDDEN', 'Access denied');
      }
    }

    // Determine sender info
    let senderName = validatedData.senderName || 'Anonymous';
    let senderId: string | null = null;

    if (session?.user?.id) {
      senderId = session.user.id;
      senderName = session.user.displayName || session.user.name || 'User';
    }

    // Rate limiting: Check if user sent too many messages recently
    if (senderId) {
      const recentMessages = await prisma.stream_chat_messages.count({
        where: {
          streamId: params.streamId,
          senderId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 1000), // Last 30 seconds
          },
        },
      });

      if (recentMessages >= 5) {
        // Max 5 messages per 30 seconds
        return apiError('RATE_LIMITED', 'Rate limit exceeded');
      }
    }

    // Create the message
    const message = await prisma.stream_chat_messages.create({
      data: {
        id: crypto.randomUUID(),
        streamId: params.streamId,
        senderId,
        senderName,
        message: validatedData.message,
        type: validatedData.type,
      } as any,
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    // Update stream message count
    await prisma.live_streams.update({
      where: { id: params.streamId },
      data: {
        totalMessages: {
          increment: 1,
        },
      },
    });

    const messageWithUsers = message as any;
    const formattedMessage = {
      id: message.id,
      streamId: message.streamId,
      senderId: message.senderId,
      senderName: message.senderName,
      message: message.message,
      type: message.type,
      isHighlighted: message.isHighlighted,
      createdAt: message.createdAt,
      sender: messageWithUsers.users
        ? {
            id: messageWithUsers.users.id,
            displayName: messageWithUsers.users.displayName,
            avatar: messageWithUsers.users.avatar,
            role: messageWithUsers.users.role,
          }
        : null,
    };

    logger.info('Chat message sent', {
      streamId: params.streamId,
      messageId: message.id,
      senderId,
      senderName,
    });

    return apiCreated({ message: formattedMessage });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', 'Invalid message data', error.errors);
    }

    logger.error(
      'Failed to send chat message',
      {
        streamId: params.streamId,
        userId: session?.user?.id,
      },
      error as Error
    );

    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}

// Helper function to check stream access (same as in stream route)
async function checkStreamAccess(userId: string, stream: any): Promise<boolean> {
  if (stream.isPublic) return true;

  const tierIds = JSON.parse(stream.tierIds || '[]');
  if (tierIds.length === 0) return true;

  // Check if user has subscription to any required tier
  const hasAccess = await prisma.subscriptions.findFirst({
    where: {
      fanId: userId,
      tierId: { in: tierIds },
      status: 'ACTIVE',
    },
  });

  return !!hasAccess;
}
