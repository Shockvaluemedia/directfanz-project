import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { apiSuccess, apiCreated, apiError, apiValidationError } from '@/lib/api-response';
const createSubmissionSchema = z.object({
  challengeId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  contentType: z.string(),
  content: z.string().min(1), // For text content or description
  contentUrl: z.string().url().optional(), // For file uploads
  thumbnailUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET /api/campaigns/[id]/submissions - List submissions for a campaign
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: campaignId } = params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const challengeId = searchParams.get('challengeId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId'); // For getting user's own submissions
    const skip = (page - 1) * limit;

    const session = await getServerSession(authOptions);

    // Check if campaign exists
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true, artistId: true },
    });

    if (!campaign) {
      return apiError('NOT_FOUND', 'Campaign not found');
    }

    // Build where clause
    const where: any = {
      challenges: {
        campaignId: campaignId,
      },
    };

    if (challengeId) where.challengeId = challengeId;
    if (status) where.status = status;

    // If userId is specified, only show that user's submissions (for privacy)
    if (userId) {
      if (!session?.user?.id) {
        return apiError('UNAUTHORIZED', 'Unauthorized');
      }

      // Users can only view their own submissions, unless they're the artist or admin
      if (
        userId !== session.user.id &&
        campaign.artistId !== session.user.id &&
        session.user.role !== 'ADMIN'
      ) {
        return apiError('FORBIDDEN', 'Access denied');
      }

      where.submitterId = userId;
    } else {
      // For public submissions list, only show approved submissions
      where.reviewStatus = 'APPROVED';
      where.status = 'APPROVED';
    }

    const [submissions, total] = await Promise.all([
      prisma.challenge_submissions.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ totalScore: 'desc' }, { submittedAt: 'desc' }],
        include: {
          users: {
            select: { id: true, displayName: true, avatar: true },
          },
          challenges: {
            select: { id: true, title: true, type: true },
          },
        },
      }),
      prisma.challenge_submissions.count({ where }),
    ]);

    return apiSuccess({
      submissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching campaign submissions', { campaignId: params.id }, error as Error);
    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}

// POST /api/campaigns/[id]/submissions - Submit content to a campaign
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let session: any;
  try {
    const { id: campaignId } = params;
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Only fans can submit to campaigns
    if (session.user.role !== 'FAN') {
      return apiError('FORBIDDEN', 'Only fans can submit to campaigns');
    }

    const body = await request.json();
    const validatedData = createSubmissionSchema.parse(body);

    // Check if campaign exists and is active
    const campaign = await prisma.campaigns.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        challenges: {
          where: { id: validatedData.challengeId },
          select: {
            id: true,
            status: true,
            endDate: true,
            submissionDeadline: true,
            maxSubmissions: true,
            submissionTypes: true,
          },
        },
      },
    });

    if (!campaign) {
      return apiError('NOT_FOUND', 'Campaign not found');
    }

    if (campaign.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Campaign is not active');
    }

    const challenge = campaign.challenges[0];
    if (!challenge) {
      return apiError('NOT_FOUND', 'Challenge not found');
    }

    if (challenge.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Challenge is not accepting submissions');
    }

    // Check submission deadline
    const deadline = challenge.submissionDeadline || challenge.endDate;
    if (deadline && deadline < new Date()) {
      return apiError('BAD_REQUEST', 'Submission deadline has passed');
    }

    // Check if user is participating in the challenge
    const participation = await prisma.challenge_participations.findUnique({
      where: {
        challengeId_participantId: {
          challengeId: challenge.id,
          participantId: session.user.id,
        },
      },
      select: { id: true, submissionCount: true, status: true },
    });

    if (!participation) {
      return apiError('BAD_REQUEST', 'Must join campaign before submitting');
    }

    if (participation.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Participation is not active');
    }

    // Check submission limits
    if (challenge.maxSubmissions && participation.submissionCount >= challenge.maxSubmissions) {
      return apiError('BAD_REQUEST', `Maximum ${challenge.maxSubmissions} submissions allowed`,);
    }

    // Validate content type is allowed
    if (challenge.submissionTypes) {
      const allowedTypes = JSON.parse(challenge.submissionTypes);
      if (!allowedTypes.includes(validatedData.contentType)) {
        return apiError('BAD_REQUEST', `Content type ${validatedData.contentType} not allowed for this challenge`,);
      }
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async tx => {
      // Create submission
      const submission = await tx.challenge_submissions.create({
        data: {
          id: crypto.randomUUID(),
          challengeId: challenge.id,
          participationId: participation.id,
          submitterId: session.user.id,
          title: validatedData.title,
          description: validatedData.description,
          contentType: validatedData.contentType,
          contentUrl: validatedData.contentUrl || '',
          thumbnailUrl: validatedData.thumbnailUrl,
          metadata: validatedData.metadata ? JSON.stringify(validatedData.metadata) : null,
          status: 'PENDING',
          reviewStatus: 'PENDING',
          updatedAt: new Date(),
        },
        include: {
          users: {
            select: { id: true, displayName: true, avatar: true },
          },
          challenges: {
            select: { id: true, title: true, type: true },
          },
        },
      });

      // Update participation submission count
      await tx.challenge_participations.update({
        where: { id: participation.id },
        data: {
          submissionCount: { increment: 1 },
          lastActiveAt: new Date(),
        },
      });

      // Update challenge submission count
      await tx.challenges.update({
        where: { id: challenge.id },
        data: { submissionCount: { increment: 1 } },
      });

      return submission;
    });

    logger.info('Submission created', {
      campaignId,
      challengeId: challenge.id,
      submissionId: result.id,
      userId: session.user.id,
      contentType: validatedData.contentType,
    });

    return apiCreated(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiValidationError(error.errors);
    }

    logger.error(
      'Error creating submission',
      {
        campaignId: params.id,
        userId: session?.user?.id,
      },
      error as Error
    );

    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}
