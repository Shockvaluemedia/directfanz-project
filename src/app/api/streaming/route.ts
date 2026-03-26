import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true }
    });

    if (user?.role !== 'ARTIST') {
      return apiError('FORBIDDEN', 'Only artists can create streams');
    }

    const { title, description, category = 'Music' } = await request.json();

    if (!title?.trim()) {
      return apiError('BAD_REQUEST', 'Stream title required');
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

    return apiSuccess({
      streamId: stream.id,
      title: stream.title,
      streamKey,
      status: 'SCHEDULED',
      signalingUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || '/api/socket',
    });

  } catch (error) {
    logger.error('Stream creation error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to create stream');
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

    return apiSuccess({ streams });

  } catch (error) {
    logger.error('Stream fetch error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch streams');
  }
}
