import { prisma } from './prisma';
import { logger } from './logger';

// Query optimization utilities for common patterns

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Optimized pagination with consistent patterns
 */
export async function paginatedQuery<T>(
  model: any,
  where: any = {},
  options: PaginationOptions & { include?: any; select?: any } = {}
): Promise<PaginationResult<T>> {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    include,
    select,
  } = options;

  // Validate pagination parameters
  const validatedPage = Math.max(1, page);
  const validatedLimit = Math.min(100, Math.max(1, limit)); // Max 100 items per page
  const skip = (validatedPage - 1) * validatedLimit;

  // Build orderBy object
  const orderBy = { [sortBy]: sortOrder };

  // Execute queries in parallel for better performance
  const [data, total] = await Promise.all([
    model.findMany({
      where,
      orderBy,
      skip,
      take: validatedLimit,
      ...(include && { include }),
      ...(select && { select }),
    }),
    model.count({ where }),
  ]);

  const totalPages = Math.ceil(total / validatedLimit);

  return {
    data,
    pagination: {
      page: validatedPage,
      limit: validatedLimit,
      total,
      totalPages,
      hasNext: validatedPage < totalPages,
      hasPrev: validatedPage > 1,
    },
  };
}

/**
 * Optimized user lookup with caching considerations
 */
export async function findUserOptimized(identifier: string, type: 'id' | 'email' = 'id') {
  const where = type === 'email' ? { email: identifier } : { id: identifier };

  return prisma.users.findUnique({
    where,
    include: {
      artists: true, // Only include when needed
    },
  });
}

/**
 * Optimized subscription lookup for billing operations
 */
export async function findActiveSubscriptionsForArtist(artistId: string, limit = 50) {
  return prisma.subscriptions.findMany({
    where: {
      artistId,
      status: 'ACTIVE',
    },
    include: {
      users: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      tiers: {
        select: {
          id: true,
          name: true,
          minimumPrice: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Optimized content discovery query
 */
export async function findDiscoverableContent(options: {
  limit?: number;
  contentType?: string;
  sortBy?: 'totalViews' | 'totalLikes' | 'createdAt';
  excludeArtistId?: string;
}) {
  const { limit = 20, contentType, sortBy = 'totalViews', excludeArtistId } = options;

  const where: any = {
    visibility: 'PUBLIC',
    ...(contentType && { type: contentType }),
    ...(excludeArtistId && {
      artistId: { not: excludeArtistId },
    }),
  };

  return prisma.content.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      thumbnailUrl: true,
      totalViews: true,
      totalLikes: true,
      createdAt: true,
      users: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
        },
      },
    },
    orderBy: {
      [sortBy]: 'desc',
    },
    take: limit,
  });
}

/**
 * Optimized artist analytics query
 */
export async function getArtistAnalytics(artistId: string, dateRange?: { from: Date; to: Date }) {
  const where = dateRange
    ? {
        artistId,
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      }
    : { artistId };

  // Use parallel queries for better performance
  const [totalSubscribers, activeSubscribers, totalContent, totalViews, totalLikes, recentContent] =
    await Promise.all([
      prisma.subscriptions.count({
        where: { artistId },
      }),
      prisma.subscriptions.count({
        where: { artistId, status: 'ACTIVE' },
      }),
      prisma.content.count({
        where: { artistId },
      }),
      prisma.content.aggregate({
        where: { artistId },
        _sum: { totalViews: true },
      }),
      prisma.content.aggregate({
        where: { artistId },
        _sum: { totalLikes: true },
      }),
      prisma.content.findMany({
        where: { artistId },
        select: {
          id: true,
          title: true,
          totalViews: true,
          totalLikes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

  return {
    totalSubscribers,
    activeSubscribers,
    totalContent,
    totalViews: totalViews._sum.totalViews || 0,
    totalLikes: totalLikes._sum.totalLikes || 0,
    recentContent,
  };
}

/**
 * Optimized search with proper indexing
 */
export async function searchContent(
  query: string,
  options: {
    limit?: number;
    contentType?: string;
    artistId?: string;
  }
) {
  const { limit = 20, contentType, artistId } = options;

  // Use LIKE with proper indexing (SQLite FTS would be better for production)
  const where: any = {
    visibility: 'PUBLIC',
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ],
    ...(contentType && { type: contentType }),
    ...(artistId && { artistId }),
  };

  return prisma.content.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      thumbnailUrl: true,
      totalViews: true,
      totalLikes: true,
      createdAt: true,
      users: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
        },
      },
    },
    orderBy: [
      { totalViews: 'desc' }, // Boost popular content
      { createdAt: 'desc' },
    ],
    take: limit,
  });
}

/**
 * Optimized message conversation queries
 */
export async function getConversationMessages(
  senderId: string,
  recipientId: string,
  options: { limit?: number; beforeId?: string } = {}
) {
  const { limit = 50, beforeId } = options;

  const where: any = {
    OR: [
      { senderId, recipientId },
      { senderId: recipientId, recipientId: senderId },
    ],
    ...(beforeId && {
      id: { lt: beforeId }, // For cursor-based pagination
    }),
  };

  return prisma.messages.findMany({
    where,
    include: {
      users_messages_senderIdTousers: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Optimized billing queries for payment processing
 */
export async function getOverdueInvoices(limit = 100) {
  return prisma.invoices.findMany({
    where: {
      status: 'UNPAID',
      dueDate: {
        lt: new Date(),
      },
    },
    include: {
      subscriptions: {
        select: {
          id: true,
          fanId: true,
          artistId: true,
          status: true,
        },
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
    take: limit,
  });
}

/**
 * Query performance monitoring
 */
export async function logQueryPerformance<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    // Log slow queries (> 500ms)
    if (duration > 500) {
      logger.warn('Slow query detected', {
        queryName,
        duration: `${duration}ms`,
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query failed', {
      queryName,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Batch operations for better performance
 */
export async function batchUpdateViews(updates: { contentId: string; increment: number }[]) {
  // Group updates by content ID
  const groupedUpdates = updates.reduce(
    (acc, update) => {
      acc[update.contentId] = (acc[update.contentId] || 0) + update.increment;
      return acc;
    },
    {} as Record<string, number>
  );

  // Execute batch updates
  const promises = Object.entries(groupedUpdates).map(([contentId, increment]) =>
    prisma.content.update({
      where: { id: contentId },
      data: {
        totalViews: { increment },
      },
    })
  );

  return Promise.all(promises);
}

// Export common query builders
export const QueryBuilders = {
  paginatedQuery,
  findUserOptimized,
  findActiveSubscriptionsForArtist,
  findDiscoverableContent,
  getArtistAnalytics,
  searchContent,
  getConversationMessages,
  getOverdueInvoices,
  logQueryPerformance,
  batchUpdateViews,
};
