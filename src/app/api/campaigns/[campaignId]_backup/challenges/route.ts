import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ChallengeType, ChallengeStatus, SubmissionContentType } from '@prisma/client';

// Validation schema for creating challenges
const createChallengeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  type: z.nativeEnum(ChallengeType),
  rules: z.object({
    instructions: z.string(),
    restrictions: z.array(z.string()).optional(),
    criteria: z.array(z.string()),
  }),
  requirements: z.array(z.string()).optional(),
  submissionTypes: z.array(z.nativeEnum(SubmissionContentType)),
  scoringCriteria: z.object({
    criteria: z.array(z.object({
      name: z.string(),
      weight: z.number().min(0).max(1),
      description: z.string().optional(),
    })),
    maxScore: z.number().int().positive().default(100),
  }),
  maxScore: z.number().int().positive().default(100),
  autoJudging: z.boolean().default(false),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  submissionDeadline: z.string().datetime().optional(),
  maxSubmissions: z.number().int().positive().optional(),
  maxParticipants: z.number().int().positive().optional(),
  isPublic: z.boolean().default(true),
  featuredOrder: z.number().int().optional(),
});

const updateChallengeSchema = createChallengeSchema.partial();

// GET /api/campaigns/[campaignId]/challenges - List challenges for campaign
export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  let session;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if campaign exists and user has access
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      select: { artistId: true, status: true }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check access permissions
    const hasAccess = 
      campaign.artistId === session.user.id ||
      session.user.role === 'ADMIN' ||
      campaign.status === 'ACTIVE';

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ChallengeStatus | null;
    const type = searchParams.get('type') as ChallengeType | null;
    const featured = searchParams.get('featured') === 'true';

    // Build where clause
    const where: any = { campaignId: params.campaignId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (featured) where.featuredOrder = { not: null };

    const challenges = await prisma.challenge.findMany({
      where,
      orderBy: [
        { featuredOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        _count: {
          select: { participations: true, submissions: true }
        },
        participations: {
          where: { participantId: session.user.id },
          select: { 
            id: true, 
            status: true, 
            currentScore: true, 
            rank: true,
            submissionCount: true 
          }
        }
      },
    });

    // Parse JSON fields
    const challengesWithParsedData = challenges.map(challenge => ({
      ...challenge,
      rules: JSON.parse(challenge.rules),
      requirements: challenge.requirements ? JSON.parse(challenge.requirements) : [],
      submissionTypes: JSON.parse(challenge.submissionTypes),
      scoringCriteria: JSON.parse(challenge.scoringCriteria),
      userParticipation: challenge.participations[0] || null,
      participations: undefined, // Remove from response
    }));

    return NextResponse.json({ challenges: challengesWithParsedData });

  } catch (error) {
    logger.error('Error fetching challenges', { 
      campaignId: params.campaignId,
      userId: session?.user?.id 
    }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/[campaignId]/challenges - Create new challenge
export async function POST(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  let session;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if campaign exists and user owns it
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      select: { artistId: true, status: true }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check ownership
    if (campaign.artistId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createChallengeSchema.parse(body);

    // Validate dates if provided
    if (validatedData.startDate && validatedData.endDate) {
      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);
      
      if (endDate <= startDate) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
      }
    }

    if (validatedData.submissionDeadline) {
      const deadline = new Date(validatedData.submissionDeadline);
      const endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
      
      if (endDate && deadline > endDate) {
        return NextResponse.json({ 
          error: 'Submission deadline cannot be after challenge end date' 
        }, { status: 400 });
      }
    }

    // Create challenge
    const challenge = await prisma.challenge.create({
      data: {
        ...validatedData,
        campaignId: params.campaignId,
        rules: JSON.stringify(validatedData.rules),
        requirements: validatedData.requirements ? JSON.stringify(validatedData.requirements) : null,
        submissionTypes: JSON.stringify(validatedData.submissionTypes),
        scoringCriteria: JSON.stringify(validatedData.scoringCriteria),
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        submissionDeadline: validatedData.submissionDeadline ? new Date(validatedData.submissionDeadline) : null,
      },
      include: {
        campaign: {
          select: { title: true, artistId: true }
        },
        _count: {
          select: { participations: true, submissions: true }
        }
      },
    });

    logger.info('Challenge created', {
      challengeId: challenge.id,
      campaignId: params.campaignId,
      artistId: session.user.id,
      title: challenge.title,
      type: challenge.type,
    });

    // Return challenge with parsed JSON data
    const challengeWithParsedData = {
      ...challenge,
      rules: JSON.parse(challenge.rules),
      requirements: challenge.requirements ? JSON.parse(challenge.requirements) : [],
      submissionTypes: JSON.parse(challenge.submissionTypes),
      scoringCriteria: JSON.parse(challenge.scoringCriteria),
    };

    return NextResponse.json(challengeWithParsedData, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating challenge', { 
      campaignId: params.campaignId,
      userId: session?.user?.id 
    }, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}