import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/challenges/[challengeId]/leaderboard - Get challenge leaderboard
export async function GET(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userRank = searchParams.get('userRank') === 'true';

    // Check if challenge exists and user has access
    const challenge = await prisma.challenge.findUnique({
      where: { id: params.challengeId },
      select: { 
        id: true,
        title: true,
        status: true,
        maxScore: true,
        campaign: {
          select: { artistId: true, status: true, title: true }
        }
      }
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Check access permissions
    const canView = 
      challenge.campaign.artistId === session.user.id ||
      session.user.role === 'ADMIN' ||
      challenge.status === 'ACTIVE' ||
      challenge.status === 'COMPLETED';

    if (!canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get main leaderboard
    const leaderboard = await prisma.challengeLeaderboard.findMany({
      where: { challengeId: params.challengeId },
      orderBy: { rank: 'asc' },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: { 
            id: true, 
            displayName: true, 
            avatar: true,
            role: true
          }
        }
      }
    });

    // Get user's rank if requested
    let currentUserRank = null;
    if (userRank) {
      currentUserRank = await prisma.challengeLeaderboard.findUnique({
        where: {
          challengeId_userId: {
            challengeId: params.challengeId,
            userId: session.user.id
          }
        },
        include: {
          user: {
            select: { 
              id: true, 
              displayName: true, 
              avatar: true 
            }
          }
        }
      });
    }

    // Get leaderboard statistics
    const stats = await prisma.challengeLeaderboard.aggregate({
      where: { challengeId: params.challengeId },
      _count: { rank: true },
      _avg: { score: true },
      _max: { score: true },
      _min: { score: true }
    });

    // Get recent activity (recent submissions or score changes)
    const recentActivity = await prisma.challengeSubmission.findMany({
      where: { 
        challengeId: params.challengeId,
        status: 'APPROVED'
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        totalScore: true,
        submittedAt: true,
        submitter: {
          select: { 
            id: true, 
            displayName: true, 
            avatar: true 
          }
        }
      }
    });

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        status: challenge.status,
        maxScore: challenge.maxScore
      },
      leaderboard,
      currentUserRank,
      stats: {
        totalParticipants: stats._count.rank || 0,
        averageScore: stats._avg.score || 0,
        highestScore: stats._max.score || 0,
        lowestScore: stats._min.score || 0
      },
      recentActivity,
      pagination: {
        offset,
        limit,
        hasMore: leaderboard.length === limit
      }
    });

  } catch (error) {
    logger.error('Error fetching leaderboard', { 
      challengeId: params.challengeId,
      userId: session?.user?.id 
    }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/challenges/[challengeId]/leaderboard/refresh - Recalculate leaderboard
export async function POST(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is the challenge owner or admin
    const challenge = await prisma.challenge.findUnique({
      where: { id: params.challengeId },
      select: { 
        campaign: {
          select: { artistId: true }
        }
      }
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (challenge.campaign.artistId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Recalculate leaderboard
    const updatedLeaderboard = await recalculateLeaderboard(params.challengeId);

    logger.info('Leaderboard recalculated', {
      challengeId: params.challengeId,
      triggeredBy: session.user.id,
      updatedEntries: updatedLeaderboard.length
    });

    return NextResponse.json({
      message: 'Leaderboard recalculated successfully',
      updatedEntries: updatedLeaderboard.length
    });

  } catch (error) {
    logger.error('Error recalculating leaderboard', { 
      challengeId: params.challengeId,
      userId: session?.user?.id 
    }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to recalculate leaderboard rankings
async function recalculateLeaderboard(challengeId: string) {
  return await prisma.$transaction(async (tx) => {
    // Get all participants with their scores
    const participations = await tx.challengeParticipation.findMany({
      where: { 
        challengeId,
        status: 'ACTIVE'
      },
      include: {
        submissions: {
          where: { status: 'APPROVED' },
          select: { totalScore: true }
        }
      }
    });

    // Calculate scores and update leaderboard
    const leaderboardUpdates = [];

    for (const participation of participations) {
      // Calculate total score from all approved submissions
      const totalScore = participation.submissions.reduce(
        (sum, submission) => sum + submission.totalScore, 
        0
      );

      // Update participation current score
      await tx.challengeParticipation.update({
        where: { id: participation.id },
        data: { currentScore: totalScore }
      });

      leaderboardUpdates.push({
        userId: participation.participantId,
        score: totalScore,
        submissions: participation.submissions.length
      });
    }

    // Sort by score (descending) and assign ranks
    leaderboardUpdates.sort((a, b) => b.score - a.score);

    // Update leaderboard with new ranks
    const updatedEntries = [];
    for (let i = 0; i < leaderboardUpdates.length; i++) {
      const entry = leaderboardUpdates[i];
      const rank = i + 1;

      const updated = await tx.challengeLeaderboard.upsert({
        where: {
          challengeId_userId: {
            challengeId,
            userId: entry.userId
          }
        },
        update: {
          rank,
          score: entry.score,
          submissions: entry.submissions,
          updatedAt: new Date()
        },
        create: {
          challengeId,
          userId: entry.userId,
          rank,
          score: entry.score,
          submissions: entry.submissions
        }
      });

      // Update participation rank
      await tx.challengeParticipation.updateMany({
        where: {
          challengeId,
          participantId: entry.userId
        },
        data: { rank }
      });

      updatedEntries.push(updated);
    }

    return updatedEntries;
  });
}