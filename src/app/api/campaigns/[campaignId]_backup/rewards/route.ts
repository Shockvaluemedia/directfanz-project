import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { RewardType } from '@prisma/client';

// Validation schema for creating rewards
const createRewardSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.nativeEnum(RewardType),
  value: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  quantity: z.number().int().positive().default(1),
  contentId: z.string().optional(),
  accessDays: z.number().int().positive().optional(),
  tierAccess: z.array(z.string()).optional(),
  shippingRequired: z.boolean().default(false),
  estimatedValue: z.number().positive().optional(),
  supplier: z.string().optional(),
  rankRequirement: z.number().int().positive().optional(),
  scoreRequirement: z.number().int().positive().optional(),
  participationRequirement: z.boolean().default(false),
});

// GET /api/campaigns/[campaignId]/rewards - List rewards for campaign
export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  let session;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if campaign exists and user has access
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      select: { artistId: true, status: true }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check access permissions
    const hasAccess = 
      campaign.artistId === session.user.id ||
      session.user.role === 'ADMIN' ||
      campaign.status === 'ACTIVE';

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as RewardType | null;
    const activeOnly = searchParams.get('active') === 'true';

    // Build where clause
    const where: any = { campaignId: params.campaignId };
    if (type) where.type = type;
    if (activeOnly) where.isActive = true;

    const rewards = await prisma.campaignReward.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        content: {
          select: { id: true, title: true, thumbnailUrl: true, type: true }
        },
        distributions: {
          select: { 
            id: true, 
            status: true, 
            awardedAt: true,
            user: {
              select: { id: true, displayName: true, avatar: true }
            }
          },
          orderBy: { awardedAt: 'desc' },
          take: 5
        },
        _count: {
          select: { distributions: true }
        }
      }
    });

    // Parse tier access arrays
    const rewardsWithParsedData = rewards.map(reward => ({
      ...reward,
      tierAccess: reward.tierAccess ? JSON.parse(reward.tierAccess) : []
    }));

    return NextResponse.json({ rewards: rewardsWithParsedData });

  } catch (error) {
    logger.error('Error fetching campaign rewards', { 
      campaignId: params.campaignId,
      userId: session?.user?.id 
    }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/[campaignId]/rewards - Create new reward
export async function POST(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  let session;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if campaign exists and user owns it
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      select: { artistId: true, status: true }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check ownership
    if (campaign.artistId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createRewardSchema.parse(body);

    // Validate content exists if contentId provided
    if (validatedData.contentId) {
      const content = await prisma.content.findUnique({
        where: { id: validatedData.contentId },
        select: { artistId: true }
      });

      if (!content || content.artistId !== session.user.id) {
        return NextResponse.json({ error: 'Content not found or access denied' }, { status: 400 });
      }
    }

    // Create reward
    const reward = await prisma.$transaction(async (tx) => {
      const newReward = await tx.campaignReward.create({
        data: {
          ...validatedData,
          campaignId: params.campaignId,
          tierAccess: validatedData.tierAccess ? JSON.stringify(validatedData.tierAccess) : null,
          remainingQuantity: validatedData.quantity,
        },
        include: {
          content: {
            select: { id: true, title: true, thumbnailUrl: true, type: true }
          },
          _count: {
            select: { distributions: true }
          }
        }
      });

      // Update campaign prize pool if reward has a value
      if (validatedData.value) {
        await tx.campaign.update({
          where: { id: params.campaignId },
          data: {
            totalPrizePool: { increment: validatedData.value * validatedData.quantity },
            hasDigitalPrizes: validatedData.type === 'EXCLUSIVE_CONTENT' || validatedData.type === 'TIER_ACCESS',
            hasPhysicalPrizes: validatedData.shippingRequired,
          }
        });
      }

      return newReward;
    });

    logger.info('Campaign reward created', {
      rewardId: reward.id,
      campaignId: params.campaignId,
      artistId: session.user.id,
      type: reward.type,
      value: reward.value,
    });

    return NextResponse.json({
      ...reward,
      tierAccess: reward.tierAccess ? JSON.parse(reward.tierAccess) : []
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating campaign reward', { 
      campaignId: params.campaignId,
      userId: session?.user?.id 
    }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}