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

// GET /api/livestream - Get streams (public discovery or user's streams)
export async function GET(request: NextRequest) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const myStreamsOnly = searchParams.get('myStreams') === 'true';
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // If requesting user's own streams, require authentication
    if (myStreamsOnly && !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const where: any = {};
    
    // Filter by user's streams or public streams
    if (myStreamsOnly) {
      where.artistId = session.user.id;
    } else {
      // For public discovery, only show public streams
      where.isPublic = true;
    }

    // Add filters
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }
    
    // Add category filter (would need category field in schema)
    // For now, we'll skip category filtering
    
    // Add search filter
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } }
      ];
    }

    const streams = await prisma.live_streams.findMany({
      where,
      orderBy: {
        scheduledAt: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
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
          streamer: {
            id: stream.users.id,
            userName: stream.users.displayName, // Using displayName as username
            displayName: stream.users.displayName,
            avatar: stream.users.avatar,
            isVerified: false, // TODO: implement verification system
            isOnline: true, // TODO: implement online status
            followers: 0, // TODO: implement follower count
          },
          metadata: {
            currentViewers: 0, // TODO: implement real-time viewer count
            totalViews: stream.totalViewers || 0,
            duration: 0, // TODO: calculate stream duration
            totalDonations: stream.totalTips || 0,
            likes: 0, // TODO: implement likes system
            shares: 0, // TODO: implement shares system
            chatMessages: 0, // TODO: implement chat message count
            quality: ['720p'], // TODO: implement quality options
            maxQuality: '720p',
          },
          settings: {
            enableChat: true,
            enableDonations: true,
            chatModeration: 'moderate',
            subscribersOnly: false,
            isPrivate: !stream.isPublic,
          },
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
    
    // Check if it's a missing table error
    if (error instanceof Error && error.message.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        data: {
          streams: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
        },
        message: 'Streaming feature is being set up. Check back soon!'
      });
    }
    
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
    
    // Check if it's a missing table error
    if (error instanceof Error && error.message.includes('does not exist')) {
      return NextResponse.json(
        { success: false, error: { message: 'Streaming feature is being set up. Please try again later.' } },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
