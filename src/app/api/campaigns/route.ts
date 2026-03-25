import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { CampaignType, CampaignStatus, CampaignMetric } from '@/lib/types/enums';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.string().optional(),
  type: z.string().optional(),
  artistId: z.string().optional(),
  search: z.string().optional(),
});

const createCampaignSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.nativeEnum(CampaignType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxParticipants: z.number().int().positive().optional(),
  entryFee: z.number().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  targetMetric: z.nativeEnum(CampaignMetric),
  targetValue: z.number().int().positive(),
  totalPrizePool: z.number().min(0).default(0),
  hasDigitalPrizes: z.boolean().default(false),
  hasPhysicalPrizes: z.boolean().default(false),
  bannerImage: z.string().url().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
  tags: z.array(z.string()).optional(),
});

// GET /api/campaigns — list campaigns with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      artistId: searchParams.get('artistId') || undefined,
      search: searchParams.get('search') || undefined,
    });

    const where: any = {};

    // By default, only show active/completed campaigns to non-owners
    const session = await getServerSession(authOptions);
    if (query.artistId && query.artistId === session?.user?.id) {
      // Artist viewing own campaigns — show all statuses
      where.artistId = query.artistId;
    } else if (query.status) {
      where.status = query.status;
    } else {
      where.status = { in: ['ACTIVE', 'COMPLETED'] };
    }

    if (query.type) where.type = query.type;
    if (query.artistId && query.artistId !== session?.user?.id) {
      where.artistId = query.artistId;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;

    const [campaigns, total] = await Promise.all([
      prisma.campaigns.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              challenges: true,
              campaign_rewards: true,
            },
          },
        },
      }),
      prisma.campaigns.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      campaigns: campaigns.map(c => ({
        ...c,
        tags: c.tags ? JSON.parse(c.tags) : [],
      })),
      total,
      page: query.page,
      totalPages: Math.ceil(total / query.limit),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Error listing campaigns', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns — create a new campaign
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only artists and admins can create campaigns
    if (!['ARTIST', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Only artists can create campaigns' }, { status: 403 });
    }

    const body = await request.json();
    const data = createCampaignSchema.parse(body);

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const campaign = await prisma.campaigns.create({
      data: {
        id: crypto.randomUUID(),
        artistId: session.user.id,
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        status: 'DRAFT',
        startDate,
        endDate,
        maxParticipants: data.maxParticipants ?? null,
        entryFee: data.entryFee ?? null,
        currency: data.currency,
        targetMetric: data.targetMetric,
        targetValue: data.targetValue,
        totalPrizePool: data.totalPrizePool,
        hasDigitalPrizes: data.hasDigitalPrizes,
        hasPhysicalPrizes: data.hasPhysicalPrizes,
        bannerImage: data.bannerImage ?? null,
        brandColor: data.brandColor,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        updatedAt: new Date(),
      },
      include: {
        users: {
          select: { id: true, displayName: true, avatar: true },
        },
        _count: {
          select: { challenges: true, campaign_rewards: true },
        },
      },
    });

    logger.info('Campaign created', {
      campaignId: campaign.id,
      artistId: session.user.id,
      title: data.title,
    });

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        tags: campaign.tags ? JSON.parse(campaign.tags) : [],
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Error creating campaign', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
