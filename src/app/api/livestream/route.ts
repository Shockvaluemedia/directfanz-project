import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { generateSecureToken } from '@/lib/security';
import { logger } from '@/lib/logger';

// Validation schemas
const createStreamSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
  isRecorded: z.boolean().default(false),
  tierIds: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  requiresPayment: z.boolean().default(false),
  paymentAmount: z.number().min(0).optional(),
  maxViewers: z.number().min(1).max(10000).default(1000),
});

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
});

// GET /api/livestream - Get user's streams
export async function GET(request: NextRequest) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {
      artistId: session.user.id,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    const streams = await prisma.live_streams.findMany({
      where,
      orderBy: {
        scheduledAt: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            viewers: true,
            chatMessages: true,
            tips: true,
          },
        },
      },
    });

    const total = await prisma.live_streams.count({ where });

    return NextResponse.json({
      success: true,
      data: {
        streams: streams.map(stream => ({
          ...stream,
          tierIds: JSON.parse(stream.tierIds),
          totalViewers: stream._count.viewers,
          totalMessages: stream._count.chatMessages,
          totalTips: stream._count.tips,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch livestreams', { userId: session?.user?.id }, error as Error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// POST /api/livestream - Create new stream
export async function POST(request: NextRequest) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Check if user is an artist
    const artist = await prisma.users.findFirst({
      where: {
        id: session.user.id,
        role: 'ARTIST',
      },
    });

    if (!artist) {
      return NextResponse.json(
        { success: false, error: { message: 'Only artists can create streams' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createStreamSchema.parse(body);

    // Generate unique stream key
    const streamKey = generateSecureToken(32);

    // Validate tier access
    if (validatedData.tierIds.length > 0) {
      const validTiers = await prisma.tiers.findMany({
        where: {
          id: { in: validatedData.tierIds },
          artistId: session.user.id,
          isActive: true,
        },
      });

      if (validTiers.length !== validatedData.tierIds.length) {
        return NextResponse.json(
          { success: false, error: { message: 'Invalid tier selection' } },
          { status: 400 }
        );
      }
    }

    const stream = await prisma.live_streams.create({
      data: {
        artistId: session.user.id,
        title: validatedData.title,
        description: validatedData.description,
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        isRecorded: validatedData.isRecorded,
        tierIds: JSON.stringify(validatedData.tierIds),
        isPublic: validatedData.isPublic,
        requiresPayment: validatedData.requiresPayment,
        paymentAmount: validatedData.paymentAmount,
        maxViewers: validatedData.maxViewers,
        streamKey,
        status: validatedData.scheduledAt ? 'SCHEDULED' : 'LIVE',
      },
    });

    logger.info('Livestream created', {
      streamId: stream.id,
      artistId: session.user.id,
      title: stream.title,
      isPublic: stream.isPublic,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          stream: {
            ...stream,
            tierIds: JSON.parse(stream.tierIds),
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid request data', details: error.errors } },
        { status: 400 }
      );
    }

    logger.error('Failed to create livestream', { userId: session?.user?.id }, error as Error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
