import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runArtistSimilarityCalculation } from '@/lib/cron/calculate-artist-similarity';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/calculate-similarities
 * Manually triggers artist similarity calculation
 * Admin only
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Manually triggering artist similarity calculation', {
      triggeredBy: session.user.id,
    });

    // Run calculation in background (don't await)
    runArtistSimilarityCalculation().catch((error) => {
      logger.error('Background similarity calculation failed', { error });
    });

    return NextResponse.json({
      success: true,
      message: 'Artist similarity calculation started in background',
    });
  } catch (error: any) {
    logger.error('Failed to trigger similarity calculation', { error });
    return NextResponse.json(
      { error: 'Failed to trigger calculation' },
      { status: 500 }
    );
  }
}
