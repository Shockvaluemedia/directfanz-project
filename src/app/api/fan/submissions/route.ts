import { NextRequest } from 'next/server';
import { safeParseURL } from '@/lib/api-utils';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// GET /api/fan/submissions - Get fan's campaign submissions
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
    const status = searchParams.get('status'); // PENDING, APPROVED, etc.
    const campaignId = searchParams.get('campaignId');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: any = {
      submitterId: session.user.id,
    };

    if (status) where.status = status;
    if (campaignId) {
      where.challenges = {
        campaignId: campaignId,
      };
    }

    // Get user's submissions
    const submissions = await prisma.challenge_submissions.findMany({
      where,
      include: {
        challenges: {
          include: {
            campaigns: {
              select: {
                id: true,
                title: true,
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
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: limit,
    });

    // Transform the data to match the frontend interface
    const transformedSubmissions = submissions.map(submission => ({
      id: submission.id,
      campaignId: submission.challenges?.campaigns?.id,
      campaignTitle: submission.challenges?.campaigns?.title,
      type: submission.contentType.toLowerCase(),
      status: submission.reviewStatus.toLowerCase(), // Use review status for frontend
      submittedAt: submission.submittedAt.toISOString(),
      likes: submission.likeCount,
      views: submission.viewCount,
      artistName: submission.challenges?.campaigns?.users?.displayName,
      title: submission.title,
      description: submission.description,
      score: submission.totalScore,
      contentUrl: submission.contentUrl,
      thumbnailUrl: submission.thumbnailUrl,
    }));

    return apiSuccess({ challenge_submissions: transformedSubmissions });
  } catch (error) {
    logger.error('Error fetching fan submissions', { userId: session?.user?.id }, error as Error);
    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}
