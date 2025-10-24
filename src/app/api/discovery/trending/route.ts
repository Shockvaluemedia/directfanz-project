import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/discovery/trending
 * Returns trending artists based on recent subscription growth
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const days = parseInt(searchParams.get('days') || '7');

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Get artists with most new subscriptions in the period
    const trendingData = await prisma.subscriptions.groupBy({
      by: ['artistId'],
      where: {
        createdAt: {
          gte: dateThreshold,
        },
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      _count: {
        artistId: true,
      },
      orderBy: {
        _count: {
          artistId: 'desc',
        },
      },
      take: limit,
    });

    // Get full artist details
    const artistIds = trendingData.map((item) => item.artistId);

    const artists = await prisma.users.findMany({
      where: {
        id: { in: artistIds },
        role: 'ARTIST',
      },
      include: {
        artists: true,
        tiers: {
          where: { isActive: true },
          orderBy: { minimumPrice: 'asc' },
          take: 1,
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          select: { id: true },
        },
        content: {
          where: { publishedAt: { not: null } },
          orderBy: { publishedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    // Calculate growth percentage
    const artistsWithGrowth = await Promise.all(
      artists.map(async (artist) => {
        const trendingItem = trendingData.find((item) => item.artistId === artist.id);
        const newSubscribers = trendingItem?._count.artistId || 0;

        // Get total subscribers
        const totalSubscribers = artist.subscriptions.length;

        // Calculate growth percentage
        const oldSubscribers = Math.max(totalSubscribers - newSubscribers, 1);
        const growthPercent = ((newSubscribers / oldSubscribers) * 100).toFixed(0);

        return {
          ...artist,
          trendingStats: {
            newSubscribers,
            totalSubscribers,
            growthPercent: parseInt(growthPercent),
            period: `${days} days`,
          },
        };
      })
    );

    // Sort by new subscribers (maintain trending order)
    artistsWithGrowth.sort(
      (a, b) =>
        b.trendingStats.newSubscribers - a.trendingStats.newSubscribers
    );

    logger.info('Generated trending artists', {
      count: artistsWithGrowth.length,
      days,
    });

    return NextResponse.json({
      success: true,
      section: 'Trending Now',
      artists: artistsWithGrowth,
      count: artistsWithGrowth.length,
    });
  } catch (error: any) {
    logger.error('Failed to get trending artists', { error });
    return NextResponse.json(
      { error: 'Failed to get trending artists' },
      { status: 500 }
    );
  }
}
