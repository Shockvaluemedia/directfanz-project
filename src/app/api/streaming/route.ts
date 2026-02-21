// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
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

    // Create stream record
    const stream = await prisma.liveStream.create({
      data: {
        title: title.trim(),
        description: description?.trim(),
        category,
        streamerId: user.id,
        status: 'SCHEDULED',
        settings: {
          enableChat: true,
          enableDonations: true,
          quality: ['480p', '720p', '1080p']
        }
      }
    });

    // Generate stream key for WebRTC signaling
    const streamKey = `${stream.id}_${uuidv4()}`;

    await prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        streamKey,
        settings: {
          ...stream.settings,
          streamKey
        }
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
    console.error('Stream creation error:', error);
    return NextResponse.json({ error: 'Failed to create stream' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'LIVE';

    const streams = await prisma.liveStream.findMany({
      where: { status },
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
        _count: {
          select: {
            viewers: true,
            chatMessages: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json({ streams });

  } catch (error) {
    console.error('Stream fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch streams' }, { status: 500 });
  }
}
