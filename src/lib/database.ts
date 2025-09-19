import { prisma } from './prisma';
import { UserRole, ContentType, SubscriptionStatus } from '@/lib/types/enums';

// Export prisma for use in API routes
export { prisma };
import type {
  ArtistWithUser,
  TierWithArtist,
  ContentWithArtist,
  ContentWithTiers,
  SubscriptionWithTier,
  PaginatedResponse,
} from '../types/database';
import type { User, Artist, Tier, Content, Subscription, Comment } from '@prisma/client';
import {
  CACHE_KEYS,
  CACHE_TTL,
  getCachedData,
  setCachedData,
  deleteCachedData,
  deleteCachedPattern,
  withCache,
} from './redis';
import { logger } from './logger';

// User operations
export async function getUserById(id: string) {
  const cacheKey = `${CACHE_KEYS.USER}${id}`;

  return await withCache(
    cacheKey,
    async () => {
      return await prisma.users.findUnique({
        where: { id },
        include: {
          artists: true,
        },
      });
    },
    CACHE_TTL.MEDIUM
  );
}

export async function getUserByEmail(email: string) {
  // We don't cache by email for security reasons
  // Email lookups are typically for authentication, which should always hit the database
  return await prisma.users.findUnique({
    where: { email },
    include: {
      artists: true,
    },
  });
}

export async function createUser(data: {
  email: string;
  password?: string;
  role: UserRole;
  displayName: string;
  bio?: string;
  avatar?: string;
  socialLinks?: Record<string, string>;
}) {
  const user = await prisma.users.create({
    data: {
      ...data,
      artists:
        data.role === UserRole.ARTIST
          ? {
              create: {
                isStripeOnboarded: false,
                totalEarnings: 0,
                totalSubscribers: 0,
              },
            }
          : undefined,
    },
    include: {
      artists: true,
    },
  });

  // Cache the new user
  if (user) {
    await setCachedData(`${CACHE_KEYS.USER}${user.id}`, user, CACHE_TTL.MEDIUM);
  }

  return user;
}

// Artist operations
export async function getArtistById(id: string): Promise<ArtistWithUser | null> {
  const cacheKey = `${CACHE_KEYS.ARTIST}${id}`;

  return await withCache(
    cacheKey,
    async () => {
      const artist = await prisma.users.findUnique({
        where: {
          id,
          role: UserRole.ARTIST,
        },
        include: {
          artists: true,
        },
      });

      if (!artist || !artist.artists) return null;

      return {
        ...users.artists,
        totalEarnings: Number(artist.artists.totalEarnings),
        user: artist,
      } as ArtistWithUser;
    },
    CACHE_TTL.MEDIUM
  );
}

export async function getArtists(
  options: {
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'subscribers' | 'created';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<PaginatedResponse<ArtistWithUser>> {
  const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = options;

  // Create a cache key based on the query parameters
  const cacheKey = `${CACHE_KEYS.ARTISTS_LIST}${page}_${limit}_${sortBy}_${sortOrder}`;

  return await withCache(
    cacheKey,
    async () => {
      const skip = (page - 1) * limit;

      const orderBy =
        sortBy === 'name'
          ? { displayName: sortOrder }
          : sortBy === 'subscribers'
            ? { artists: { totalSubscribers: sortOrder } }
            : { createdAt: sortOrder };

      const [artists, total] = await Promise.all([
        prisma.users.findMany({
          where: { role: UserRole.ARTIST },
          include: { artists: true },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.users.count({
          where: { role: UserRole.ARTIST },
        }),
      ]);

      const data = artists
        .filter(artist => artist.artists)
        .map(artist => ({
          ...users.artists!,
          totalEarnings: Number(artist.artists!.totalEarnings),
          user: artist,
        })) as ArtistWithUser[];

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    },
    CACHE_TTL.SHORT // Short TTL since artist list changes frequently
  );
}

// Tier operations
export async function getTiersByArtistId(artistId: string) {
  const cacheKey = `${CACHE_KEYS.TIERS_BY_ARTIST}${artistId}`;

  return await withCache(
    cacheKey,
    async () => {
      const tiers = await prisma.tiers.findMany({
        where: { artistId },
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE },
              },
            },
          },
        },
        orderBy: { minimumPrice: 'asc' },
      });

      return tiers.map(tier => ({
        ...tier,
        minimumPrice: Number(tier.minimumPrice),
        subscriberCount: tier._count.subscriptions,
      }));
    },
    CACHE_TTL.SHORT
  );
}

