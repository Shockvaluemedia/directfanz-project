import { prisma } from './prisma';
import { UserRole, SubscriptionStatus } from '@/types/database';
import jwt from 'jsonwebtoken';

// Content access verification types
export interface ContentAccessResult {
  hasAccess: boolean;
  reason?: 'public' | 'owner' | 'subscription' | 'no_subscription' | 'invalid_tier' | 'not_found';
  subscription?: {
    id: string;
    tierId: string;
    amount: number;
    status: SubscriptionStatus;
  };
}

export interface AccessToken {
  userId: string;
  contentId: string;
  exp: number;
  iat: number;
}

// Tier-based content gating logic
export async function checkContentAccess(
  userId: string,
  contentId: string
): Promise<ContentAccessResult> {
  try {
    // OPTIMIZED: Single query with all needed data to eliminate N+1 queries
    const contentWithUserAccess = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        artist: {
          select: {
            id: true,
            displayName: true,
          },
        },
        tiers: {
          select: {
            id: true,
            name: true,
            minimumPrice: true,
            isActive: true,
            subscriptions: {
              where: {
                fanId: userId,
                status: SubscriptionStatus.ACTIVE,
                currentPeriodEnd: { gte: new Date() },
              },
              select: {
                id: true,
                tierId: true,
                amount: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!contentWithUserAccess) {
      return { hasAccess: false, reason: 'not_found' };
    }

    // Public content is accessible to everyone
    if (contentWithUserAccess.visibility === 'PUBLIC') {
      return { hasAccess: true, reason: 'public' };
    }

    // Content owner (artist) always has access
    if (contentWithUserAccess.artistId === userId) {
      return { hasAccess: true, reason: 'owner' };
    }

    // Check if user has subscription to any of the content's tiers
    if (contentWithUserAccess.tiers.length === 0) {
      // Content not assigned to any tier - only owner can access
      return { hasAccess: false, reason: 'no_subscription' };
    }

    // Check access in memory - no additional DB queries needed
    for (const tier of contentWithUserAccess.tiers) {
      if (tier.isActive && tier.subscriptions.length > 0) {
        const subscription = tier.subscriptions[0]; // User can only have one active subscription per tier
        return {
          hasAccess: true,
          reason: 'subscription',
          subscription: {
            id: subscription.id,
            tierId: subscription.tierId,
            amount: Number(subscription.amount),
            status: subscription.status as SubscriptionStatus,
          },
        };
      }
    }

    return { hasAccess: false, reason: 'no_subscription' };
  } catch (error) {
    console.error('Content access check error:', error);
    return { hasAccess: false, reason: 'not_found' };
  }
}

// Generate secure access token for content delivery
export function generateAccessToken(userId: string, contentId: string): string {
  const payload = {
    userId,
    contentId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
  };

  return jwt.sign(payload, process.env.NEXTAUTH_SECRET!, {
    algorithm: 'HS256',
  });
}

// Verify access token
export function verifyAccessToken(token: string): AccessToken | null {
  try {
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as AccessToken;
    return decoded;
  } catch (error) {
    console.error('Access token verification error:', error);
    return null;
  }
}

// Get user's accessible content for an artist
export async function getUserAccessibleContent(
  userId: string,
  artistId: string,
  options: {
    page?: number;
    limit?: number;
    type?: string;
  } = {}
): Promise<{
  content: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const { page = 1, limit = 20, type } = options;
  const skip = (page - 1) * limit;

  // Get user's active subscriptions for this artist
  const userSubscriptions = await prisma.subscriptions.findMany({
    where: {
      fanId: userId,
      artistId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: {
        gte: new Date(),
      },
    },
    select: {
      tierId: true,
    },
  });

  const subscribedTierIds = userSubscriptions.map(sub => sub.tierId);

  // Build content query
  const where: any = {
    artistId,
    OR: [
      { visibility: 'PUBLIC' },
      {
        tiers: {
          some: {
            id: { in: subscribedTierIds },
            isActive: true,
          },
        },
      },
    ],
  };

  if (type && ['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'].includes(type)) {
    where.type = type;
  }

  const [content, total] = await Promise.all([
    prisma.content.findMany({
      where,
      include: {
        tiers: {
          select: {
            id: true,
            name: true,
            minimumPrice: true,
          },
        },
        artist: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.content.count({ where }),
  ]);

  return {
    content: content.map(item => ({
      ...item,
      tiers: item.tiers.map(tier => ({
        ...tier,
        minimumPrice: Number(tier.minimumPrice),
      })),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Check if user can access specific tier content
export async function checkTierAccess(userId: string, tierId: string): Promise<boolean> {
  try {
    const subscription = await prisma.subscriptions.findFirst({
      where: {
        fanId: userId,
        tierId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          gte: new Date(),
        },
      },
    });

    return !!subscription;
  } catch (error) {
    console.error('Tier access check error:', error);
    return false;
  }
}

// Get content access summary for a user
export async function getContentAccessSummary(
  userId: string,
  artistId: string
): Promise<{
  totalContent: number;
  accessibleContent: number;
  publicContent: number;
  gatedContent: number;
  subscriptions: Array<{
    tierId: string;
    tierName: string;
    contentCount: number;
  }>;
}> {
  try {
    // Get all content for the artist
    const [totalContent, publicContent] = await Promise.all([
      prisma.content.count({
        where: { artistId },
      }),
      prisma.content.count({
        where: { artistId, visibility: 'PUBLIC' },
      }),
    ]);

    // Get user's subscriptions
    const userSubscriptions = await prisma.subscriptions.findMany({
      where: {
        fanId: userId,
        artistId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          gte: new Date(),
        },
      },
      include: {
        tier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const subscribedTierIds = userSubscriptions.map(sub => sub.tierId);

    // Get accessible gated content count
    const accessibleGatedContent = await prisma.content.count({
      where: {
        artistId,
        visibility: { not: 'PUBLIC' },
        tiers: {
          some: {
            id: { in: subscribedTierIds },
            isActive: true,
          },
        },
      },
    });

    // Get content count per subscribed tier
    const subscriptionSummary = await Promise.all(
      userSubscriptions.map(async sub => {
        const contentCount = await prisma.content.count({
          where: {
            artistId,
            tiers: {
              some: {
                id: sub.tierId,
                isActive: true,
              },
            },
          },
        });

        return {
          tierId: sub.tierId,
          tierName: sub.tiers.name,
          contentCount,
        };
      })
    );

    return {
      totalContent,
      accessibleContent: publicContent + accessibleGatedContent,
      publicContent,
      gatedContent: totalContent - publicContent,
      subscriptions: subscriptionSummary,
    };
  } catch (error) {
    console.error('Content access summary error:', error);
    return {
      totalContent: 0,
      accessibleContent: 0,
      publicContent: 0,
      gatedContent: 0,
      subscriptions: [],
    };
  }
}
