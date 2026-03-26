import { NextRequest } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// GET /api/fan/campaigns - Get campaigns the fan is participating in
export async function GET(request: NextRequest) {
  let session: any;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    if (session.user.role !== 'FAN') {
      return apiError('FORBIDDEN', 'Only fans can access this endpoint');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // ACTIVE, COMPLETED, etc.
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get campaigns the user is participating in
    const participations = await prisma.challenge_participations.findMany({
      where: {
        participantId: session.user.id,
        ...(status && { status: status as any }),
      },
      include: {
        challenges: {
          include: {
            campaigns: {
              select: {
                id: true,
                title: true,
                type: true,
                status: true,
                startDate: true,
                endDate: true,
                targetMetric: true,
                targetValue: true,
                currentValue: true,
                totalParticipants: true,
                users: {
                  select: {
                    id: true,
                    displayName: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
        challenge_submissions: {
          select: {
            id: true,
            title: true,
            status: true,
            reviewStatus: true,
            totalScore: true,
            submittedAt: true,
          },
        },
      },
      orderBy: {
        lastActiveAt: 'desc',
      },
      take: limit,
    });

    // Transform the data to match the frontend interface
    const campaigns = participations.map(participation => ({
      id: participation.challenges.campaigns.id,
      title: participation.challenges.campaigns.title,
      type: participation.challenges.campaigns.type,
      status: participation.challenges.campaigns.status,
      endDate: participation.challenges.campaigns.endDate.toISOString(),
      artist: {
        name: participation.challenges.campaigns.users.displayName,
        avatar: participation.challenges.campaigns.users.avatar || '/api/placeholder/40/40',
      },
      progress: {
        current: participation.challenges.campaigns.currentValue,
        target: participation.challenges.campaigns.targetValue,
      },
      userSubmissions: participation.submissionCount,
      // Check if user won (would need proper leaderboard logic)
      isWinner:
        participation.rank === 1 &&
        String(participation.challenges.campaigns.status) === 'COMPLETED',
      rank: participation.rank,
      // Include participation details
      participationStatus: participation.status,
      currentScore: participation.currentScore,
      joinedAt: participation.joinedAt,
      challenge_submissions: participation.challenge_submissions,
    }));

    return apiSuccess({ campaigns });
  } catch (error) {
    logger.error('Error fetching fan campaigns', { userId: session?.user?.id }, error as Error);
    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}
