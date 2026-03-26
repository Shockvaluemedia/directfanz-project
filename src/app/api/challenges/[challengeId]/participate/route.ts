import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiCreated, apiError } from '@/lib/api-response';

// POST /api/challenges/[challengeId]/participate - Join a challenge
export async function POST(request: NextRequest, { params }: { params: { challengeId: string } }) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Get challenge details and check if it exists
    const challenge = await prisma.challenges.findUnique({
      where: { id: params.challengeId },
      include: {
        campaigns: {
          select: {
            id: true,
            title: true,
            status: true,
            entryFee: true,
            maxParticipants: true,
            totalParticipants: true,
          },
        },
        _count: {
          select: { challenge_participations: true },
        },
      },
    });

    if (!challenge) {
      return apiError('NOT_FOUND', 'Challenge not found');
    }

    // Check if challenge and campaign are active
    if (challenge.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Challenge is not active');
    }

    if (challenge.campaigns.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Campaign is not active');
    }

    // Check if challenge has started (if it has a start date)
    if (challenge.startDate && new Date() < challenge.startDate) {
      return apiError('BAD_REQUEST', 'Challenge has not started yet');
    }

    // Check if challenge has ended
    if (challenge.endDate && new Date() > challenge.endDate) {
      return apiError('BAD_REQUEST', 'Challenge has ended');
    }

    // Check participation limits
    if (challenge.maxParticipants && challenge.participantCount >= challenge.maxParticipants) {
      return apiError('BAD_REQUEST', 'Challenge has reached maximum participants');
    }

    // Check if user is already participating
    const existingParticipation = await prisma.challenge_participations.findUnique({
      where: {
        challengeId_participantId: {
          challengeId: params.challengeId,
          participantId: session.user.id,
        },
      },
    });

    if (existingParticipation) {
      if (existingParticipation.status === 'ACTIVE') {
        return apiError('BAD_REQUEST', 'Already participating in this challenge');
      } else {
        // Reactivate participation if it was withdrawn
        const updatedParticipation = await prisma.challenge_participations.update({
          where: { id: existingParticipation.id },
          data: {
            status: 'ACTIVE',
            lastActiveAt: new Date(),
          },
          include: {
            challenges: {
              select: { title: true, type: true },
            },
          },
        });

        logger.info('Challenge participation reactivated', {
          challengeId: params.challengeId,
          participantId: session.user.id,
          participationId: updatedParticipation.id,
        });

        return apiSuccess(updatedParticipation);
      }
    }

    // Handle entry fee if required
    if (challenge.campaigns.entryFee && Number(challenge.campaigns.entryFee) > 0) {
      // In a real implementation, you would integrate with Stripe here
      // For now, we'll assume the payment is handled elsewhere
      logger.info('Entry fee required', {
        challengeId: params.challengeId,
        entryFee: challenge.campaigns.entryFee,
        participantId: session.user.id,
      });
    }

    // Create participation record
    const participation = await prisma.$transaction(async tx => {
      const newParticipation = await tx.challenge_participations.create({
        data: {
          id: crypto.randomUUID(),
          challengeId: params.challengeId,
          participantId: session.user.id,
          status: 'ACTIVE',
        },
        include: {
          challenges: {
            select: { title: true, type: true, maxScore: true },
          },
          users: {
            select: { displayName: true, avatar: true },
          },
        },
      });

      // Update challenge participant count
      await tx.challenges.update({
        where: { id: params.challengeId },
        data: {
          participantCount: { increment: 1 },
        },
      });

      // Update campaign participant count
      await tx.campaigns.update({
        where: { id: challenge.campaigns.id },
        data: {
          totalParticipants: { increment: 1 },
        },
      });

      // Initialize leaderboard entry
      await tx.challenge_leaderboards.create({
        data: {
          id: crypto.randomUUID(),
          challengeId: params.challengeId,
          userId: session.user.id,
          rank: challenge.participantCount + 1,
          score: 0,
          submissions: 0,
          updatedAt: new Date(),
        },
      });

      return newParticipation;
    });

    logger.info('User joined challenge', {
      challengeId: params.challengeId,
      participantId: session.user.id,
      challengeTitle: challenge.title,
      challengeType: challenge.type,
    });

    return apiCreated(participation);
  } catch (error) {
    logger.error(
      'Error joining challenge',
      {
        challengeId: params.challengeId,
        userId: session?.user?.id,
      },
      error as Error
    );
    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}

// DELETE /api/challenges/[challengeId]/participate - Leave a challenge
export async function DELETE(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Find participation
    const participation = await prisma.challenge_participations.findUnique({
      where: {
        challengeId_participantId: {
          challengeId: params.challengeId,
          participantId: session.user.id,
        },
      },
      include: {
        challenges: {
          include: {
            campaigns: {
              select: { id: true },
            },
          },
        },
        challenge_submissions: {
          select: { id: true },
        },
      },
    });

    if (!participation) {
      return apiError('NOT_FOUND', 'Not participating in this challenge');
    }

    if (participation.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Participation is not active');
    }

    // Don't allow leaving if user has submissions (to maintain leaderboard integrity)
    if (participation.challenge_submissions.length > 0) {
      return apiError('BAD_REQUEST', 'Cannot leave challenge after making submissions. You can withdraw instead.',);
    }

    // Remove participation
    await prisma.$transaction(async tx => {
      // Update participation status to withdrawn
      await tx.challenge_participations.update({
        where: { id: participation.id },
        data: { status: 'WITHDRAWN' },
      });

      // Update challenge participant count
      await tx.challenges.update({
        where: { id: params.challengeId },
        data: {
          participantCount: { decrement: 1 },
        },
      });

      // Update campaign participant count
      await tx.campaigns.update({
        where: { id: participation.challenges.campaigns.id },
        data: {
          totalParticipants: { decrement: 1 },
        },
      });

      // Remove from leaderboard
      await tx.challenge_leaderboards.deleteMany({
        where: {
          challengeId: params.challengeId,
          userId: session.user.id,
        },
      });
    });

    logger.info('User left challenge', {
      challengeId: params.challengeId,
      participantId: session.user.id,
      participationId: participation.id,
    });

    return apiSuccess({ message: 'Successfully left challenge' });
  } catch (error) {
    logger.error(
      'Error leaving challenge',
      {
        challengeId: params.challengeId,
        userId: session?.user?.id,
      },
      error as Error
    );
    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}
