import { CronJob } from 'cron';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Cron job that runs daily to calculate artist similarity scores
 * Improves discovery recommendations over time
 */
export const calculateArtistSimilarityJob = new CronJob(
  '0 2 * * *', // Daily at 2 AM UTC
  async () => {
    await calculateArtistSimilarities();
  },
  null,
  false, // Don't start automatically
  'UTC'
);

/**
 * Main function to calculate similarity scores between artists
 */
export async function calculateArtistSimilarities() {
  const startTime = Date.now();
  logger.info('Starting artist similarity calculation');

  try {
    // Get all active artists with content
    const artists = await prisma.users.findMany({
      where: {
        role: 'ARTIST',
        artists: {
          isStripeOnboarded: true,
        },
      },
      include: {
        artists: true,
        content: {
          where: { publishedAt: { not: null } },
          select: { id: true },
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          select: { fanId: true },
        },
      },
    });

    // Filter artists with at least 1 piece of content
    const activeArtists = artists.filter((artist) => artist.content.length > 0);

    logger.info(`Calculating similarities for ${activeArtists.length} artists`);

    let totalSimilarities = 0;
    let totalProcessed = 0;

    // Calculate similarities for each artist
    for (const artist of activeArtists) {
      try {
        const similarities = await calculateSimilaritiesForArtist(
          artist,
          activeArtists
        );
        totalSimilarities += similarities;
        totalProcessed++;

        // Log progress every 10 artists
        if (totalProcessed % 10 === 0) {
          logger.info(`Processed ${totalProcessed}/${activeArtists.length} artists`);
        }
      } catch (error: any) {
        logger.error('Failed to calculate similarities for artist', {
          artistId: artist.id,
          error: error.message,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Completed artist similarity calculation', {
      duration: `${duration}ms`,
      artistsProcessed: totalProcessed,
      similaritiesCalculated: totalSimilarities,
    });
  } catch (error: any) {
    logger.error('Failed to run artist similarity calculation', { error });
  }
}

/**
 * Calculate similarity scores for a single artist
 */
async function calculateSimilaritiesForArtist(
  sourceArtist: any,
  allArtists: any[]
): Promise<number> {
  const sourceId = sourceArtist.id;
  const sourceData = sourceArtist.artists;

  if (!sourceData) {
    return 0;
  }

  const sourceGenre = sourceData.genre;
  const sourceTags = Array.isArray(sourceData.tags) ? sourceData.tags : [];
  const sourceSubscribers = new Set(
    sourceArtist.subscriptions.map((s: any) => s.fanId)
  );

  const similarities: Array<{
    artistId: string;
    similarArtistId: string;
    similarityScore: number;
    sharedTags: string[];
    sharedGenre: string | null;
  }> = [];

  // Compare with all other artists
  for (const targetArtist of allArtists) {
    if (targetArtist.id === sourceId) continue; // Skip self

    const targetData = targetArtist.artists;
    if (!targetData) continue;

    const targetGenre = targetData.genre;
    const targetTags = Array.isArray(targetData.tags) ? targetData.tags : [];
    const targetSubscribers = new Set(
      targetArtist.subscriptions.map((s: any) => s.fanId)
    );

    // Calculate similarity score
    let score = 0;
    const sharedTags: string[] = [];

    // 1. Genre match (40% weight)
    if (sourceGenre && targetGenre && sourceGenre === targetGenre) {
      score += 0.4;
    }

    // 2. Tag overlap (30% weight)
    sourceTags.forEach((tag: string) => {
      if (targetTags.includes(tag)) {
        sharedTags.push(tag);
      }
    });

    const tagOverlap =
      sharedTags.length /
      Math.max(sourceTags.length || 1, targetTags.length || 1);
    score += tagOverlap * 0.3;

    // 3. Shared subscribers (30% weight - collaborative filtering)
    const sharedSubscribers = Array.from(sourceSubscribers).filter((fanId) =>
      targetSubscribers.has(fanId)
    );
    const subscriberOverlap =
      sharedSubscribers.length /
      Math.max(
        sourceSubscribers.size || 1,
        targetSubscribers.size || 1
      );
    score += subscriberOverlap * 0.3;

    // Only store similarities above threshold
    if (score >= 0.15) {
      similarities.push({
        artistId: sourceId,
        similarArtistId: targetArtist.id,
        similarityScore: Math.min(score, 1.0), // Cap at 1.0
        sharedTags,
        sharedGenre:
          sourceGenre && targetGenre && sourceGenre === targetGenre
            ? sourceGenre
            : null,
      });
    }
  }

  // Sort by score and keep top 20
  similarities.sort((a, b) => b.similarityScore - a.similarityScore);
  const topSimilarities = similarities.slice(0, 20);

  // Upsert to database
  for (const sim of topSimilarities) {
    await prisma.artist_similarity.upsert({
      where: {
        artistId_similarArtistId: {
          artistId: sim.artistId,
          similarArtistId: sim.similarArtistId,
        },
      },
      create: {
        artistId: sim.artistId,
        similarArtistId: sim.similarArtistId,
        similarityScore: sim.similarityScore,
        sharedTags: sim.sharedTags,
        sharedGenre: sim.sharedGenre,
        calculatedAt: new Date(),
      },
      update: {
        similarityScore: sim.similarityScore,
        sharedTags: sim.sharedTags,
        sharedGenre: sim.sharedGenre,
        updatedAt: new Date(),
      },
    });
  }

  logger.info('Calculated similarities for artist', {
    artistId: sourceId,
    similaritiesFound: topSimilarities.length,
  });

  return topSimilarities.length;
}

/**
 * Start the cron job
 */
export function startArtistSimilarityJob() {
  calculateArtistSimilarityJob.start();
  logger.info('Artist similarity calculation job started');
}

/**
 * Stop the cron job
 */
export function stopArtistSimilarityJob() {
  calculateArtistSimilarityJob.stop();
  logger.info('Artist similarity calculation job stopped');
}

/**
 * Run immediately (for manual trigger)
 */
export async function runArtistSimilarityCalculation() {
  logger.info('Manually triggering artist similarity calculation');
  await calculateArtistSimilarities();
}
