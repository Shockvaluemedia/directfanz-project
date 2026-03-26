import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

interface ContentWithRelations {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileSize: number;
  format: string;
  tags: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  users: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  tiers: Array<{
    id: string;
    name: string;
  }>;
  views: number;
  likes: number;
  commentsCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;

    if (!session?.user?.id || session.user.role !== 'FAN') {
      return apiError('UNAUTHORIZED', { code: 'UNAUTHORIZED', message: 'Fan authentication required' });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const feedType = searchParams.get('feedType') || 'subscriptions';
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    let content: any[] = [];
    let total = 0;

    if (feedType === 'subscriptions') {
      // Get content from artists the user subscribes to
      const subscriptions = await prisma.subscriptions.findMany({
        where: {
          fanId: session.user.id,
          status: 'ACTIVE',
        },
        select: {
          artistId: true,
          tierId: true,
        },
      });

      if (subscriptions.length > 0) {
        const artistIds = subscriptions.map((s: { artistId: string; tierId: string }) => s.artistId);
        const tierIds = subscriptions.map((s: { artistId: string; tierId: string }) => s.tierId);

        // Build where clause
        const where: any = {
          artistId: { in: artistIds },
          OR: [
            { visibility: 'PUBLIC' },
            { 
              visibility: 'TIER_LOCKED',
              tiers: {
                some: {
                  id: { in: tierIds }
                }
              }
            }
          ]
        };

        if (type && ['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'].includes(type)) {
          where.type = type;
        }

        if (search) {
          where.AND = {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { tags: { contains: search, mode: 'insensitive' } },
            ]
          };
        }

        [content, total] = await Promise.all([
          prisma.content.findMany({
            where,
            include: {
              users: {
                select: {
                  id: true,
                  displayName: true,
                  avatar: true,
                },
              },
              tiers: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.content.count({ where }),
        ]);
      }
    } else if (feedType === 'discover') {
      // Show public content from artists similar to those the user subscribes to
      // or trending public content
      const where: any = {
        visibility: 'PUBLIC',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      };

      if (type && ['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'].includes(type)) {
        where.type = type;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { contains: search, mode: 'insensitive' } },
        ];
      }

      [content, total] = await Promise.all([
        prisma.content.findMany({
          where,
          include: {
            users: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              },
            },
            tiers: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [
            { totalViews: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: limit,
        }),
        prisma.content.count({ where }),
      ]);
    } else if (feedType === 'trending') {
      // Show trending public content based on recent engagement
      const where: any = {
        visibility: 'PUBLIC',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      };

      if (type && ['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'].includes(type)) {
        where.type = type;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { contains: search, mode: 'insensitive' } },
        ];
      }

      [content, total] = await Promise.all([
        prisma.content.findMany({
          where,
          include: {
            users: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              },
            },
            tiers: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [
            { totalLikes: 'desc' },
            { totalViews: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: limit,
        }),
        prisma.content.count({ where }),
      ]);
    }

    // Get engagement data for each content item
    const contentWithEngagement = await Promise.all(
      content.map(async (item) => {
        // Get view count (simplified - in real app might track actual views)
        const viewCount = Math.floor(Math.random() * 1000); // Mock data
        
        // Get like count and user's like status
        const likeData = await prisma.content_likes.findMany({
          where: { contentId: item.id },
          select: { userId: true },
        });
        
        const likes = likeData.length;
        const hasLiked = likeData.some((like: { userId: string }) => like.userId === session.user.id);

        // Get comment count
        const commentsCount = await prisma.comments.count({
          where: { contentId: item.id },
        });

        // Parse tags
        let tags: string[] = [];
        try {
          tags = JSON.parse(item.tags || '[]');
        } catch {
          tags = [];
        }

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          type: item.type as 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT',
          fileUrl: item.fileUrl,
          thumbnailUrl: item.thumbnailUrl,
          fileSize: item.fileSize,
          format: item.format,
          tags,
          visibility: item.visibility as 'PUBLIC' | 'PRIVATE' | 'TIER_LOCKED',
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          views: viewCount,
          likes,
          hasLiked,
          commentsCount,
          artist: {
            id: item.users.id,
            displayName: item.users.displayName,
            avatar: item.users.avatar,
          },
          tier: item.tiers.length > 0 ? {
            id: item.tiers[0].id,
            name: item.tiers[0].name,
          } : undefined,
        };
      })
    );

    return apiSuccess({
        content: contentWithEngagement,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
  } catch (error) {
    logger.error('Feed error', {}, error as Error);
    return apiError('INTERNAL_ERROR', { code: 'INTERNAL_ERROR', message: 'Failed to fetch content feed' });
  }
}