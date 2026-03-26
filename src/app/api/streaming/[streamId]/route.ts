import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const { action } = await request.json();
    const { streamId } = params;

    const stream = await prisma.live_streams.findUnique({
      where: { id: streamId },
      include: { users: true }
    });

    if (!stream) {
      return apiError('NOT_FOUND', 'Stream not found');
    }

    if (stream.artistId !== session.user.id) {
      return apiError('FORBIDDEN', 'Not authorized for this stream');
    }

    switch (action) {
      case 'start':
        if (stream.status !== 'SCHEDULED') {
          return apiError('BAD_REQUEST', 'Stream already started');
        }

        await prisma.live_streams.update({
          where: { id: streamId },
          data: {
            status: 'LIVE',
            startedAt: new Date()
          }
        });

        return apiSuccess({
          status: 'LIVE',
          message: 'Stream started successfully',
          signalingUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || '/api/socket',
        });

      case 'stop':
        if (stream.status !== 'LIVE') {
          return apiError('BAD_REQUEST', 'Stream not live');
        }

        const endedStream = await prisma.live_streams.update({
          where: { id: streamId },
          data: {
            status: 'ENDED',
            endedAt: new Date()
          }
        });

        const duration = endedStream.endedAt && endedStream.startedAt
          ? endedStream.endedAt.getTime() - endedStream.startedAt.getTime()
          : 0;

        return apiSuccess({
          status: 'ENDED',
          message: 'Stream ended successfully',
          duration
        });

      default:
        return apiError('BAD_REQUEST', 'Invalid action');
    }

  } catch (error) {
    logger.error('Stream action error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Stream action failed');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  try {
    const { streamId } = params;

    const stream = await prisma.live_streams.findUnique({
      where: { id: streamId },
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          }
        },
        stream_viewers: {
          select: {
            id: true,
            users: {
              select: {
                displayName: true,
                avatar: true
              }
            },
            joinedAt: true
          }
        },
        stream_chat_messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            users: {
              select: {
                displayName: true,
                avatar: true
              }
            }
          }
        },
        _count: {
          select: {
            stream_viewers: true,
            stream_chat_messages: true,
            stream_tips: true
          }
        }
      }
    });

    if (!stream) {
      return apiError('NOT_FOUND', 'Stream not found');
    }

    return apiSuccess({
      ...stream,
      signalingUrl: stream.status === 'LIVE'
        ? (process.env.NEXT_PUBLIC_WEBSOCKET_URL || '/api/socket')
        : null,
      metrics: {
        currentViewers: stream._count.stream_viewers,
        totalMessages: stream._count.stream_chat_messages,
        totalTips: stream._count.stream_tips,
        duration: stream.startedAt && stream.endedAt
          ? stream.endedAt.getTime() - stream.startedAt.getTime()
          : stream.startedAt
          ? Date.now() - stream.startedAt.getTime()
          : 0
      }
    });

  } catch (error) {
    logger.error('Stream fetch error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch stream');
  }
}
