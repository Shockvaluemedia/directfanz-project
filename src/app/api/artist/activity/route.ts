import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      // Verify user is an artist
      if (req.user.role !== 'ARTIST') {
        return NextResponse.json(
          { error: 'Access denied. Artist role required.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '10');

      // Get recent activities for this artist
      const activities: Array<{
        id: string;
        type: 'subscription' | 'message' | 'content' | 'comment';
        title: string;
        description: string;
        timestamp: string;
        user?: {
          name: string;
          avatar?: string;
        };
      }> = [];

      // Get recent subscriptions (new fans)
      const recentSubscriptions = await prisma.subscription.findMany({
        where: {
          artistId: req.user.id,
          status: 'ACTIVE',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 2),
        include: {
          fan: {
            select: {
              displayName: true,
              avatar: true
            }
          },
          tier: {
            select: {
              name: true,
              minimumPrice: true
            }
          }
        }
      });

      for (const sub of recentSubscriptions) {
        activities.push({
          id: `sub_${sub.id}`,
          type: 'subscription',
          title: 'New Subscriber',
          description: `${sub.fan.displayName} subscribed to ${sub.tier.name} tier`,
          timestamp: sub.createdAt.toISOString(),
          user: {
            name: sub.fan.displayName,
            avatar: sub.fan.avatar || undefined
          }
        });
      }

      // Get recent messages
      const recentMessages = await prisma.message.findMany({
        where: {
          recipientId: req.user.id,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 2),
        include: {
          sender: {
            select: {
              displayName: true,
              avatar: true
            }
          }
        }
      });

      for (const message of recentMessages) {
        activities.push({
          id: `msg_${message.id}`,
          type: 'message',
          title: 'New Message',
          description: `Message from ${message.sender.displayName}: ${message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content}`,
          timestamp: message.createdAt.toISOString(),
          user: {
            name: message.sender.displayName,
            avatar: message.sender.avatar || undefined
          }
        });
      }

      // Get recent comments on content
      const recentComments = await prisma.comment.findMany({
        where: {
          content: {
            artistId: req.user.id
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 3),
        include: {
          fan: {
            select: {
              displayName: true,
              avatar: true
            }
          },
          content: {
            select: {
              title: true
            }
          }
        }
      });

      for (const comment of recentComments) {
        activities.push({
          id: `comment_${comment.id}`,
          type: 'comment',
          title: 'New Comment',
          description: `${comment.fan.displayName} commented on "${comment.content.title}": ${comment.text.length > 40 ? comment.text.substring(0, 40) + '...' : comment.text}`,
          timestamp: comment.createdAt.toISOString(),
          user: {
            name: comment.fan.displayName,
            avatar: comment.fan.avatar || undefined
          }
        });
      }

      // Sort all activities by timestamp and take the requested limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      logger.info('Artist activity fetched', {
        artistId: req.user.id,
        activityCount: sortedActivities.length
      });

      return NextResponse.json({
        success: true,
        data: {
          activities: sortedActivities
        }
      });

    } catch (error) {
      logger.error('Get artist activity error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to fetch activity data' },
        { status: 500 }
      );
    }
  });
}