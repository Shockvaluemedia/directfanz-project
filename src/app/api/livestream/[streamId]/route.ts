import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const updateStreamSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
  isRecorded: z.boolean().optional(),
  tierIds: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  requiresPayment: z.boolean().optional(),
  paymentAmount: z.number().min(0).optional(),
  maxViewers: z.number().min(1).max(10000).optional(),
  status: z.enum(['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED']).optional(),
});

// GET /api/livestream/[streamId] - Get specific stream
export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const stream = await prisma.liveStream.findUnique({
      where: {
        id: params.streamId,
      },
      include: {
        artist: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          }
        },
        viewers: {
          include: {
            viewer: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              }
            }
          },
          where: {
            leftAt: null, // Currently viewing
          }
        },
        _count: {
          select: {
            viewers: true,
            chatMessages: true,
            tips: true,
            polls: true,
          }
        }
      }
    });

    if (!stream) {
      return NextResponse.json(
        { success: false, error: { message: 'Stream not found' } },
        { status: 404 }
      );
    }

    // Check access permissions
    const canView = stream.isPublic || 
                   stream.artistId === session.user.id ||
                   await checkStreamAccess(session.user.id, stream);

    if (!canView) {
      return NextResponse.json(
        { success: false, error: { message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Don't expose stream key to non-owners
    const responseStream = {
      ...stream,
      tierIds: JSON.parse(stream.tierIds),
      streamKey: stream.artistId === session.user.id ? stream.streamKey : undefined,
      currentViewers: stream.viewers,
      stats: {
        totalViewers: stream._count.viewers,
        totalMessages: stream._count.chatMessages,
        totalTips: stream._count.tips,
        totalPolls: stream._count.polls,
      }
    };

    return NextResponse.json({
      success: true,
      data: { stream: responseStream }
    });

  } catch (error) {
    logger.error('Failed to fetch livestream', { 
      streamId: params.streamId,
      userId: session?.user?.id 
    }, error as Error);
    
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/livestream/[streamId] - Update stream
export async function PUT(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Check if user owns this stream
    const existingStream = await prisma.liveStream.findUnique({
      where: {
        id: params.streamId,
        artistId: session.user.id,
      }
    });

    if (!existingStream) {
      return NextResponse.json(
        { success: false, error: { message: 'Stream not found or access denied' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateStreamSchema.parse(body);

    // Validate tier access if updating tiers
    if (validatedData.tierIds && validatedData.tierIds.length > 0) {
      const validTiers = await prisma.tier.findMany({
        where: {
          id: { in: validatedData.tierIds },
          artistId: session.user.id,
          isActive: true,
        }
      });

      if (validTiers.length !== validatedData.tierIds.length) {
        return NextResponse.json(
          { success: false, error: { message: 'Invalid tier selection' } },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.scheduledAt !== undefined) updateData.scheduledAt = new Date(validatedData.scheduledAt);
    if (validatedData.isRecorded !== undefined) updateData.isRecorded = validatedData.isRecorded;
    if (validatedData.tierIds !== undefined) updateData.tierIds = JSON.stringify(validatedData.tierIds);
    if (validatedData.isPublic !== undefined) updateData.isPublic = validatedData.isPublic;
    if (validatedData.requiresPayment !== undefined) updateData.requiresPayment = validatedData.requiresPayment;
    if (validatedData.paymentAmount !== undefined) updateData.paymentAmount = validatedData.paymentAmount;
    if (validatedData.maxViewers !== undefined) updateData.maxViewers = validatedData.maxViewers;
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
      
      // Update timestamps based on status
      if (validatedData.status === 'LIVE' && !existingStream.startedAt) {
        updateData.startedAt = new Date();
      } else if (validatedData.status === 'ENDED' && !existingStream.endedAt) {
        updateData.endedAt = new Date();
      }
    }

    const updatedStream = await prisma.liveStream.update({
      where: {
        id: params.streamId,
      },
      data: updateData,
    });

    logger.info('Livestream updated', {
      streamId: params.streamId,
      artistId: session.user.id,
      changes: Object.keys(updateData),
    });

    return NextResponse.json({
      success: true,
      data: {
        stream: {
          ...updatedStream,
          tierIds: JSON.parse(updatedStream.tierIds),
        }
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid request data', details: error.errors } },
        { status: 400 }
      );
    }

    logger.error('Failed to update livestream', { 
      streamId: params.streamId,
      userId: session?.user?.id 
    }, error as Error);
    
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// DELETE /api/livestream/[streamId] - Delete stream
export async function DELETE(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Check if user owns this stream and it's not currently live
    const existingStream = await prisma.liveStream.findUnique({
      where: {
        id: params.streamId,
        artistId: session.user.id,
      }
    });

    if (!existingStream) {
      return NextResponse.json(
        { success: false, error: { message: 'Stream not found or access denied' } },
        { status: 404 }
      );
    }

    if (existingStream.status === 'LIVE') {
      return NextResponse.json(
        { success: false, error: { message: 'Cannot delete a live stream' } },
        { status: 400 }
      );
    }

    await prisma.liveStream.delete({
      where: {
        id: params.streamId,
      }
    });

    logger.info('Livestream deleted', {
      streamId: params.streamId,
      artistId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Stream deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete livestream', { 
      streamId: params.streamId,
      userId: session?.user?.id 
    }, error as Error);
    
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// Helper function to check stream access
async function checkStreamAccess(userId: string, stream: any): Promise<boolean> {
  if (stream.isPublic) return true;

  const tierIds = JSON.parse(stream.tierIds);
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