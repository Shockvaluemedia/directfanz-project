import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// POST /api/campaigns/[id]/join - Join a campaign
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let session: any;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only fans can join campaigns
    if (session.user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can join campaigns' }, { status: 403 });
    }

    // Check if campaign exists and is active
    const campaignId = params.id;
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      include: {
        challenges: {
          where: { status: 'ACTIVE' },
          select: { id: true, title: true, maxParticipants: true, participantCount: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
    }

    if (campaign.startDate > new Date()) {
      return NextResponse.json({ error: 'Campaign has not started yet' }, { status: 400 });
    }

    if (campaign.endDate < new Date()) {
      return NextResponse.json({ error: 'Campaign has ended' }, { status: 400 });
    }

    // Check if user has already joined any challenge in this campaign
    const existingParticipation = await prisma.challenge_participations.findFirst({
      where: {
        participantId: session.user.id,
        challenge: {
          campaignId: campaignId,
        },
      },
    });

    if (existingParticipation) {
      return NextResponse.json(
        { error: 'Already participating in this campaign' },
        { status: 400 }
      );
    }

    // Check campaign participant limits
    if (campaign.maxParticipants && campaign.totalParticipants >= campaign.maxParticipants) {
      return NextResponse.json({ error: 'Campaign is full' }, { status: 400 });
    }

    // Get the main challenge to join (for now, join the first active challenge)
    const mainChallenge = campaign.challenges[0];
    if (!mainChallenge) {
      return NextResponse.json({ error: 'No active challenges available' }, { status: 400 });
    }

    // Check challenge participant limits
    if (
      mainChallenge.maxParticipants &&
      mainChallenge.participantCount >= mainChallenge.maxParticipants
    ) {
      return NextResponse.json({ error: 'Challenge is full' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async tx => {
      // Create challenge participation
      const participation = await tx.challenge_participations.create({
        data: {
          challengeId: mainChallenge.id,
          participantId: session.user.id,
          status: 'ACTIVE',
        },
      });

      // Update challenge participant count
      await tx.challenge.update({
        where: { id: mainChallenge.id },
        data: { participantCount: { increment: 1 } },
      });

      // Update campaign participant count
      await tx.campaigns.update({
        where: { id: campaignId },
        data: { totalParticipants: { increment: 1 } },
      });

      return participation;
    });

    logger.info('User joined campaign', {
      campaignId,
      challengeId: mainChallenge.id,
      userId: session.user.id,
      participationId: result.id,
    });

    return NextResponse.json(
      {
        success: true,
        participationId: result.id,
        challengeId: mainChallenge.id,
        message: 'Successfully joined campaign!',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(
      'Error joining campaign',
      {
        campaignId: params.id,
        userId: session?.user?.id,
      },
      error as Error
    );

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/campaigns/[id]/join - Leave a campaign
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  let session: any;
  try {
    const { id: campaignId } = params;
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user's participation in this campaign
    const participation = await prisma.challenge_participations.findFirst({
      where: {
        participantId: session.user.id,
        challenge: {
          campaignId: campaignId,
        },
      },
      include: {
        challenge: {
          select: { id: true, status: true },
        },
        challenge_submissions: {
          select: { id: true },
        },
      },
    });

    if (!participation) {
      return NextResponse.json({ error: 'Not participating in this campaign' }, { status: 400 });
    }

    // Don't allow leaving if user has submissions
    if (participation.submissions.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot leave campaign after submitting content',
        },
        { status: 400 }
      );
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async tx => {
      // Delete participation
      await tx.challenge_participations.delete({
        where: { id: participation.id },
      });

      // Update challenge participant count
      await tx.challenge.update({
        where: { id: participation.challenge.id },
        data: { participantCount: { decrement: 1 } },
      });

      // Update campaign participant count
      await tx.campaigns.update({
        where: { id: campaignId },
        data: { totalParticipants: { decrement: 1 } },
      });
    });

    logger.info('User left campaign', {
      campaignId,
      challengeId: participation.challenge.id,
      userId: session.user.id,
      participationId: participation.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully left campaign',
    });
  } catch (error) {
    logger.error(
      'Error leaving campaign',
      {
        campaignId: params.id,
        userId: session?.user?.id,
      },
      error as Error
    );

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
