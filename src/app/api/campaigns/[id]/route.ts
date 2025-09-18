import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { CampaignType, CampaignStatus, CampaignMetric } from '@prisma/client';

const updateCampaignSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  type: z.nativeEnum(CampaignType).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  maxParticipants: z.number().int().positive().optional(),
  entryFee: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  targetMetric: z.nativeEnum(CampaignMetric).optional(),
  targetValue: z.number().int().positive().optional(),
  totalPrizePool: z.number().positive().optional(),
  hasDigitalPrizes: z.boolean().optional(),
  hasPhysicalPrizes: z.boolean().optional(),
  bannerImage: z.string().url().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/campaigns/[id] - Get single campaign
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        artist: {
          select: { 
            id: true, 
            displayName: true, 
            avatar: true, 
            artistProfile: {
              select: { isStripeOnboarded: true }
            }
          }
        },
        challenges: {
          select: { 
            id: true, 
            title: true, 
            description: true,
            type: true,
            status: true, 
            participantCount: true, 
            submissionCount: true,
            startDate: true,
            endDate: true,
            maxScore: true
          }
        },
        rewards: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            value: true,
            currency: true,
            quantity: true,
            rankRequirement: true,
            scoreRequirement: true,
            isActive: true
          }
        },
        _count: {
          select: { 
            challenges: true, 
            rewards: true 
          }
        }
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check if user can access this campaign
    const canAccess = 
      campaign.status === 'ACTIVE' ||  // Public active campaigns
      campaign.artistId === session?.user?.id ||  // Artist owns campaign
      session?.user?.role === 'ADMIN';  // Admin access

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Add user-specific participation data if authenticated
    let userParticipation = null;
    if (session?.user?.id && campaign.status === 'ACTIVE') {
      const participation = await prisma.challengeParticipation.findFirst({
        where: {
          participantId: session.user.id,
          challenge: {
            campaignId: campaign.id
          }
        },
        include: {
          submissions: {
            select: {
              id: true,
              title: true,
              status: true,
              reviewStatus: true,
              totalScore: true,
              submittedAt: true
            }
          }
        }
      });

      if (participation) {
        userParticipation = {
          isParticipating: true,
          status: participation.status,
          currentScore: participation.currentScore,
          submissionCount: participation.submissionCount,
          rank: participation.rank,
          submissions: participation.submissions
        };
      }
    }

    return NextResponse.json({
      ...campaign,
      tags: campaign.tags ? JSON.parse(campaign.tags) : [],
      userParticipation
    });

  } catch (error) {
    logger.error('Error fetching campaign', { campaignId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/campaigns/[id] - Update campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if campaign exists and user owns it
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      select: { artistId: true, status: true }
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (existingCampaign.artistId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateCampaignSchema.parse(body);

    // Additional validation for date changes
    if (validatedData.startDate && validatedData.endDate) {
      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);
      
      if (endDate <= startDate) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
      }
    }

    // Don't allow certain changes if campaign is already active
    if (existingCampaign.status === 'ACTIVE') {
      const restrictedFields = ['startDate', 'endDate', 'type', 'targetMetric', 'targetValue'];
      const hasRestrictedChanges = restrictedFields.some(field => validatedData[field as keyof typeof validatedData] !== undefined);
      
      if (hasRestrictedChanges && session.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Cannot modify core campaign details while active' },
          { status: 400 }
        );
      }
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(() => {
          const { tags, startDate, endDate, ...rest } = validatedData;
          return rest;
        })(),
        ...(validatedData.startDate && { startDate: new Date(validatedData.startDate) }),
        ...(validatedData.endDate && { endDate: new Date(validatedData.endDate) }),
        ...(validatedData.tags && { tags: JSON.stringify(validatedData.tags) }),
      },
      include: {
        artist: {
          select: { id: true, displayName: true, avatar: true }
        },
        challenges: {
          select: { 
            id: true, 
            title: true, 
            status: true, 
            participantCount: true 
          }
        },
        rewards: {
          select: {
            id: true,
            title: true,
            type: true,
            value: true,
            currency: true
          }
        },
        _count: {
          select: { challenges: true, rewards: true }
        }
      },
    });

    logger.info('Campaign updated', {
      campaignId: id,
      artistId: session.user.id,
      updatedFields: Object.keys(validatedData)
    });

    return NextResponse.json({
      ...updatedCampaign,
      tags: updatedCampaign.tags ? JSON.parse(updatedCampaign.tags) : []
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error updating campaign', { campaignId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[id] - Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if campaign exists and user owns it
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      select: { artistId: true, status: true, totalParticipants: true }
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (existingCampaign.artistId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Don't allow deletion if campaign has participants
    if (existingCampaign.totalParticipants > 0) {
      return NextResponse.json(
        { error: 'Cannot delete campaign with participants' },
        { status: 400 }
      );
    }

    // Only allow deletion if campaign is in DRAFT or CANCELLED status
    if (!['DRAFT', 'CANCELLED'].includes(existingCampaign.status)) {
      return NextResponse.json(
        { error: 'Can only delete campaigns in draft or cancelled status' },
        { status: 400 }
      );
    }

    await prisma.campaign.delete({
      where: { id }
    });

    logger.info('Campaign deleted', {
      campaignId: id,
      artistId: session.user.id
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error('Error deleting campaign', { campaignId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}