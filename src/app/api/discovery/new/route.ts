import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/discovery/new
 * Returns new and noteworthy artists (recently joined with quality content)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const days = parseInt(searchParams.get('days') || '30');

    // Calculate date threshold (artists who joined in last N days)
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Find recently joined artists with content
    const newArtists = await prisma.users.findMany({
      where: {
        role: 'ARTIST',
        createdAt: {
          gte: dateThreshold,
        },
        artists: {
          isStripeOnboarded: true,
        },
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
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            publishedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter artists with at least 1 piece of content
    const artistsWithContent = newArtists.filter(
      (artist) => artist.content.length > 0 && artist.tiers.length > 0
    );

    // Calculate days since joining
    const artistsWithMetadata = artistsWithContent.slice(0, limit).map((artist) => {
      const joinedDaysAgo = Math.floor(
        (Date.now() - new Date(artist.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...artist,
        newArtistStats: {
          joinedDaysAgo,
          contentCount: artist.content.length,
          subscriberCount: artist.subscriptions.length,
          isNew: joinedDaysAgo <= 7,
        },
      };
    });

    logger.info('Generated new artists', {
      count: artistsWithMetadata.length,
      days,
    });

    return NextResponse.json({
      success: true,
      section: 'New & Noteworthy',
      artists: artistsWithMetadata,
      count: artistsWithMetadata.length,
    });
  } catch (error: any) {
    logger.error('Failed to get new artists', { error });
    return NextResponse.json(
      { error: 'Failed to get new artists' },
      { status: 500 }
    );
  }
}
