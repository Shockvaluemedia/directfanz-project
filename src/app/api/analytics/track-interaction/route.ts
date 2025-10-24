import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/analytics/track-interaction
 * Tracks user interactions for ML-based recommendations
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { interactionType, targetType, targetId, duration, metadata } = body;

    // Validate required fields
    if (!interactionType || !targetType || !targetId) {
      return NextResponse.json(
        { error: 'interactionType, targetType, and targetId are required' },
        { status: 400 }
      );
    }

    // Validate interaction type
    const validInteractionTypes = ['VIEW', 'LIKE', 'SUBSCRIBE', 'COMMENT', 'SHARE'];
    if (!validInteractionTypes.includes(interactionType)) {
      return NextResponse.json(
        { error: `Invalid interactionType. Must be one of: ${validInteractionTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate target type
    const validTargetTypes = ['CONTENT', 'ARTIST', 'STREAM'];
    if (!validTargetTypes.includes(targetType)) {
      return NextResponse.json(
        { error: `Invalid targetType. Must be one of: ${validTargetTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create interaction record
    const interaction = await prisma.user_interactions.create({
      data: {
        userId: session.user.id,
        interactionType,
        targetType,
        targetId,
        duration: duration ? parseInt(duration) : null,
        metadata: metadata || null,
      },
    });

    logger.info('User interaction tracked', {
      userId: session.user.id,
      interactionType,
      targetType,
      targetId,
    });

    return NextResponse.json({
      success: true,
      data: interaction,
    });
  } catch (error: any) {
    logger.error('Failed to track interaction', { error });
    return NextResponse.json(
      { error: 'Failed to track interaction' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/track-interaction
 * Gets user's interaction history
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get('targetType');
    const interactionType = searchParams.get('interactionType');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {
      userId: session.user.id,
    };

    if (targetType) {
      where.targetType = targetType;
    }

    if (interactionType) {
      where.interactionType = interactionType;
    }

    const interactions = await prisma.user_interactions.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: interactions,
      count: interactions.length,
    });
  } catch (error: any) {
    logger.error('Failed to get interactions', { error });
    return NextResponse.json(
      { error: 'Failed to get interactions' },
      { status: 500 }
    );
  }
}
