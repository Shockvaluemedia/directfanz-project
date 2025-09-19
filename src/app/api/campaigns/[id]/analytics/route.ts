import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/campaigns/[id]/analytics - Get campaign analytics
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: campaignId } = params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if campaign exists and user has access
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      select: { id: true, artistId: true, status: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only campaign owner or admin can view analytics
    if (campaign.artistId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get campaign analytics from existing data
    const analyticsData = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      include: {
        challenges: {
          select: {
            id: true,
            title: true,
            participantCount: true,
            submissionCount: true,
            _count: {
              select: {
                challenge_participations: true,
                challenge_submissions: true,
              },
            },
          },
        },
        _count: {
          select: {
            challenges: true,
            campaign_rewards: true,
          },
        },
      },
    });

    if (!analyticsData) {
      return NextResponse.json({ error: 'Analytics data not found' }, { status: 404 });
    }

    // Calculate key metrics
    const totalSubmissions = analyticsData.challenges.reduce(
      (sum, challenge) => sum + challenge.submissionCount,
      0
    );
    const totalParticipations = analyticsData.challenges.reduce(
      (sum, challenge) => sum + challenge.participantCount,
      0
    );

    // Get submission trends over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissionTrends = await prisma.challenge_submissions.findMany({
      where: {
        challenge: {
          campaignId: campaignId,
        },
        submittedAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        submittedAt: true,
      },
      orderBy: {
        submittedAt: 'asc',
      },
    });

    // Group submissions by date
    const submissionsByDate: Record<string, number> = {};
    submissionTrends.forEach(submission => {
      const date = submission.submittedAt.toISOString().split('T')[0];
      submissionsByDate[date] = (submissionsByDate[date] || 0) + 1;
    });

    // Get top performers
    const topSubmissions = await prisma.challenge_submissions.findMany({
      where: {
        challenge: {
          campaignId: campaignId,
        },
        status: 'APPROVED',
      },
      select: {
        id: true,
        title: true,
        totalScore: true,
        likeCount: true,
        viewCount: true,
        submitter: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ totalScore: 'desc' }, { likeCount: 'desc' }],
      take: 10,
    });

    const analytics = {
      overview: {
        totalParticipants: analyticsData.totalParticipants,
        totalSubmissions,
        totalChallenges: analyticsData._count.challenges,
        totalRewards: analyticsData._count.rewards,
        engagementRate:
          totalParticipations > 0 ? ((totalSubmissions / totalParticipations) * 100).toFixed(1) : 0,
        completionRate:
          analyticsData.targetValue > 0
            ? ((analyticsData.currentValue / analyticsData.targetValue) * 100).toFixed(1)
            : 0,
      },
      performance: {
        targetProgress: {
          current: analyticsData.currentValue,
          target: analyticsData.targetValue,
          percentage:
            analyticsData.targetValue > 0
              ? Math.round((analyticsData.currentValue / analyticsData.targetValue) * 100)
              : 0,
        },
        metrics: {
          totalViews: 0, // Would need view tracking
          totalLikes: 0, // Would need to aggregate from submissions
          averageScore: 0, // Would need to calculate from submissions
          retentionRate: 0, // Would need session tracking
        },
      },
      trends: {
        submissionsByDate: Object.entries(submissionsByDate).map(([date, count]) => ({
          date,
          challenge_submissions: count,
        })),
        participationGrowth: [], // Would need historical participation data
        engagementTrends: [], // Would need historical engagement data
      },
      challenges: analyticsData.challenges.map(challenge => ({
        id: challenge.id,
        title: challenge.title,
        participants: challenge.participantCount,
        challenge_submissions: challenge.submissionCount,
        engagementRate:
          challenge.participantCount > 0
            ? ((challenge.submissionCount / challenge.participantCount) * 100).toFixed(1)
            : 0,
      })),
      topPerformers: topSubmissions,
      demographics: {
        // Would need user demographic data
        ageGroups: [],
        locations: [],
        deviceTypes: [],
      },
    };

    return NextResponse.json(analytics);
  } catch (error) {
    logger.error('Error fetching campaign analytics', { campaignId: params.id }, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
