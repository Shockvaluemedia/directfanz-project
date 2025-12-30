import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MediaLiveClient, StartChannelCommand, StopChannelCommand } from '@aws-sdk/client-medialive';

const mediaLive = new MediaLiveClient({ region: process.env.AWS_REGION || 'us-east-1' });

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

    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      include: { streamer: true }
    });

    if (!stream) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    if (stream.streamerId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized for this stream' }, { status: 403 });
    }

    switch (action) {
      case 'start':
        if (stream.status !== 'SCHEDULED') {
          return NextResponse.json({ error: 'Stream already started' }, { status: 400 });
        }

        // Start MediaLive channel
        await mediaLive.send(new StartChannelCommand({
          ChannelId: `directfanz-${streamId}`
        }));

        // Update stream status
        await prisma.liveStream.update({
          where: { id: streamId },
          data: {
            status: 'LIVE',
            startedAt: new Date()
          }
        });

        return NextResponse.json({ 
          status: 'LIVE',
          message: 'Stream started successfully',
          playbackUrl: `https://${process.env.CLOUDFRONT_STREAMING_DOMAIN}/${streamId}/playlist.m3u8`
        });

      case 'stop':
        if (stream.status !== 'LIVE') {
          return NextResponse.json({ error: 'Stream not live' }, { status: 400 });
        }

        // Stop MediaLive channel
        await mediaLive.send(new StopChannelCommand({
          ChannelId: `directfanz-${streamId}`
        }));

        // Update stream status
        const endedStream = await prisma.liveStream.update({
          where: { id: streamId },
          data: {
            status: 'ENDED',
            endedAt: new Date()
          }
        });

        // Calculate duration
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
    console.error('Stream action error:', error);
    return NextResponse.json({ error: 'Stream action failed' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  try {
    const { streamId } = params;

    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      include: {
        streamer: {
          select: {
            id: true,
            userName: true,
            displayName: true,
            avatar: true,
            isVerified: true
          }
        },
        viewers: {
          select: {
            id: true,
            user: {
              select: {
                userName: true,
                displayName: true,
                avatar: true
              }
            },
            joinedAt: true
          }
        },
        chatMessages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: {
              select: {
                userName: true,
                displayName: true,
                avatar: true
              }
            }
          }
        },
        _count: {
          select: {
            viewers: true,
            chatMessages: true,
            likes: true
          }
        }
      }
    });

    if (!stream) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    const playbackUrl = stream.status === 'LIVE' 
      ? `https://${process.env.CLOUDFRONT_STREAMING_DOMAIN}/${streamId}/playlist.m3u8`
      : null;

    return NextResponse.json({
      ...stream,
      playbackUrl,
      metrics: {
        currentViewers: stream._count.viewers,
        totalMessages: stream._count.chatMessages,
        totalLikes: stream._count.likes,
        duration: stream.startedAt && stream.endedAt 
          ? stream.endedAt.getTime() - stream.startedAt.getTime()
          : stream.startedAt 
          ? Date.now() - stream.startedAt.getTime()
          : 0
      }
    });

  } catch (error) {
    console.error('Stream fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stream' }, { status: 500 });
  }
}