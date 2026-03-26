import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiCreated, apiError } from '@/lib/api-response';

// POST /api/campaigns/[id]/join - Join a campaign
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let session: any;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Only fans can join campaigns
    if (session.user.role !== 'FAN') {
      return apiError('FORBIDDEN', 'Only fans can join campaigns');
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
      return apiError('NOT_FOUND', 'Campaign not found');
    }

    if (campaign.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Campaign is not active');
    }

    if (campaign.startDate > new Date()) {
      return apiError('BAD_REQUEST', 'Campaign has not started yet');
    }

    if (campaign.endDate < new Date()) {
      return apiError('BAD_REQUEST', 'Campaign has ended');
    }

    // Check if user has already joined any challenge in this campaign
    const existingParticipation = await prisma.challenge_participations.findFirst({
      where: {
        participantId: session.user.id,
        challenges: {
          campaignId: campaignId,
        },
      },
    });

    if (existingParticipation) {
      return apiError('BAD_REQUEST', 'Already participating in this campaign');
    }

    // Check campaign participant limits
    if (campaign.maxParticipants && campaign.totalParticipants >= campaign.maxParticipants) {
      return apiError('BAD_REQUEST', 'Campaign is full');
    }

    // Get the main challenge to join (for now, join the first active challenge)
    const mainChallenge = campaign.challenges[0];
    if (!mainChallenge) {
      return apiError('BAD_REQUEST', 'No active challenges available');
    }

    // Check challenge participant limits
    if (
      mainChallenge.maxParticipants &&
      mainChallenge.participantCount >= mainChallenge.maxParticipants
    ) {
      return apiError('BAD_REQUEST', 'Challenge is full');
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async tx => {
      // Create challenge participation
      const participation = await tx.challenge_participations.create({
        data: {
          id: crypto.randomUUID(),
          challengeId: mainChallenge.id,
          participantId: session.user.id,
          status: 'ACTIVE',
        },
      });

      // Update challenge participant count
      await tx.challenges.update({
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

    return apiCreated({ participationId: result.id,
        challengeId: mainChallenge.id,
        message: 'Successfully joined campaign!' });
  } catch (error) {
    logger.error(
      'Error joining campaign',
      {
        campaignId: params.id,
        userId: session?.user?.id,
      },
      error as Error
    );

    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}

// DELETE /api/campaigns/[id]/join - Leave a campaign
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  let session: any;
  try {
    const { id: campaignId } = params;
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Find user's participation in this campaign
    const participation = await prisma.challenge_participations.findFirst({
      where: {
        participantId: session.user.id,
        challenges: {
          campaignId: campaignId,
        },
      },
      include: {
        challenges: {
          select: { id: true, status: true },
        },
        challenge_submissions: {
          select: { id: true },
        },
      },
    });

    if (!participation) {
      return apiError('BAD_REQUEST', 'Not participating in this campaign');
    }

    // Don't allow leaving if user has submissions
    if (participation.challenge_submissions.length > 0) {
      return apiError('BAD_REQUEST', 'Cannot leave campaign after submitting content',);
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async tx => {
      // Delete participation
      await tx.challenge_participations.delete({
        where: { id: participation.id },
      });

      // Update challenge participant count
      await tx.challenges.update({
        where: { id: participation.challenges.id },
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
      challengeId: participation.challenges.id,
      userId: session.user.id,
      participationId: participation.id,
    });

    return apiSuccess({ message: 'Successfully left campaign' });
  } catch (error) {
    logger.error(
      'Error leaving campaign',
      {
        campaignId: params.id,
        userId: session?.user?.id,
      },
      error as Error
    );

    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}