export async function getTierById(id: string, artistId?: string) {
  const cacheKey = `${CACHE_KEYS.TIER}${id}${artistId ? '_' + artistId : ''}`;

  return await withCache(
    cacheKey,
    async () => {
      const where = artistId ? { id, artistId } : { id };

      const tier = await prisma.tiers.findFirst({
        where,
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE },
              },
            },
          },
        },
      });

      if (!tier) return null;

      return {
        ...tier,
        minimumPrice: Number(tier.minimumPrice),
        subscriberCount: tier._count.subscriptions,
      };
    },
    CACHE_TTL.SHORT
  );
}

export async function createTier(data: {
  artistId: string;
  name: string;
  description: string;
  minimumPrice: number;
}) {
  // Business rule validations
  await validateTierCreation(data.artistId, data.name, data.minimumPrice);

  const tier = await prisma.tiers.create({
    data,
    include: {
      _count: {
        select: {
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE },
          },
        },
      },
    },
  });

  const result = {
    ...tier,
    minimumPrice: Number(tier.minimumPrice),
    subscriberCount: tier._count.subscriptions,
  };

  // Cache the new tier
  await setCachedData(`${CACHE_KEYS.TIER}${tier.id}`, result, CACHE_TTL.SHORT);

  // Invalidate artist tiers cache
  await deleteCachedData(`${CACHE_KEYS.TIERS_BY_ARTIST}${data.artistId}`);

  return result;
}

export async function updateTier(
  id: string,
  data: {
    name?: string;
    description?: string;
    minimumPrice?: number;
    isActive?: boolean;
  }
) {
  // Get existing tier for validation
  const existingTier = await prisma.tiers.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE },
          },
        },
      },
    },
  });

  if (!existingTier) {
    throw new Error('Tier not found');
  }

  // Business rule validations
  if (data.name && data.name !== existingTier.name) {
    await validateTierName(existingTier.artistId, data.name, id);
  }

  if (data.minimumPrice && data.minimumPrice !== Number(existingTier.minimumPrice)) {
    await validatePriceChange(id, data.minimumPrice, existingTier._count.subscriptions);
  }

  if (data.isActive === false && existingTier._count.subscriptions > 0) {
    throw new Error('Cannot deactivate tier with active subscriptions');
  }

  const tier = await prisma.tiers.update({
    where: { id },
    data,
    include: {
      _count: {
        select: {
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE },
          },
        },
      },
    },
  });

  const result = {
    ...tier,
    minimumPrice: Number(tier.minimumPrice),
    subscriberCount: tier._count.subscriptions,
  };

  // Update cache
  await setCachedData(`${CACHE_KEYS.TIER}${tier.id}`, result, CACHE_TTL.SHORT);

  // Invalidate related caches
  await deleteCachedData(`${CACHE_KEYS.TIERS_BY_ARTIST}${tier.artistId}`);

  return result;
}

export async function deleteTier(id: string): Promise<void> {
  // Check if tier has active subscriptions
  const subscriptionCount = await prisma.subscriptions.count({
    where: {
      tierId: id,
      status: SubscriptionStatus.ACTIVE,
    },
  });

  if (subscriptionCount > 0) {
    throw new Error('Cannot delete tier with active subscriptions');
  }

  // Check if tier has associated content
  const contentCount = await prisma.content.count({
    where: {
      tiers: {
        some: { id },
      },
    },
  });

  if (contentCount > 0) {
    throw new Error(
      'Cannot delete tier with associated content. Please reassign content to other tiers first.'
    );
  }

  // Get tier info for cache invalidation
  const tier = await prisma.tiers.findUnique({
    where: { id },
    select: { artistId: true },
  });

  await prisma.tiers.delete({
    where: { id },
  });

  // Invalidate caches
  if (tier) {
    await deleteCachedData(`${CACHE_KEYS.TIER}${id}`);
    await deleteCachedData(`${CACHE_KEYS.TIERS_BY_ARTIST}${tier.artistId}`);
    // Invalidate any cache keys that might contain this tier ID
    await deleteCachedPattern(`*${id}*`);
  }
}

// Tier validation helper functions
async function validateTierCreation(artistId: string, name: string, minimumPrice: number) {
  // Check tier limit per artist (business rule: max 10 tiers per artist)
  const tierCount = await prisma.tiers.count({
    where: { artistId, isActive: true },
  });

  if (tierCount >= 10) {
    throw new Error('Maximum of 10 active tiers allowed per artist');
  }

  // Check for duplicate tier names
  await validateTierName(artistId, name);

  // Validate minimum price constraints
  if (minimumPrice < 1) {
    throw new Error('Minimum price must be at least $1');
  }

  if (minimumPrice > 1000) {
    throw new Error('Maximum price is $1000');
  }
}

