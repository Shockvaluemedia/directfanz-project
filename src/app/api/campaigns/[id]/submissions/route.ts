import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { string } from '@prisma/client';

const createSubmissionSchema = z.object({
  challengeId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  contentType: z.nativeEnum(string),
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
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Build where clause
    const where: any = {
      challenge: {
        campaignId: campaignId,
      },
    };

    if (challengeId) where.challengeId = challengeId;
    if (status) where.status = status;

    // If userId is specified, only show that user's submissions (for privacy)
    if (userId) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Users can only view their own submissions, unless they're the artist or admin
      if (
        userId !== session.user.id &&
        campaign.artistId !== session.user.id &&
        session.user.role !== 'ADMIN'
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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
          challenge: {
            select: { id: true, title: true, type: true },
          },
        },
      }),
      prisma.challenge_submissions.count({ where }),
    ]);

    return NextResponse.json({
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns/[id]/submissions - Submit content to a campaign
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let session: any;
  try {
    const { id: campaignId } = params;
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only fans can submit to campaigns
    if (session.user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can submit to campaigns' }, { status: 403 });
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
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
    }

    const challenge = campaign.challenges[0];
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (challenge.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Challenge is not accepting submissions' },
        { status: 400 }
      );
    }

    // Check submission deadline
    const deadline = challenge.submissionDeadline || challenge.endDate;
    if (deadline && deadline < new Date()) {
      return NextResponse.json({ error: 'Submission deadline has passed' }, { status: 400 });
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
      return NextResponse.json({ error: 'Must join campaign before submitting' }, { status: 400 });
    }

    if (participation.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Participation is not active' }, { status: 400 });
    }

    // Check submission limits
    if (challenge.maxSubmissions && participation.submissionCount >= challenge.maxSubmissions) {
      return NextResponse.json(
        {
          error: `Maximum ${challenge.maxSubmissions} submissions allowed`,
        },
        { status: 400 }
      );
    }

    // Validate content type is allowed
    if (challenge.submissionTypes) {
      const allowedTypes = JSON.parse(challenge.submissionTypes);
      if (!allowedTypes.includes(validatedData.contentType)) {
        return NextResponse.json(
          {
            error: `Content type ${validatedData.contentType} not allowed for this challenge`,
          },
          { status: 400 }
        );
      }
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async tx => {
      // Create submission
      const submission = await tx.challenge_submissions.create({
        data: {
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
        },
        include: {
          users: {
            select: { id: true, displayName: true, avatar: true },
          },
          challenge: {
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

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    logger.error(
      'Error creating submission',
      {
        campaignId: params.id,
        userId: session?.user?.id,
      },
      error as Error
    );

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
