import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/artist/onboarding/dismiss
 * Dismisses the onboarding wizard (but keeps accessible)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const progress = await prisma.onboarding_progress.upsert({
      where: { userId: session.user.id },
      update: {
        dismissedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        dismissedAt: new Date(),
        completionPercentage: 0,
      },
    });

    logger.info('Onboarding dismissed', { userId: session.user.id });

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    logger.error('Failed to dismiss onboarding', { error });
    return NextResponse.json({ error: 'Failed to dismiss onboarding' }, { status: 500 });
  }
}
