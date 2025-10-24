import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface UserProfile {
  genres: string[];
  tags: string[];
  priceRange: [number, number];
  averageEngagementDuration: number;
}

interface ScoredArtist {
  artist: any;
  score: number;
  reason: string;
}

/**
 * Recommendation Engine
 * Provides personalized artist recommendations using multiple signals
 */
export class RecommendationEngine {
  /**
   * Get personalized feed for a user
   */
  async getPersonalizedFeed(userId: string, limit: number = 20): Promise<ScoredArtist[]> {
    try {
      // 1. Get user's interaction history
      const interactions = await this.getUserInteractions(userId);

      // 2. Build user profile from interactions
      const profile = await this.buildUserProfile(userId, interactions);

      // 3. Get candidate artists (exclude already subscribed)
      const candidates = await this.getCandidateArtists(userId, profile);

      if (candidates.length === 0) {
        return this.getFallbackRecommendations(limit);
      }

      // 4. Score and rank artists
      const ranked = await this.rankArtists(candidates, profile, interactions);

      // 5. Apply diversity filter
      const diverse = this.diversifyResults(ranked);

      // 6. Return top N
      return diverse.slice(0, limit);
    } catch (error: any) {
      logger.error('Failed to generate personalized feed', { userId, error });
      return this.getFallbackRecommendations(limit);
    }
  }

