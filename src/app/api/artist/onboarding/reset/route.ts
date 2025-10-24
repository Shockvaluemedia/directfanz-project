import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/artist/onboarding/reset
 * Resets the onboarding wizard (for testing or re-onboarding)
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
        profileComplete: false,
        stripeConnected: false,
        firstTierCreated: false,
        firstContentUploaded: false,
        profileShared: false,
        completionPercentage: 0,
        currentStep: null,
        dismissedAt: null,
        completedAt: null,
      },
      create: {
        userId: session.user.id,
        completionPercentage: 0,
      },
    });

    logger.info('Onboarding reset', { userId: session.user.id });

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    logger.error('Failed to reset onboarding', { error });
    return NextResponse.json({ error: 'Failed to reset onboarding' }, { status: 500 });
  }
}