async function validateTierName(artistId: string, name: string, excludeTierId?: string) {
  const where = excludeTierId
    ? { artistId, name: { equals: name, mode: 'insensitive' as const }, id: { not: excludeTierId } }
    : { artistId, name: { equals: name, mode: 'insensitive' as const } };

  const existingTier = await prisma.tiers.findFirst({ where });

  if (existingTier) {
    throw new Error('A tier with this name already exists');
  }
}

async function validatePriceChange(tierId: string, newPrice: number, subscriberCount: number) {
  if (subscriberCount > 0) {
    // Get current tier price
    const currentTier = await prisma.tiers.findUnique({
      where: { id: tierId },
      select: { minimumPrice: true },
    });

    if (currentTier && newPrice > Number(currentTier.minimumPrice) * 1.5) {
      throw new Error(
        'Cannot increase minimum price by more than 50% when tier has active subscribers'
      );
    }
  }
}

// Subscriber count tracking
export async function updateTierSubscriberCount(tierId: string) {
  const activeSubscriptions = await prisma.subscriptions.count({
    where: {
      tierId,
      status: SubscriptionStatus.ACTIVE,
    },
  });

  await prisma.tiers.update({
    where: { id: tierId },
    data: { subscriberCount: activeSubscriptions },
  });

  return activeSubscriptions;
}

