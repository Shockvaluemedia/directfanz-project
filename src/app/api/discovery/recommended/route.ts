import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RecommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { logger } from '@/lib/logger';

/**
 * GET /api/discovery/recommended
 * Returns personalized artist recommendations
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const recommender = new RecommendationEngine();
    const recommended = await recommender.getPersonalizedFeed(session.user.id, limit);

    logger.info('Generated personalized recommendations', {
      userId: session.user.id,
      count: recommended.length,
    });

    return NextResponse.json({
      success: true,
      section: 'Recommended for You',
      artists: recommended.map((item) => ({
        ...item.artist,
        recommendationScore: item.score,
        recommendationReason: item.reason,
      })),
      count: recommended.length,
    });
  } catch (error: any) {
    logger.error('Failed to get recommendations', { error });
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}
