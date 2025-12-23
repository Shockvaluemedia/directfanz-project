/**
 * Optimized Database Queries for DirectFanz AWS Migration
 * 
 * Pre-optimized query patterns that maintain sub-50ms response times
 * for 95th percentile as required by Requirements 12.4
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { getDatabaseQueryOptimizer } from './database-query-optimizer';

export class OptimizedQueries {
  private prisma: PrismaClient;
  private optimizer: any;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.optimizer = getDatabaseQueryOptimizer(prisma);
  }

  /**
   * Optimized content queries with proper indexing and pagination
   */
  async getContentByArtist(
    artistId: string,
    options: {
      limit?: number;
      offset?: number;
      visibility?: string;
      type?: string;
      includeStats?: boolean;
    } = {}
  ) {
    const { limit = 50, offset = 0, visibility = 'PUBLIC', type, includeStats = false } = options;

    return this.optimizer.executeOptimizedQuery(
      async () => {
        const whereClause: Prisma.contentWhereInput = {
          artistId,
          visibility,
          ...(type && { type })
        };

        const selectClause: Prisma.contentSelect = {
          id: true,
          title: true,
          description: true,
          type: true,
          fileUrl: true,
          thumbnailUrl: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
          ...(includeStats && {
            totalViews: true,
            totalLikes: true,
            uniqueViews: true
          })
        };

        return this.prisma.content.findMany({
          where: whereClause,
          select: selectClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        });
      },
      'content_by_artist',
      `SELECT content WHERE artistId = '${artistId}' AND visibility = '${visibility}' ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`
    );
  }

  /**
   * Optimized user subscription queries
   */
  async getUserSubscriptions(
    userId: string,
    options: {
      status?: string;
      includeArtist?: boolean;
      includeTier?: boolean;
    } = {}
  ) {
    const { status = 'active', includeArtist = true, includeTier = true } = options;

    return this.optimizer.executeOptimizedQuery(
      async () => {
        return this.prisma.subscriptions.findMany({
          where: {
            fanId: userId,
            status
          },
          select: {
            id: true,
            amount: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            createdAt: true,
            ...(includeArtist && {
              users: {
                select: {
                  id: true,
                  displayName: true,
                  avatar: true
                }
              }
            }),
            ...(includeTier && {
              tiers: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  minimumPrice: true
                }
              }
            })
          },
          orderBy: { createdAt: 'desc' }
        });
      },
      'user_subscriptions',
      `SELECT subscriptions WHERE fanId = '${userId}' AND status = '${status}'`
    );
  }

  /**
   * Optimized live stream queries with viewer counts
   */
  async getLiveStreams(options: {
    isPublic?: boolean;
    status?: string;
    limit?: number;
    includeViewerCount?: boolean;
  } = {}) {
    const { isPublic = true, status = 'LIVE', limit = 20, includeViewerCount = true } = options;

    return this.optimizer.executeOptimizedQuery(
      async () => {
        const streams = await this.prisma.live_streams.findMany({
          where: {
            isPublic,
            status
          },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            thumbnailUrl: true,
            startedAt: true,
            peakViewers: true,
            totalViewers: true,
            users: {
              select: {
                id: true,
                displayName: true,
                avatar: true
              }
            }
          },
          orderBy: [
            { peakViewers: 'desc' },
            { startedAt: 'desc' }
          ],
          take: limit
        });

        // Optionally get current viewer counts
        if (includeViewerCount) {
          const streamIds = streams.map(s => s.id);
          const viewerCounts = await this.prisma.stream_viewers.groupBy({
            by: ['streamId'],
            where: {
              streamId: { in: streamIds },
              leftAt: null // Currently watching
            },
            _count: {
              id: true
            }
          });

          const viewerCountMap = new Map(
            viewerCounts.map(vc => [vc.streamId, vc._count.id])
          );

          return streams.map(stream => ({
            ...stream,
            currentViewers: viewerCountMap.get(stream.id) || 0
          }));
        }

        return streams;
      },
      'live_streams_public',
      `SELECT live_streams WHERE isPublic = ${isPublic} AND status = '${status}' ORDER BY peakViewers DESC, startedAt DESC LIMIT ${limit}`
    );
  }

  /**
   * Optimized message queries with pagination
   */
  async getMessageThread(
    senderId: string,
    recipientId: string,
    options: {
      limit?: number;
      before?: Date;
      includeRead?: boolean;
    } = {}
  ) {
    const { limit = 50, before, includeRead = true } = options;

    return this.optimizer.executeOptimizedQuery(
      async () => {
        const whereClause: Prisma.messagesWhereInput = {
          OR: [
            { senderId, recipientId },
            { senderId: recipientId, recipientId: senderId }
          ],
          ...(before && { createdAt: { lt: before } })
        };

        return this.prisma.messages.findMany({
          where: whereClause,
          select: {
            id: true,
            senderId: true,
            recipientId: true,
            content: true,
            type: true,
            attachmentUrl: true,
            readAt: includeRead ? true : undefined,
            createdAt: true,
            users_messages_senderIdTousers: {
              select: {
                id: true,
                displayName: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit
        });
      },
      'message_thread',
      `SELECT messages WHERE (senderId = '${senderId}' AND recipientId = '${recipientId}') OR (senderId = '${recipientId}' AND recipientId = '${senderId}') ORDER BY createdAt DESC LIMIT ${limit}`
    );
  }

  /**
   * Optimized campaign queries with analytics
   */
  async getCampaignsByArtist(
    artistId: string,
    options: {
      status?: string;
      includeAnalytics?: boolean;
      limit?: number;
    } = {}
  ) {
    const { status, includeAnalytics = false, limit = 20 } = options;

    return this.optimizer.executeOptimizedQuery(
      async () => {
        const whereClause: Prisma.campaignsWhereInput = {
          artistId,
          ...(status && { status })
        };

        const campaigns = await this.prisma.campaigns.findMany({
          where: whereClause,
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            status: true,
            startDate: true,
            endDate: true,
            totalParticipants: true,
            totalEngagement: true,
            totalRevenue: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: limit
        });

        if (includeAnalytics) {
          const campaignIds = campaigns.map(c => c.id);
          const analytics = await this.prisma.campaign_analytics.findMany({
            where: {
              campaignId: { in: campaignIds }
            },
            select: {
              campaignId: true,
              totalParticipants: true,
              totalSubmissions: true,
              totalViews: true,
              totalRevenue: true,
              conversionRate: true,
              engagementRate: true
            },
            orderBy: { date: 'desc' },
            distinct: ['campaignId']
          });

          const analyticsMap = new Map(
            analytics.map(a => [a.campaignId, a])
          );

          return campaigns.map(campaign => ({
            ...campaign,
            analytics: analyticsMap.get(campaign.id) || null
          }));
        }

        return campaigns;
      },
      'campaigns_by_artist',
      `SELECT campaigns WHERE artistId = '${artistId}' ${status ? `AND status = '${status}'` : ''} ORDER BY createdAt DESC LIMIT ${limit}`
    );
  }

  /**
   * Optimized user activity queries
   */
  async getUserActivity(
    userId: string,
    options: {
      includeContent?: boolean;
      includeMessages?: boolean;
      includeStreams?: boolean;
      limit?: number;
      since?: Date;
    } = {}
  ) {
    const { includeContent = true, includeMessages = true, includeStreams = true, limit = 100, since } = options;

    return this.optimizer.executeOptimizedQuery(
      async () => {
        const activities: any[] = [];

        // Get recent content
        if (includeContent) {
          const content = await this.prisma.content.findMany({
            where: {
              artistId: userId,
              ...(since && { createdAt: { gte: since } })
            },
            select: {
              id: true,
              title: true,
              type: true,
              createdAt: true,
              totalViews: true,
              totalLikes: true
            },
            orderBy: { createdAt: 'desc' },
            take: Math.floor(limit / 3)
          });

          activities.push(...content.map(c => ({
            ...c,
            activityType: 'content_created'
          })));
        }

        // Get recent messages
        if (includeMessages) {
          const messages = await this.prisma.messages.findMany({
            where: {
              senderId: userId,
              ...(since && { createdAt: { gte: since } })
            },
            select: {
              id: true,
              content: true,
              type: true,
              createdAt: true,
              users_messages_recipientIdTousers: {
                select: {
                  displayName: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: Math.floor(limit / 3)
          });

          activities.push(...messages.map(m => ({
            ...m,
            activityType: 'message_sent'
          })));
        }

        // Get recent streams
        if (includeStreams) {
          const streams = await this.prisma.live_streams.findMany({
            where: {
              artistId: userId,
              ...(since && { createdAt: { gte: since } })
            },
            select: {
              id: true,
              title: true,
              status: true,
              startedAt: true,
              endedAt: true,
              peakViewers: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: Math.floor(limit / 3)
          });

          activities.push(...streams.map(s => ({
            ...s,
            activityType: 'stream_created'
          })));
        }

        // Sort all activities by creation date
        return activities
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, limit);
      },
      'user_activity',
      `SELECT user activity for userId = '${userId}' since ${since?.toISOString() || 'all time'} LIMIT ${limit}`
    );
  }

  /**
   * Optimized search queries with full-text search
   */
  async searchContent(
    query: string,
    options: {
      type?: string;
      visibility?: string;
      artistId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { type, visibility = 'PUBLIC', artistId, limit = 20, offset = 0 } = options;

    return this.optimizer.executeOptimizedQuery(
      async () => {
        // Use PostgreSQL ILIKE for case-insensitive search
        const searchPattern = `%${query}%`;
        
        const whereClause: Prisma.contentWhereInput = {
          visibility,
          ...(type && { type }),
          ...(artistId && { artistId }),
          OR: [
            {
              title: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              tags: {
                contains: query,
                mode: 'insensitive'
              }
            }
          ]
        };

        return this.prisma.content.findMany({
          where: whereClause,
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
                avatar: true
              }
            }
          },
          orderBy: [
            { totalViews: 'desc' },
            { createdAt: 'desc' }
          ],
          take: limit,
          skip: offset
        });
      },
      'search_content',
      `SELECT content WHERE title/description/tags ILIKE '%${query}%' AND visibility = '${visibility}' ORDER BY totalViews DESC, createdAt DESC LIMIT ${limit} OFFSET ${offset}`
    );
  }

  /**
   * Optimized analytics queries with aggregations
   */
  async getContentAnalytics(
    contentId: string,
    options: {
      includeViews?: boolean;
      includeLikes?: boolean;
      includeComments?: boolean;
      dateRange?: { start: Date; end: Date };
    } = {}
  ) {
    const { includeViews = true, includeLikes = true, includeComments = true, dateRange } = options;

    return this.optimizer.executeOptimizedQuery(
      async () => {
        const analytics: any = {
          contentId,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0
        };

        const dateFilter = dateRange ? {
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end
          }
        } : {};

        // Get view analytics
        if (includeViews) {
          const viewStats = await this.prisma.content_views.aggregate({
            where: {
              contentId,
              ...dateFilter
            },
            _sum: {
              viewCount: true
            },
            _count: {
              id: true
            }
          });

          analytics.totalViews = viewStats._sum.viewCount || 0;
          analytics.uniqueViews = viewStats._count.id || 0;
        }

        // Get like analytics
        if (includeLikes) {
          const likeCount = await this.prisma.content_likes.count({
            where: {
              contentId,
              ...dateFilter
            }
          });

          analytics.totalLikes = likeCount;
        }

        // Get comment analytics
        if (includeComments) {
          const commentCount = await this.prisma.comments.count({
            where: {
              contentId,
              ...dateFilter
            }
          });

          analytics.totalComments = commentCount;
        }

        return analytics;
      },
      'content_analytics',
      `SELECT analytics for contentId = '${contentId}' ${dateRange ? `between ${dateRange.start.toISOString()} and ${dateRange.end.toISOString()}` : ''}`
    );
  }

  /**
   * Optimized batch operations
   */
  async batchUpdateContentViews(
    updates: Array<{
      contentId: string;
      viewerId: string;
      viewCount: number;
      totalDuration: number;
      maxPercentage: number;
    }>
  ) {
    return this.optimizer.executeOptimizedQuery(
      async () => {
        // Use upsert for efficient batch updates
        const operations = updates.map(update => 
          this.prisma.content_views.upsert({
            where: {
              contentId_viewerId_createdAt: {
                contentId: update.contentId,
                viewerId: update.viewerId,
                createdAt: new Date() // Today's date for daily aggregation
              }
            },
            update: {
              viewCount: { increment: update.viewCount },
              totalDuration: { increment: update.totalDuration },
              maxPercentage: Math.max(update.maxPercentage),
              lastViewedAt: new Date(),
              updatedAt: new Date()
            },
            create: {
              id: `${update.contentId}_${update.viewerId}_${Date.now()}`,
              contentId: update.contentId,
              viewerId: update.viewerId,
              viewCount: update.viewCount,
              totalDuration: update.totalDuration,
              maxPercentage: update.maxPercentage,
              lastViewedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        );

        return this.prisma.$transaction(operations);
      },
      'batch_update_views',
      `BATCH UPDATE content_views for ${updates.length} records`
    );
  }
}

// Export singleton instance
let optimizedQueriesInstance: OptimizedQueries | null = null;

export const getOptimizedQueries = (prisma: PrismaClient): OptimizedQueries => {
  if (!optimizedQueriesInstance) {
    optimizedQueriesInstance = new OptimizedQueries(prisma);
  }
  return optimizedQueriesInstance;
};