// Content operations
export async function getContentByArtistId(
  artistId: string,
  options: {
    page?: number;
    limit?: number;
    type?: ContentType;
    isPublic?: boolean;
  } = {}
): Promise<PaginatedResponse<ContentWithTiers>> {
  const { page = 1, limit = 20, type, isPublic } = options;

  // Create a cache key based on the query parameters
  const cacheKey = `${CACHE_KEYS.CONTENT_BY_ARTIST}${artistId}_${page}_${limit}_${type || 'all'}_${isPublic === undefined ? 'all' : isPublic}`;

  return await withCache(
    cacheKey,
    async () => {
      const skip = (page - 1) * limit;

      const where = {
        artistId,
        ...(type && { type }),
        ...(isPublic !== undefined && { isPublic }),
      };

      const [content, total] = await Promise.all([
        prisma.content.findMany({
          where,
          include: {
            tiers: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.content.count({ where }),
      ]);

      const transformedContent = content.map(item => ({
        ...item,
        tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags,
        fileSize: Number(item.fileSize),
        tiers: item.tiers.map(tier => ({
          ...tier,
          minimumPrice: Number(tier.minimumPrice),
        })),
      }));

      return {
        data: transformedContent as ContentWithTiers[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    },
    CACHE_TTL.SHORT
  );
}

export async function createContent(data: {
  artistId: string;
  title: string;
  description?: string;
  type: ContentType;
  fileUrl: string;
  thumbnailUrl?: string;
  isPublic: boolean;
  fileSize: number;
  duration?: number;
  format: string;
  tags: string[];
  tierIds: string[];
}): Promise<Content> {
  const { tierIds, ...contentData } = data;

  const content = await prisma.content.create({
    data: {
      ...contentData,
      tags: JSON.stringify(contentData.tags), // Convert array to JSON string for storage
      tiers: {
        connect: tierIds.map(id => ({ id })),
      },
    },
  });

  // Invalidate related caches
  await deleteCachedPattern(`${CACHE_KEYS.CONTENT_BY_ARTIST}${data.artistId}*`);

  // Invalidate tier caches since content-tier relationships changed
  for (const tierId of tierIds) {
    await deleteCachedData(`${CACHE_KEYS.TIER}${tierId}`);
  }

  return content;
}

// Subscription operations
export async function getSubscriptionsByFanId(fanId: string) {
  const cacheKey = `${CACHE_KEYS.SUBSCRIPTIONS_BY_FAN}${fanId}`;

  return await withCache(
    cacheKey,
    async () => {
      const subscriptions = await prisma.subscriptions.findMany({
        where: { fanId },
        include: {
          tiers: {
            include: {
              users: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return subscriptions.map(sub => ({
        ...sub,
        amount: Number(sub.amount),
        tiers: {
          ...sub.tiers,
          minimumPrice: Number(sub.tiers.minimumPrice),
        },
      }));
    },
    CACHE_TTL.SHORT
  );
}

export async function getSubscriptionsByArtistId(artistId: string): Promise<Subscription[]> {
  const cacheKey = `${CACHE_KEYS.SUBSCRIPTIONS_BY_ARTIST}${artistId}`;

  return await withCache(
    cacheKey,
    async () => {
      return await prisma.subscriptions.findMany({
        where: { artistId },
        orderBy: { createdAt: 'desc' },
      });
    },
    CACHE_TTL.SHORT
  );
}

export async function createSubscription(data: {
  fanId: string;
  artistId: string;
  tierId: string;
  stripeSubscriptionId: string;
  amount: number;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}): Promise<Subscription> {
  const subscription = await prisma.subscriptions.create({
    data,
  });

  // Invalidate related caches
  await deleteCachedData(`${CACHE_KEYS.SUBSCRIPTIONS_BY_FAN}${data.fanId}`);
  await deleteCachedData(`${CACHE_KEYS.SUBSCRIPTIONS_BY_ARTIST}${data.artistId}`);
  await deleteCachedData(`${CACHE_KEYS.TIER}${data.tierId}`);
  await deleteCachedData(`${CACHE_KEYS.TIERS_BY_ARTIST}${data.artistId}`);

  // Invalidate analytics cache
  await deleteCachedData(`${CACHE_KEYS.ANALYTICS}${data.artistId}`);

  return subscription;
}

export async function updateSubscription(
  id: string,
  data: {
    amount?: number;
    status?: SubscriptionStatus;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }
): Promise<Subscription> {
  // Get subscription info for cache invalidation
  const subscription = await prisma.subscriptions.findUnique({
    where: { id },
    select: { fanId: true, artistId: true, tierId: true },
  });

  const updatedSubscription = await prisma.subscriptions.update({
    where: { id },
    data,
  });

  // Invalidate related caches
  if (subscription) {
    await deleteCachedData(`${CACHE_KEYS.SUBSCRIPTIONS_BY_FAN}${subscription.fanId}`);
    await deleteCachedData(`${CACHE_KEYS.SUBSCRIPTIONS_BY_ARTIST}${subscription.artistId}`);
    await deleteCachedData(`${CACHE_KEYS.TIER}${subscription.tierId}`);
    await deleteCachedData(`${CACHE_KEYS.TIERS_BY_ARTIST}${subscription.artistId}`);
    await deleteCachedData(`${CACHE_KEYS.ANALYTICS}${subscription.artistId}`);
  }

  return updatedSubscription;
}

// Comment operations
export async function getCommentsByContentId(contentId: string): Promise<Comment[]> {
  return await prisma.comments.findMany({
    where: { contentId },
    include: {
      users: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createComment(data: {
  contentId: string;
  fanId: string;
  text: string;
}): Promise<Comment> {
  return await prisma.comments.create({
    data,
  });
}

// Analytics operations
export async function getArtistAnalytics(artistId: string) {
  const cacheKey = `${CACHE_KEYS.ANALYTICS}${artistId}`;

  return await withCache(
    cacheKey,
    async () => {
      const [totalEarnings, totalSubscribers, monthlyEarnings, monthlySubscribers, tierStats] =
        await Promise.all([
          // Total earnings
          prisma.subscriptions.aggregate({
            where: {
              artistId,
              status: SubscriptionStatus.ACTIVE,
            },
            _sum: { amount: true },
          }),

          // Total subscribers
          prisma.subscriptions.count({
            where: {
              artistId,
              status: SubscriptionStatus.ACTIVE,
            },
          }),

          // Monthly earnings (last 30 days)
          prisma.subscriptions.aggregate({
            where: {
              artistId,
              status: SubscriptionStatus.ACTIVE,
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
            _sum: { amount: true },
          }),

          // Monthly subscribers (last 30 days)
          prisma.subscriptions.count({
            where: {
              artistId,
              status: SubscriptionStatus.ACTIVE,
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          }),

          // Tier statistics
          prisma.tiers.findMany({
            where: { artistId },
            include: {
              _count: {
                select: {
                  subscriptions: {
                    where: { status: SubscriptionStatus.ACTIVE },
                  },
                },
              },
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE },
                select: { amount: true },
              },
            },
          }),
        ]);

      const topTiers = tierStats
        .map(tier => ({
          tier,
          subscriberCount: tier._count.subscriptions,
          revenue: tier.subscriptions.reduce((sum, sub) => sum + Number(sub.amount), 0),
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        totalEarnings: Number(totalEarnings._sum.amount || 0),
        totalSubscribers,
        monthlyEarnings: Number(monthlyEarnings._sum.amount || 0),
        monthlySubscribers,
        churnRate: 0, // TODO: Calculate churn rate
        topTiers,
      };
    },
    CACHE_TTL.SHORT // Analytics should refresh frequently
  );
}

// Utility functions
export async function checkUserAccess(userId: string, contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { tiers: true },
  });

  if (!content) return false;
  if (content.isPublic) return true;
  if (content.artistId === userId) return true;

  // Check if user has subscription to any of the content's tiers
  const hasAccess = await prisma.subscriptions.findFirst({
    where: {
      fanId: userId,
      tierId: { in: content.tiers.map(tier => tier.id) },
      status: SubscriptionStatus.ACTIVE,
    },
  });

  return !!hasAccess;
}
