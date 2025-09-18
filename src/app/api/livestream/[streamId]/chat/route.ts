import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const sendMessageSchema = z.object({
  message: z.string().min(1).max(500),
  type: z.enum(['MESSAGE', 'JOIN', 'LEAVE', 'TIP', 'SYSTEM']).default('MESSAGE'),
  senderName: z.string().min(1).max(50).optional(),
});

// GET /api/livestream/[streamId]/chat - Get chat messages
export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const before = searchParams.get('before'); // Cursor for pagination

    // Verify stream exists and user has access
    const stream = await prisma.liveStream.findUnique({
      where: { id: params.streamId },
      select: {
        id: true,
        artistId: true,
        isPublic: true,
        tierIds: true,
        status: true,
      }
    });

    if (!stream) {
      return NextResponse.json(
        { success: false, error: { message: 'Stream not found' } },
        { status: 404 }
      );
    }

    // Check access for non-public streams
    if (!stream.isPublic && session?.user?.id) {
      const hasAccess = stream.artistId === session.user.id || 
                       await checkStreamAccess(session.user.id, stream);
      
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: { message: 'Access denied' } },
          { status: 403 }
        );
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

    const messages = await prisma.streamChatMessage.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            role: true,
          }
        }
      }
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
      sender: msg.sender ? {
        id: msg.sender.id,
        displayName: msg.sender.displayName,
        avatar: msg.sender.avatar,
        role: msg.sender.role,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        messages: formattedMessages,
        hasMore: messages.length === limit,
        cursor: messages.length > 0 ? messages[messages.length - 1].createdAt : null,
      }
    });

  } catch (error) {
    logger.error('Failed to fetch chat messages', { 
      streamId: params.streamId,
      userId: session?.user?.id 
    }, error as Error);
    
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// POST /api/livestream/[streamId]/chat - Send chat message
export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    const body = await request.json();
    const validatedData = sendMessageSchema.parse(body);

    // Verify stream exists and is live
    const stream = await prisma.liveStream.findUnique({
      where: { id: params.streamId },
      select: {
        id: true,
        artistId: true,
        isPublic: true,
        tierIds: true,
        status: true,
      }
    });

    if (!stream) {
      return NextResponse.json(
        { success: false, error: { message: 'Stream not found' } },
        { status: 404 }
      );
    }

    if (stream.status !== 'LIVE') {
      return NextResponse.json(
        { success: false, error: { message: 'Stream is not live' } },
        { status: 400 }
      );
    }

    // Check access for non-public streams
    if (!stream.isPublic && session?.user?.id) {
      const hasAccess = stream.artistId === session.user.id || 
                       await checkStreamAccess(session.user.id, stream);
      
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: { message: 'Access denied' } },
          { status: 403 }
        );
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
      const recentMessages = await prisma.streamChatMessage.count({
        where: {
          streamId: params.streamId,
          senderId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 1000), // Last 30 seconds
          }
        }
      });

      if (recentMessages >= 5) { // Max 5 messages per 30 seconds
        return NextResponse.json(
          { success: false, error: { message: 'Rate limit exceeded' } },
          { status: 429 }
        );
      }
    }

    // Create the message
    const message = await prisma.streamChatMessage.create({
      data: {
        streamId: params.streamId,
        senderId,
        senderName,
        message: validatedData.message,
        type: validatedData.type,
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            role: true,
          }
        }
      }
    });

    // Update stream message count
    await prisma.liveStream.update({
      where: { id: params.streamId },
      data: {
        totalMessages: {
          increment: 1,
        }
      }
    });

    const formattedMessage = {
      id: message.id,
      streamId: message.streamId,
      senderId: message.senderId,
      senderName: message.senderName,
      message: message.message,
      type: message.type,
      isHighlighted: message.isHighlighted,
      createdAt: message.createdAt,
      sender: message.sender ? {
        id: message.sender.id,
        displayName: message.sender.displayName,
        avatar: message.sender.avatar,
        role: message.sender.role,
      } : null,
    };

    logger.info('Chat message sent', {
      streamId: params.streamId,
      messageId: message.id,
      senderId,
      senderName,
    });

    return NextResponse.json({
      success: true,
      data: { message: formattedMessage }
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid message data', details: error.errors } },
        { status: 400 }
      );
    }

    logger.error('Failed to send chat message', { 
      streamId: params.streamId,
      userId: session?.user?.id 
    }, error as Error);
    
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// Helper function to check stream access (same as in stream route)
async function checkStreamAccess(userId: string, stream: any): Promise<boolean> {
  if (stream.isPublic) return true;

  const tierIds = JSON.parse(stream.tierIds || '[]');
  if (tierIds.length === 0) return true;

  // Check if user has subscription to any required tier
  const hasAccess = await prisma.subscription.findFirst({
    where: {
      fanId: userId,
      tierId: { in: tierIds },
      status: 'ACTIVE',
    }
  });

  return !!hasAccess;
}