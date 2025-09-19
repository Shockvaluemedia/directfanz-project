import { prisma } from './prisma';
import { SubscriptionStatus } from '@/types/database';

export interface OptimizedSubscription {
  id: string;
  artist: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  tier: {
    name: string;
    price: number;
  };
  status: string;
  nextBillingDate: string;
  createdAt: string;
}

/**
 * Optimized subscription retrieval with single query instead of nested includes
 */
export async function getFanSubscriptions(
  fanId: string,
  status?: string
): Promise<OptimizedSubscription[]> {
  // Build the query dynamically
  const statusFilter = status && status !== 'all' ? `AND s.status = '${status.toUpperCase()}'` : '';

  // Single raw query instead of nested includes - much faster
  const subscriptions = await prisma.$queryRaw<
    Array<{
      id: string;
      amount: number;
      status: string;
      currentPeriodEnd: Date;
      createdAt: Date;
      tier_name: string;
      artist_id: string;
      artist_name: string;
      artist_avatar: string | null;
    }>
  >`
    SELECT 
      s.id,
      s.amount::float as amount,
      s.status,
      s."currentPeriodEnd",
      s."createdAt",
      t.name as tier_name,
      u.id as artist_id,
      u."displayName" as artist_name,
      u.avatar as artist_avatar
    FROM subscriptions s
    JOIN tiers t ON s."tierId" = t.id
    JOIN users u ON t."artistId" = u.id
    WHERE s."fanId" = ${fanId}
    ${statusFilter !== '' ? `AND s.status = ${status?.toUpperCase()}` : ''}
    ORDER BY s."createdAt" DESC
  `;

  // Transform to expected format
  return subscriptions.map(sub => ({
    id: sub.id,
    artist: {
      id: sub.artist_id,
      displayName: sub.artist_name,
      avatar: sub.artist_avatar,
    },
    tier: {
      name: sub.tier_name,
      price: sub.amount,
    },
    status: sub.status.toLowerCase(),
    nextBillingDate: sub.currentPeriodEnd.toISOString(),
    createdAt: sub.createdAt.toISOString(),
  }));
}

/**
 * Get subscription analytics for an artist (optimized)
 */
export async function getArtistSubscriptionStats(artistId: string) {
  const stats = await prisma.$queryRaw<
    Array<{
      status: string;
      count: number;
      total_revenue: number;
    }>
  >`
    SELECT 
      s.status,
      COUNT(*)::int as count,
      COALESCE(SUM(s.amount), 0)::float as total_revenue
    FROM subscriptions s
    JOIN tiers t ON s."tierId" = t.id
    WHERE t."artistId" = ${artistId}
    GROUP BY s.status
  `;

  return stats.reduce(
    (acc, stat) => {
      acc[stat.status.toLowerCase()] = {
        count: stat.count,
        revenue: stat.total_revenue,
      };
      return acc;
    },
    {} as Record<string, { count: number; revenue: number }>
  );
}

/**
 * Get active subscriptions for content access (cached)
 */
const subscriptionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getActiveSubscriptions(
  fanId: string,
  artistId?: string
): Promise<Array<{ tierId: string; amount: number }>> {
  const cacheKey = `${fanId}:${artistId || 'all'}`;
  const cached = subscriptionCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const whereClause = artistId ? `AND t."artistId" = '${artistId}'` : '';

  const subscriptions = await prisma.$queryRaw<
    Array<{
      tierId: string;
      amount: number;
    }>
  >`
    SELECT 
      s."tierId",
      s.amount::float as amount
    FROM subscriptions s
    JOIN tiers t ON s."tierId" = t.id
    WHERE s."fanId" = ${fanId}
      AND s.status = 'ACTIVE'
      AND s."currentPeriodEnd" >= NOW()
      ${whereClause}
  `;

  // Cache the result
  subscriptionCache.set(cacheKey, {
    data: subscriptions,
    timestamp: Date.now(),
  });

  return subscriptions;
}

/**
 * Clear subscription cache for a user
 */
export function clearSubscriptionCache(fanId: string) {
  for (const key of subscriptionCache.keys()) {
    if (key.startsWith(fanId + ':')) {
      subscriptionCache.delete(key);
    }
  }
}

/**
 * Periodic cache cleanup
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of subscriptionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      subscriptionCache.delete(key);
    }
  }
}, CACHE_TTL); // Run cleanup every 5 minutes
