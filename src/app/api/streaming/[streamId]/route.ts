import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    const { streamId } = params;

    const stream = await prisma.live_streams.findUnique({
      where: { id: streamId },
      include: { users: true }
    });

    if (!stream) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    if (stream.artistId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized for this stream' }, { status: 403 });
    }

    switch (action) {
      case 'start':
        if (stream.status !== 'SCHEDULED') {
          return NextResponse.json({ error: 'Stream already started' }, { status: 400 });
        }

        await prisma.live_streams.update({
          where: { id: streamId },
          data: {
            status: 'LIVE',
            startedAt: new Date()
          }
        });

        return NextResponse.json({
          status: 'LIVE',
          message: 'Stream started successfully',
          signalingUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || '/api/socket',
        });

      case 'stop':
        if (stream.status !== 'LIVE') {
          return NextResponse.json({ error: 'Stream not live' }, { status: 400 });
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

        return NextResponse.json({
          status: 'ENDED',
          message: 'Stream ended successfully',
          duration
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    logger.error('Stream action error', {}, error as Error);
    return NextResponse.json({ error: 'Stream action failed' }, { status: 500 });
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
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    return NextResponse.json({
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
    return NextResponse.json({ error: 'Failed to fetch stream' }, { status: 500 });
  }
}
