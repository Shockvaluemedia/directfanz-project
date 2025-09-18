import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { CampaignStatus } from '@prisma/client';

const updateCampaignSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  entryFee: z.number().positive().nullable().optional(),
  targetValue: z.number().int().positive().optional(),
  totalPrizePool: z.number().positive().optional(),
  hasDigitalPrizes: z.boolean().optional(),
  hasPhysicalPrizes: z.boolean().optional(),
  bannerImage: z.string().url().nullable().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
});

// GET /api/campaigns/[campaignId] - Get single campaign
export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      include: {
        artist: {
          select: { id: true, displayName: true, avatar: true }
        },
        challenges: {
          include: {
            _count: {
              select: { participations: true, submissions: true }
            }
          }
        },
        rewards: {
          include: {
            content: {
              select: { id: true, title: true, thumbnailUrl: true }
            }
          }
        },
        analytics: {
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          orderBy: { date: 'desc' },
          take: 30
        },
        _count: {
          select: { challenges: true, rewards: true }
        }
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check access permissions
    if (
      campaign.artistId !== session.user.id &&
      session.user.role !== 'ADMIN' &&
      !(campaign.status === 'ACTIVE') // Add public visibility check if needed
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse tags from JSON
    const campaignWithParsedTags = {
      ...campaign,
      tags: campaign.tags ? JSON.parse(campaign.tags) : []
    };

    return NextResponse.json(campaignWithParsedTags);

  } catch (error) {
    logger.error('Error fetching campaign', { campaignId: params.campaignId }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/campaigns/[campaignId] - Update campaign
export async function PATCH(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  let session;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const validatedData = updateCampaignSchema.parse(body);

    // Validate date changes if provided
    if (validatedData.startDate || validatedData.endDate) {
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: params.campaignId },
        select: { startDate: true, endDate: true, status: true }
      });

      const startDate = validatedData.startDate 
        ? new Date(validatedData.startDate) 
        : currentCampaign!.startDate;
      const endDate = validatedData.endDate 
        ? new Date(validatedData.endDate) 
        : currentCampaign!.endDate;

      if (endDate <= startDate) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
      }

      // Don't allow changing dates of active campaigns
      if (currentCampaign!.status === 'ACTIVE' && (validatedData.startDate || validatedData.endDate)) {
        return NextResponse.json({ error: 'Cannot change dates of active campaigns' }, { status: 400 });
      }
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: params.campaignId },
      data: {
        ...(() => {
          const { tags, startDate, endDate, ...rest } = validatedData;
          return rest;
        })(),
        ...(validatedData.startDate && { startDate: new Date(validatedData.startDate) }),
        ...(validatedData.endDate && { endDate: new Date(validatedData.endDate) }),
        ...(validatedData.tags && { tags: JSON.stringify(validatedData.tags) }),
        updatedAt: new Date(),
      },
      include: {
        artist: {
          select: { id: true, displayName: true, avatar: true }
        },
        challenges: {
          select: { id: true, title: true, status: true, participantCount: true }
        },
        rewards: true,
      },
    });

    logger.info('Campaign updated', {
      campaignId: params.campaignId,
      artistId: session.user.id,
      changes: Object.keys(validatedData)
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

    logger.error('Error updating campaign', { 
      campaignId: params.campaignId,
      userId: session?.user?.id 
    }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[campaignId] - Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  let session;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      select: { artistId: true, status: true, totalParticipants: true }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check ownership
    if (campaign.artistId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Don't allow deletion of active campaigns with participants
    if (campaign.status === 'ACTIVE' && campaign.totalParticipants > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete active campaigns with participants. Please end the campaign first.' 
      }, { status: 400 });
    }

    await prisma.campaign.delete({
      where: { id: params.campaignId }
    });

    logger.info('Campaign deleted', {
      campaignId: params.campaignId,
      artistId: session.user.id,
    });

    return NextResponse.json({ message: 'Campaign deleted successfully' });

  } catch (error) {
    logger.error('Error deleting campaign', { 
      campaignId: params.campaignId,
      userId: session?.user?.id 
    }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}