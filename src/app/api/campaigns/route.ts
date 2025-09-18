import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { CampaignType, CampaignStatus, CampaignMetric } from '@prisma/client';

// Validation schema for creating campaigns
const createCampaignSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.nativeEnum(CampaignType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxParticipants: z.number().int().positive().optional(),
  entryFee: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  targetMetric: z.nativeEnum(CampaignMetric),
  targetValue: z.number().int().positive(),
  totalPrizePool: z.number().positive().default(0),
  hasDigitalPrizes: z.boolean().default(false),
  hasPhysicalPrizes: z.boolean().default(false),
  bannerImage: z.string().url().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  tags: z.array(z.string()).optional(),
});

const updateCampaignSchema = createCampaignSchema.partial();

// GET /api/campaigns - List campaigns
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') as CampaignStatus | null;
    const type = searchParams.get('type') as CampaignType | null;
    const artistId = searchParams.get('artistId');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (status) where.status = status;
    if (type) where.type = type;
    if (artistId) {
      where.artistId = artistId;
    } else if (session?.user?.id) {
      // Authenticated users can see their own campaigns or public active ones
      if (session.user.role === 'ADMIN') {
        // Admins can see all campaigns
      } else if (session.user.role === 'ARTIST') {
        // Artists can see their own campaigns or public active ones
        where.OR = [
          { artistId: session.user.id },
          { status: 'ACTIVE' }
        ];
      } else {
        // Fans can only see active campaigns
        where.status = 'ACTIVE';
      }
    } else {
      // Unauthenticated users can only see active campaigns
      where.status = 'ACTIVE';
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          artist: {
            select: { id: true, displayName: true, avatar: true }
          },
          challenges: {
            select: { id: true, title: true, status: true, participantCount: true }
          },
          _count: {
            select: { challenges: true, rewards: true }
          }
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    logger.error('Error fetching campaigns', {}, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create new campaign
export async function POST(request: NextRequest) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only artists can create campaigns
    if (session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Only artists can create campaigns' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createCampaignSchema.parse(body);

    // Validate date range
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);
    
    if (endDate <= startDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    if (startDate < new Date()) {
      return NextResponse.json({ error: 'Start date must be in the future' }, { status: 400 });
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        ...validatedData,
        artistId: session.user.id,
        startDate,
        endDate,
        tags: validatedData.tags ? JSON.stringify(validatedData.tags) : null,
      },
      include: {
        artist: {
          select: { id: true, displayName: true, avatar: true }
        },
        challenges: true,
        rewards: true,
      },
    });

    logger.info('Campaign created', {
      campaignId: campaign.id,
      artistId: session.user.id,
      title: campaign.title,
      type: campaign.type,
    });

    return NextResponse.json(campaign, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating campaign', { userId: session?.user?.id }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}