  /**
   * Get user's interaction history
   */
  private async getUserInteractions(userId: string) {
    return await prisma.user_interactions.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500, // Last 500 interactions
    });
  }

  /**
   * Build user profile from interactions
   */
  private async buildUserProfile(
    userId: string,
    interactions: any[]
  ): Promise<UserProfile> {
    // Get subscribed artists to analyze preferences
    const subscriptions = await prisma.subscriptions.findMany({
      where: {
        fanId: userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: {
        artist: {
          include: {
            artists: true,
          },
        },
        tier: true,
      },
    });

    // Extract genres and tags from subscribed artists
    const genres = new Set<string>();
    const tags = new Set<string>();
    const prices: number[] = [];

    for (const sub of subscriptions) {
      const artist = sub.artist?.artists;
      if (artist) {
        if (artist.genre) genres.add(artist.genre);
        if (Array.isArray(artist.tags)) {
          artist.tags.forEach((tag: string) => tags.add(tag));
        }
      }
      if (sub.tier) {
        prices.push(Number(sub.tier.minimumPrice));
      }
    }

    // Calculate average engagement duration
    const viewInteractions = interactions.filter(
      (i) => i.interactionType === 'VIEW' && i.duration
    );
    const avgDuration =
      viewInteractions.length > 0
        ? viewInteractions.reduce((sum, i) => sum + (i.duration || 0), 0) /
          viewInteractions.length
        : 60; // Default 60 seconds

    // Calculate price range
    const minPrice = prices.length > 0 ? Math.min(...prices) : 5;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 25;

    return {
      genres: Array.from(genres),
      tags: Array.from(tags),
      priceRange: [minPrice, maxPrice],
      averageEngagementDuration: avgDuration,
    };
  }

  /**
   * Get candidate artists for recommendation
   */
  private async getCandidateArtists(userId: string, profile: UserProfile) {
    // Get IDs of artists user is already subscribed to
    const subscribedArtistIds = await prisma.subscriptions
      .findMany({
        where: {
          fanId: userId,
          status: { in: ['ACTIVE', 'TRIALING', 'CANCELED'] },
        },
        select: { artistId: true },
      })
      .then((subs) => subs.map((s) => s.artistId));

    // Find artists matching user's profile
    const candidates = await prisma.users.findMany({
      where: {
        role: 'ARTIST',
        id: { notIn: [userId, ...subscribedArtistIds] },
        artists: {
          isStripeOnboarded: true, // Only show artists who can accept payments
        },
      },
      include: {
        artists: true,
        tiers: {
          where: { isActive: true },
          orderBy: { minimumPrice: 'asc' },
          take: 1,
        },
        content: {
          where: { publishedAt: { not: null } },
          orderBy: { publishedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            publishedAt: true,
          },
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          select: { id: true },
        },
      },
      take: 100, // Get pool of candidates
    });

    // Filter out artists with no tiers or no content
    return candidates.filter(
      (artist) => artist.tiers.length > 0 && artist.content.length > 0
    );
  }

  /**
   * Rank artists using multi-factor scoring
   */
  private async rankArtists(
    candidates: any[],
    profile: UserProfile,
    interactions: any[]
  ): Promise<ScoredArtist[]> {
    const scored: ScoredArtist[] = [];

    for (const candidate of candidates) {
      let totalScore = 0;
      const reasons: string[] = [];

      const artist = candidate.artists;
      if (!artist) continue;

      // 1. Genre match (30% weight)
      const genreScore = this.calculateGenreMatch(artist, profile);
      totalScore += genreScore * 0.3;
      if (genreScore > 0.7 && artist.genre) {
        reasons.push(`You like ${artist.genre} music`);
      }

      // 2. Tag match (20% weight)
      const tagScore = this.calculateTagMatch(artist, profile);
      totalScore += tagScore * 0.2;
      if (tagScore > 0.5 && Array.isArray(artist.tags) && artist.tags.length > 0) {
        const sharedTags = artist.tags.filter((t: string) =>
          profile.tags.includes(t)
        );
        if (sharedTags.length > 0) {
          reasons.push(`Similar to artists you follow`);
        }
      }

      // 3. Popularity (15% weight)
      const popularityScore = this.calculatePopularity(candidate);
      totalScore += popularityScore * 0.15;
      if (popularityScore > 0.7) {
        reasons.push(`Popular with ${candidate.subscriptions.length} fans`);
      }

      // 4. Activity (10% weight)
      const activityScore = this.calculateActivity(candidate);
      totalScore += activityScore * 0.1;
      if (activityScore > 0.8) {
        reasons.push('Actively posting content');
      }

      // 5. Price match (10% weight)
      const priceScore = this.calculatePriceMatch(candidate, profile);
      totalScore += priceScore * 0.1;

      // 6. Collaborative filtering (15% weight)
      const cfScore = await this.collaborativeFiltering(candidate.id, interactions);
      totalScore += cfScore * 0.15;
      if (cfScore > 0.5) {
        reasons.push('Recommended for you');
      }

      // Only recommend artists with a reasonable score
      if (totalScore > 0.2) {
        scored.push({
          artist: candidate,
          score: totalScore,
          reason: reasons.length > 0 ? reasons[0] : 'Recommended for you',
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate genre match score
   */
  private calculateGenreMatch(artist: any, profile: UserProfile): number {
    if (!artist.genre || profile.genres.length === 0) return 0.3; // Neutral score

    return profile.genres.includes(artist.genre) ? 1.0 : 0.2;
  }

  /**
   * Calculate tag match score
   */
  private calculateTagMatch(artist: any, profile: UserProfile): number {
    if (!Array.isArray(artist.tags) || profile.tags.length === 0)
      return 0.3; // Neutral score

    const sharedTags = artist.tags.filter((tag: string) =>
      profile.tags.includes(tag)
    );
    const maxPossible = Math.max(artist.tags.length, profile.tags.length);

    return maxPossible > 0 ? sharedTags.length / maxPossible : 0.3;
  }

  /**
   * Calculate popularity score
   */
  private calculatePopularity(artist: any): number {
    const subCount = artist.subscriptions?.length || 0;

    // Normalize to 0-1 scale (100+ subscribers = 1.0)
    return Math.min(subCount / 100, 1.0);
  }

  /**
   * Calculate activity score (how recently artist posted content)
   */
  private calculateActivity(artist: any): number {
    if (!artist.content || artist.content.length === 0) return 0;

    const lastContentDate = new Date(artist.content[0].publishedAt);
    const daysSinceLastPost =
      (Date.now() - lastContentDate.getTime()) / (1000 * 60 * 60 * 24);

    // Active in last 7 days = 1.0, linear decay to 0 at 90 days
    if (daysSinceLastPost <= 7) return 1.0;
    if (daysSinceLastPost >= 90) return 0;

    return 1.0 - (daysSinceLastPost - 7) / 83;
  }

  /**
   * Calculate price match score
   */
  private calculatePriceMatch(artist: any, profile: UserProfile): number {
    if (!artist.tiers || artist.tiers.length === 0) return 0.5;

    const tierPrice = Number(artist.tiers[0].minimumPrice);
    const [minPrice, maxPrice] = profile.priceRange;

    // Perfect match if within user's preferred range
    if (tierPrice >= minPrice && tierPrice <= maxPrice) return 1.0;

    // Slight penalty if outside range
    if (tierPrice < minPrice) return 0.7;
    if (tierPrice > maxPrice) return 0.6;

    return 0.5;
  }

  /**
   * Collaborative filtering - find similar users and see what they like
   */
  private async collaborativeFiltering(
    artistId: string,
    userInteractions: any[]
  ): number {
    try {
      // Find users who viewed/liked similar content
      const viewedTargets = userInteractions
        .filter((i) => i.interactionType === 'VIEW')
        .map((i) => i.targetId);

      if (viewedTargets.length === 0) return 0.3;

      // Find other users who viewed the same content
      const similarUserInteractions = await prisma.user_interactions.findMany({
        where: {
          targetId: { in: viewedTargets },
          interactionType: 'VIEW',
        },
        select: { userId: true },
        distinct: ['userId'],
        take: 50,
      });

      const similarUserIds = similarUserInteractions.map((i) => i.userId);

      if (similarUserIds.length === 0) return 0.3;

      // Check how many of these similar users subscribe to this artist
      const similarUsersSubscribed = await prisma.subscriptions.count({
        where: {
          fanId: { in: similarUserIds },
          artistId: artistId,
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
      });

      return similarUsersSubscribed / similarUserIds.length;
    } catch (error) {
      logger.error('Collaborative filtering error', { error });
      return 0.3;
    }
  }

  /**
   * Diversify results to avoid too much similarity
   */
  private diversifyResults(scored: ScoredArtist[]): ScoredArtist[] {
    const diverse: ScoredArtist[] = [];
    const seenGenres = new Set<string>();

    for (const item of scored) {
      const genre = item.artist.artists?.genre;

      // Allow max 3 artists per genre in top results
      const genreCount = Array.from(seenGenres).filter((g) => g === genre).length;

      if (!genre || genreCount < 3) {
        diverse.push(item);
        if (genre) seenGenres.add(genre);
      }

      if (diverse.length >= scored.length) break;
    }

    return diverse;
  }

  /**
   * Fallback recommendations when user has no history
   */
  private async getFallbackRecommendations(limit: number): Promise<ScoredArtist[]> {
    // Return most popular active artists
    const popular = await prisma.users.findMany({
      where: {
        role: 'ARTIST',
        artists: {
          isStripeOnboarded: true,
        },
      },
      include: {
        artists: true,
        tiers: {
          where: { isActive: true },
          take: 1,
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          select: { id: true },
        },
      },
      orderBy: {
        subscriptions: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return popular.map((artist) => ({
      artist,
      score: 0.5,
      reason: 'Popular on DirectFanz',
    }));
  }
}
