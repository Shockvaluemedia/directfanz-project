import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const recommendationSchema = z.object({
  type: z.enum(['artists', 'content', 'tiers', 'mixed']).default('mixed'),
  limit: z.number().min(1).max(50).default(10),
  includeSubscribed: z.boolean().default(false),
  contentTypes: z.array(z.enum(['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'])).optional(),
  priceRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  return withApi(request, async req => {
    try {
      const { searchParams } = new URL(request.url);

      const params = recommendationSchema.parse({
        type: searchParams.get('type') || 'mixed',
        limit: parseInt(searchParams.get('limit') || '10'),
        includeSubscribed: searchParams.get('includeSubscribed') === 'true',
        contentTypes: searchParams.get('contentTypes')?.split(',') as any,
        priceRange: {
          min: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
          max: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
        },
      });

      let recommendations: any = {
        artists: [],
        content: [],
        tiers: [],
        algorithm: 'basic', // Would be 'ml' or 'collaborative' in production
      };

      // Get user's subscription history and preferences
      const userProfile = await getUserProfile(req.user.id);

      if (params.type === 'artists' || params.type === 'mixed') {
        recommendations.artists = await getArtistRecommendations(req.user.id, userProfile, params);
      }

      if (params.type === 'content' || params.type === 'mixed') {
        recommendations.content = await getContentRecommendations(req.user.id, userProfile, params);
      }

      if (params.type === 'tiers' || params.type === 'mixed') {
        recommendations.tiers = await getTierRecommendations(req.user.id, userProfile, params);
      }

      logger.info('Recommendations generated', {
        userId: req.user.id,
        type: params.type,
        artistCount: recommendations.artists.length,
        contentCount: recommendations.content.length,
        tierCount: recommendations.tiers.length,
      });

      return NextResponse.json({
        success: true,
        data: recommendations,
        metadata: {
          generatedAt: new Date().toISOString(),
          algorithm: recommendations.algorithm,
          userPreferences: userProfile
            ? {
                subscribedArtists: userProfile.subscribedArtists.length,
                favoriteGenres: userProfile.favoriteContentTypes,
                priceRange: userProfile.averageSpending,
              }
            : {
                subscribedArtists: 0,
                favoriteGenres: [],
                priceRange: 0,
              },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid parameters',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Recommendations endpoint error', { userId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
    }
  });
}

async function getUserProfile(userId: string) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        include: {
          tier: {
            include: {
              artist: {
                select: {
                  id: true,
                  displayName: true,
                  bio: true,
                },
              },
            },
          },
        },
      },
      comments: {
        include: {
          content: {
            select: {
              type: true,
              tags: true,
              artistId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!user) return null;

  // Analyze user preferences
  const subscribedArtists = user.subscriptions.map(sub => sub.tiers.artist);
  const contentTypes = user.comments.map(comment => comment.content.type);
  const engagedArtists = Array.from(
    new Set(user.comments.map(comment => comment.content.artistId))
  );
  const averageSpending =
    user.subscriptions.reduce((sum, sub) => sum + parseFloat(sub.amount.toString()), 0) /
    Math.max(user.subscriptions.length, 1);

  // Extract content preferences from comments and subscriptions
  const favoriteContentTypes = getMostFrequent(contentTypes);
  const allTags = user.comments.flatMap(comment => comment.content.tags);
  const favoriteTags = getMostFrequent(allTags);

  return {
    subscribedArtists,
    engagedArtists,
    favoriteContentTypes,
    favoriteTags,
    averageSpending,
  };
}

async function getArtistRecommendations(userId: string, userProfile: any, params: any) {
  if (!userProfile) return [];

  // Collaborative filtering: Find artists liked by users with similar tastes
  const similarUsers = await findSimilarUsers(userId, userProfile);

  // Content-based filtering: Find artists similar to those user already follows
  const excludeArtistIds = params.includeSubscribed
    ? []
    : userProfile.subscribedArtists.map((artist: any) => artist.id);

  const artistRecommendations = await prisma.users.findMany({
    where: {
      role: 'ARTIST',
      id: { notIn: excludeArtistIds },
      // Bio similarity (simplified - in production would use vector similarity)
      ...(userProfile.favoriteTags.length > 0 && {
        OR: userProfile.favoriteTags.map((tag: string) => ({
          bio: { contains: tag },
        })),
      }),
    },
    include: {
      artists: true,
      tiers: {
        where: {
          isActive: true,
          ...(params.priceRange?.min && { minimumPrice: { gte: params.priceRange.min } }),
          ...(params.priceRange?.max && { minimumPrice: { lte: params.priceRange.max } }),
        },
        orderBy: { minimumPrice: 'asc' },
        take: 3,
      },
      content: {
        where: {
          isPublic: true,
          ...(params.contentTypes && { type: { in: params.contentTypes } }),
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          type: true,
          thumbnailUrl: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          content: true,
        },
      },
    },
    orderBy: [
      { artists: { totalSubscribers: 'desc' } }, // Popular first
      { createdAt: 'desc' }, // Then newest
    ],
    take: params.type === 'artists' ? params.limit : Math.ceil(params.limit / 3),
  });

  return artistRecommendations.map(artist => ({
    id: artist.id,
    displayName: artist.displayName,
    bio: artist.bio,
    avatar: artist.avatar,
    totalSubscribers: artist.artists?.totalSubscribers || 0,
    totalEarnings: artist.artists?.totalEarnings || 0,
    contentCount: artist._count.content,
    lowestTierPrice: artist.tiers[0]?.minimumPrice || null,
    recentContent: artist.content,
    recommendationScore: calculateArtistScore(artist, userProfile),
    recommendationReasons: getRecommendationReasons(artist, userProfile),
  }));
}

async function getContentRecommendations(userId: string, userProfile: any, params: any) {
  if (!userProfile) return [];

  const excludeArtistIds = params.includeSubscribed
    ? []
    : userProfile.subscribedArtists.map((artist: any) => artist.id);

  const contentRecommendations = await prisma.content.findMany({
    where: {
      isPublic: true,
      artistId: { notIn: excludeArtistIds },
      ...(params.contentTypes && { type: { in: params.contentTypes } }),
      ...(userProfile.favoriteContentTypes.length > 0 && {
        type: { in: userProfile.favoriteContentTypes },
      }),
      // Tag-based similarity
      ...(userProfile.favoriteTags.length > 0 && {
        tags: {
          hasSome: userProfile.favoriteTags,
        },
      }),
    },
    include: {
      artist: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
        },
      },
      tiers: {
        where: {
          isActive: true,
          ...(params.priceRange?.min && { minimumPrice: { gte: params.priceRange.min } }),
          ...(params.priceRange?.max && { minimumPrice: { lte: params.priceRange.max } }),
        },
        select: {
          id: true,
          name: true,
          minimumPrice: true,
        },
        orderBy: { minimumPrice: 'asc' },
        take: 1,
      },
      _count: {
        select: {
          comments: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'desc' }, // Newest first
      { comments: { _count: 'desc' } }, // Then most discussed
    ],
    take: params.type === 'content' ? params.limit : Math.ceil(params.limit / 3),
  });

  return contentRecommendations.map(content => ({
    id: content.id,
    title: content.title,
    description: content.description,
    type: content.type,
    thumbnailUrl: content.thumbnailUrl,
    duration: content.duration,
    tags: content.tags,
    createdAt: content.createdAt,
    artist: content.artist,
    requiredTier: content.tiers[0] || null,
    commentCount: content._count.comments,
    recommendationScore: calculateContentScore(content, userProfile),
    recommendationReasons: getContentRecommendationReasons(content, userProfile),
  }));
}

async function getTierRecommendations(userId: string, userProfile: any, params: any) {
  if (!userProfile) return [];

  const excludeArtistIds = params.includeSubscribed
    ? []
    : userProfile.subscribedArtists.map((artist: any) => artist.id);

  const tierRecommendations = await prisma.tiers.findMany({
    where: {
      isActive: true,
      artistId: { notIn: excludeArtistIds },
      ...(params.priceRange?.min && { minimumPrice: { gte: params.priceRange.min } }),
      ...(params.priceRange?.max && { minimumPrice: { lte: params.priceRange.max } }),
      // Price similarity to user's current spending
      minimumPrice: {
        gte: userProfile.averageSpending * 0.5, // 50% below average
        lte: userProfile.averageSpending * 2, // 200% above average
      },
    },
    include: {
      artist: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
          bio: true,
        },
      },
      content: {
        where: {
          isPublic: true,
          ...(params.contentTypes && { type: { in: params.contentTypes } }),
        },
        select: {
          id: true,
          title: true,
          type: true,
          thumbnailUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
    orderBy: [
      { subscriberCount: 'desc' }, // Most popular first
      { minimumPrice: 'asc' }, // Then cheapest
    ],
    take: params.type === 'tiers' ? params.limit : Math.ceil(params.limit / 3),
  });

  return tierRecommendations.map(tier => ({
    id: tier.id,
    name: tier.name,
    description: tier.description,
    minimumPrice: tier.minimumPrice,
    subscriberCount: tier.subscriberCount,
    artist: tier.artist,
    sampleContent: tier.content,
    recommendationScore: calculateTierScore(tier, userProfile),
    valueProposition: calculateValueProposition(tier, userProfile.averageSpending),
  }));
}

// Utility functions for recommendation scoring
function calculateArtistScore(artist: any, userProfile: any): number {
  let score = 0;

  // Popularity factor
  score += Math.min(artist.artists?.totalSubscribers || 0, 1000) / 100;

  // Content volume factor
  score += Math.min(artist._count.content, 50) / 10;

  // Tag similarity (simplified)
  const artistTags = extractTagsFromBio(artist.bio || '');
  const commonTags = artistTags.filter(tag => userProfile.favoriteTags.includes(tag));
  score += commonTags.length * 2;

  return Math.round(score * 10) / 10;
}

function calculateContentScore(content: any, userProfile: any): number {
  let score = 0;

  // Type preference
  if (userProfile.favoriteContentTypes.includes(content.type)) {
    score += 3;
  }

  // Tag similarity
  const commonTags = content.tags.filter((tag: string) => userProfile.favoriteTags.includes(tag));
  score += commonTags.length * 2;

  // Engagement factor
  score += Math.min(content._count.comments, 50) / 10;

  // Recency factor
  const daysOld = (Date.now() - new Date(content.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 7 - daysOld); // Newer content gets higher score

  return Math.round(score * 10) / 10;
}

function calculateTierScore(tier: any, userProfile: any): number {
  let score = 0;

  // Popularity factor
  score += Math.min(tier.subscriberCount, 100) / 20;

  // Price appropriateness
  const priceRatio = parseFloat(tier.minimumPrice.toString()) / userProfile.averageSpending;
  if (priceRatio >= 0.5 && priceRatio <= 1.5) {
    score += 5; // Sweet spot
  } else if (priceRatio < 0.5) {
    score += 3; // Cheaper is good
  } else {
    score += 1; // Too expensive
  }

  return Math.round(score * 10) / 10;
}

function getRecommendationReasons(artist: any, userProfile: any): string[] {
  const reasons = [];

  if (artist.artists?.totalSubscribers > 100) {
    reasons.push('Popular creator with many subscribers');
  }

  if (artist._count.content > 10) {
    reasons.push('Prolific content creator');
  }

  const artistTags = extractTagsFromBio(artist.bio || '');
  const commonTags = artistTags.filter(tag => userProfile.favoriteTags.includes(tag));
  if (commonTags.length > 0) {
    reasons.push(`Shares interests in: ${commonTags.slice(0, 2).join(', ')}`);
  }

  return reasons;
}

function getContentRecommendationReasons(content: any, userProfile: any): string[] {
  const reasons = [];

  if (userProfile.favoriteContentTypes.includes(content.type)) {
    reasons.push(`Matches your preference for ${content.type.toLowerCase()} content`);
  }

  const commonTags = content.tags.filter((tag: string) => userProfile.favoriteTags.includes(tag));
  if (commonTags.length > 0) {
    reasons.push(`Tagged with: ${commonTags.slice(0, 2).join(', ')}`);
  }

  if (content._count.comments > 10) {
    reasons.push('Highly discussed content');
  }

  return reasons;
}

function calculateValueProposition(tier: any, averageSpending: number): string {
  const price = parseFloat(tier.minimumPrice.toString());

  if (price < averageSpending * 0.8) {
    return 'Great value - below your usual spending';
  } else if (price > averageSpending * 1.2) {
    return 'Premium tier - higher than usual but quality content';
  } else {
    return 'Right in your price range';
  }
}

async function findSimilarUsers(userId: string, userProfile: any): Promise<string[]> {
  // Simplified similar user finding
  // In production, this would use collaborative filtering algorithms
  const similarUsers = await prisma.users.findMany({
    where: {
      role: 'FAN',
      id: { not: userId },
      subscriptions: {
        some: {
          artistId: { in: userProfile.subscribedArtists.map((a: any) => a.id) },
        },
      },
    },
    take: 10,
    select: { id: true },
  });

  return similarUsers.map(user => user.id);
}

function getMostFrequent<T>(arr: T[]): T[] {
  const frequency = arr.reduce(
    (acc, item) => {
      acc[item as any] = (acc[item as any] || 0) + 1;
      return acc;
    },
    {} as Record<any, number>
  );

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([item]) => item as T);
}

function extractTagsFromBio(bio: string): string[] {
  // Simple tag extraction from bio
  const commonWords = [
    'music',
    'art',
    'photo',
    'video',
    'creative',
    'indie',
    'pop',
    'rock',
    'electronic',
  ];
  return commonWords.filter(word => bio.toLowerCase().includes(word));
}
