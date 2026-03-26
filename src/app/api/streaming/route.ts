import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true }
    });

    if (user?.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Only artists can create streams' }, { status: 403 });
    }

    const { title, description, category = 'Music' } = await request.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Stream title required' }, { status: 400 });
    }

    // Generate stream key for WebRTC signaling
    const streamKey = `${uuidv4()}`;

    // Create stream record
    const stream = await prisma.live_streams.create({
      data: {
        id: uuidv4(),
        title: title.trim(),
        description: description?.trim(),
        artistId: user.id,
        status: 'SCHEDULED',
        streamKey,
        tierIds: '[]',
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({
      streamId: stream.id,
      title: stream.title,
      streamKey,
      status: 'SCHEDULED',
      signalingUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || '/api/socket',
    });

  } catch (error) {
    logger.error('Stream creation error', {}, error as Error);
    return NextResponse.json({ error: 'Failed to create stream' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'LIVE';

    const streams = await prisma.live_streams.findMany({
      where: { status },
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          }
        },
        _count: {
          select: {
            stream_viewers: true,
            stream_chat_messages: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json({ streams });

  } catch (error) {
    logger.error('Stream fetch error', {}, error as Error);
    return NextResponse.json({ error: 'Failed to fetch streams' }, { status: 500 });
  }
}
