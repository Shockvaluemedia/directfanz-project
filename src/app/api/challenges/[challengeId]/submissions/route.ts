import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { string, SubmissionStatus } from '@/lib/types/enums';

// Validation schema for creating submissions
const createSubmissionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  contentType: z.nativeEnum(string),
  contentUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET /api/challenges/[challengeId]/submissions - List submissions for challenge
export async function GET(request: NextRequest, { params }: { params: { challengeId: string } }) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') as SubmissionStatus | null;
    const sortBy = searchParams.get('sortBy') || 'recent'; // 'recent', 'score', 'views'
    const mySubmissions = searchParams.get('my') === 'true';
    const skip = (page - 1) * limit;

    // Check if challenge exists and user has access
    const challenge = await prisma.challenges.findUnique({
      where: { id: params.challengeId },
      select: {
        id: true,
        status: true,
        campaign: {
          select: { artistId: true, status: true },
        },
      },
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Check if user can view submissions
    const canViewAll =
      challenge.campaigns.artistId === session.user.id ||
      session.user.role === 'ADMIN' ||
      challenge.status === 'ACTIVE';

    if (!canViewAll && !mySubmissions) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build where clause
    const where: any = { challengeId: params.challengeId };

    if (status) where.status = status;
    if (mySubmissions) {
      where.submitterId = session.user.id;
    } else if (!canViewAll) {
      // If user can't view all, only show approved submissions
      where.status = 'APPROVED';
    }

    // Build order clause
    let orderBy: any = { submittedAt: 'desc' }; // default to recent
    if (sortBy === 'score') orderBy = { totalScore: 'desc' };
    if (sortBy === 'views') orderBy = { viewCount: 'desc' };
    if (sortBy === 'engagement') orderBy = { likeCount: 'desc' };

    const [submissions, total] = await Promise.all([
      prisma.challenge_submissions.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          users: {
            select: { id: true, displayName: true, avatar: true },
          },
          participation: {
            select: { currentScore: true, rank: true },
          },
        },
      }),
      prisma.challenge_submissions.count({ where }),
    ]);

    // Parse metadata
    const submissionsWithParsedData = submissions.map(submission => ({
      ...submission,
      metadata: submission.metadata ? JSON.parse(submission.metadata) : null,
    }));

    return NextResponse.json({
      challenge_submissions: submissionsWithParsedData,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(
      'Error fetching submissions',
      {
        challengeId: params.challengeId,
        userId: session?.user?.id,
      },
      error as Error
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/challenges/[challengeId]/submissions - Create new submission
export async function POST(request: NextRequest, { params }: { params: { challengeId: string } }) {
  let session: any;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get challenge and participation details
    const challengeWithParticipation = await prisma.challenges.findUnique({
      where: { id: params.challengeId },
      include: {
        campaign: {
          select: { status: true },
        },
        challenge_participations: {
          where: { participantId: session.user.id },
          include: {
            challenge_submissions: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!challengeWithParticipation) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const challenge = challengeWithParticipation;
    const participation = challenge.participations[0];

    if (!participation) {
      return NextResponse.json(
        {
          error: 'You must join the challenge before submitting',
        },
        { status: 400 }
      );
    }

    if (participation.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'Your participation is not active',
        },
        { status: 400 }
      );
    }

    // Check if challenge and campaign are active
    if (challenge.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Challenge is not active' }, { status: 400 });
    }

    if (challenge.campaigns.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
    }

    // Check if submission period is still open
    if (challenge.submissionDeadline && new Date() > challenge.submissionDeadline) {
      return NextResponse.json({ error: 'Submission deadline has passed' }, { status: 400 });
    }

    // Check submission limits
    if (challenge.maxSubmissions && participation.challenge_submissions.length >= challenge.maxSubmissions) {
      return NextResponse.json(
        {
          error: `Maximum ${challenge.maxSubmissions} submissions allowed per participant`,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createSubmissionSchema.parse(body);

    // Check if content type is allowed
    const allowedTypes = JSON.parse(challenge.submissionTypes);
    if (!allowedTypes.includes(validatedData.contentType)) {
      return NextResponse.json(
        {
          error: `Content type ${validatedData.contentType} is not allowed for this challenge`,
        },
        { status: 400 }
      );
    }

    // Create submission
    const submission = await prisma.$transaction(async tx => {
      const newSubmission = await tx.challenge_submissions.create({
        data: {
          challengeId: params.challengeId,
          participationId: participation.id,
          submitterId: session.user.id,
          title: validatedData.title,
          description: validatedData.description,
          contentType: validatedData.contentType,
          contentUrl: validatedData.contentUrl,
          thumbnailUrl: validatedData.thumbnailUrl,
          metadata: validatedData.metadata ? JSON.stringify(validatedData.metadata) : null,
        },
        include: {
          users: {
            select: { id: true, displayName: true, avatar: true },
          },
          challenge: {
            select: { title: true, type: true },
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
        where: { id: params.challengeId },
        data: {
          submissionCount: { increment: 1 },
          engagementScore: { increment: 10 }, // Base engagement for new submission
        },
      });

      // Update leaderboard submissions count
      await tx.challenge_leaderboards.updateMany({
        where: {
          challengeId: params.challengeId,
          userId: session.user.id,
        },
        data: {
          challenge_submissions: { increment: 1 },
          lastSubmissionAt: new Date(),
        },
      });

      return newSubmission;
    });

    logger.info('Challenge submission created', {
      submissionId: submission.id,
      challengeId: params.challengeId,
      submitterId: session.user.id,
      contentType: submission.contentType,
    });

    return NextResponse.json(
      {
        ...submission,
        metadata: submission.metadata ? JSON.parse(submission.metadata) : null,
      },
      { status: 201 }
    );
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
        challengeId: params.challengeId,
        userId: session?.user?.id,
      },
      error as Error
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
