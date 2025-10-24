import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/discovery/similar/[artistId]
 * Returns artists similar to the given artist
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { artistId: string } }
) {
  try {
    const artistId = params.artistId;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Try to get pre-computed similar artists
    let similarArtists = await prisma.artist_similarity.findMany({
      where: { artistId },
      orderBy: { similarityScore: 'desc' },
      take: limit,
      include: {
        similarArtist: {
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
          },
        },
      },
    });

    // If no pre-computed similarities, calculate on-the-fly
    if (similarArtists.length === 0) {
      logger.info('No pre-computed similarities, calculating on-the-fly', {
        artistId,
      });

      const calculated = await calculateSimilarArtists(artistId, limit);
      return NextResponse.json({
        success: true,
        artists: calculated,
        count: calculated.length,
        computed: 'on-the-fly',
      });
    }

    const artists = similarArtists.map((sim) => ({
      ...sim.similarArtist,
      similarityScore: sim.similarityScore,
      sharedTags: sim.sharedTags,
      sharedGenre: sim.sharedGenre,
    }));

    logger.info('Retrieved similar artists', {
      artistId,
      count: artists.length,
    });

    return NextResponse.json({
      success: true,
      artists,
      count: artists.length,
      computed: 'pre-computed',
    });
  } catch (error: any) {
    logger.error('Failed to get similar artists', { artistId: params.artistId, error });
    return NextResponse.json(
      { error: 'Failed to get similar artists' },
      { status: 500 }
    );
  }
}

/**
 * Calculate similar artists on-the-fly based on shared attributes
 */
async function calculateSimilarArtists(artistId: string, limit: number) {
  // Get the source artist
  const sourceArtist = await prisma.users.findUnique({
    where: { id: artistId },
    include: { artists: true },
  });

  if (!sourceArtist || !sourceArtist.artists) {
    return [];
  }

  const sourceGenre = sourceArtist.artists.genre;
  const sourceTags = Array.isArray(sourceArtist.artists.tags)
    ? sourceArtist.artists.tags
    : [];

  // Find artists with matching genre or tags
  const candidates = await prisma.users.findMany({
    where: {
      role: 'ARTIST',
      id: { not: artistId },
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
    },
    take: 100,
  });

  // Calculate similarity scores
  const scored = candidates
    .map((candidate) => {
      if (!candidate.artists) return null;

      let score = 0;
      const sharedTags: string[] = [];

      // Genre match (50% weight)
      if (sourceGenre && candidate.artists.genre === sourceGenre) {
        score += 0.5;
      }

      // Tag match (50% weight)
      const candidateTags = Array.isArray(candidate.artists.tags)
        ? candidate.artists.tags
        : [];

      candidateTags.forEach((tag: string) => {
        if (sourceTags.includes(tag)) {
          sharedTags.push(tag);
          score += 0.5 / Math.max(sourceTags.length, candidateTags.length);
        }
      });

      if (score === 0) return null;

      return {
        ...candidate,
        similarityScore: score,
        sharedTags,
        sharedGenre: sourceGenre === candidate.artists.genre ? sourceGenre : null,
      };
    })
    .filter((item) => item !== null && item.similarityScore > 0.1)
    .sort((a, b) => b!.similarityScore - a!.similarityScore)
    .slice(0, limit);

  return scored;
}
