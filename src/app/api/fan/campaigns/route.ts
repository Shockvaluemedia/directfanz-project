import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/fan/campaigns - Get campaigns the fan is participating in
export async function GET(request: NextRequest) {
  let session: any;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can access this endpoint' }, { status: 403 });
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
        challenge: {
          include: {
            campaign: {
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
                artist: {
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
      id: participation.challenge.campaigns.id,
      title: participation.challenge.campaigns.title,
      type: participation.challenge.campaigns.type,
      status: participation.challenge.campaigns.status,
      endDate: participation.challenge.campaigns.endDate.toISOString(),
      artist: {
        name: participation.challenge.campaigns.users.displayName,
        avatar: participation.challenge.campaigns.users.avatar || '/api/placeholder/40/40',
      },
      progress: {
        current: participation.challenge.campaigns.currentValue,
        target: participation.challenge.campaigns.targetValue,
      },
      userSubmissions: participation.submissionCount,
      // Check if user won (would need proper leaderboard logic)
      isWinner:
        participation.rank === 1 &&
        String(participation.challenge.campaigns.status) === 'COMPLETED',
      rank: participation.rank,
      // Include participation details
      participationStatus: participation.status,
      currentScore: participation.currentScore,
      joinedAt: participation.joinedAt,
      challenge_submissions: participation.submissions,
    }));

    return NextResponse.json({ campaigns });
  } catch (error) {
    logger.error('Error fetching fan campaigns', { userId: session?.user?.id }, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
