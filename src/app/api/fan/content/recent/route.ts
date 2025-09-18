import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      // Verify user is a fan
      if (req.user.role !== 'FAN') {
        return NextResponse.json(
          { error: 'Access denied. Fan role required.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '10');

      // Get artists that the user is subscribed to
      const activeSubscriptions = await prisma.subscription.findMany({
        where: {
          fanId: req.user.id,
          status: 'ACTIVE'
        },
        select: {
          artistId: true,
          tierId: true,
          tier: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (activeSubscriptions.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            content: []
          }
        });
      }

      const subscribedArtistIds = activeSubscriptions.map(sub => sub.artistId);
      const subscribedTierIds = activeSubscriptions.map(sub => sub.tierId);

      // Get recent content from subscribed artists
      // Content should be either public or accessible through the user's subscription tier
      const recentContent = await prisma.content.findMany({
        where: {
          artistId: {
            in: subscribedArtistIds
          },
          OR: [
            // Public content
            { visibility: 'PUBLIC' },
            // Content in tiers the user is subscribed to
            {
              tiers: {
                some: {
                  id: {
                    in: subscribedTierIds
                  }
                }
              }
            }
          ],
          // Only content from the last 30 days
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        include: {
          artist: {
            select: {
              id: true,
              displayName: true,
              avatar: true
            }
          }
        }
      });

      // Format content for frontend
      const formattedContent = recentContent.map(content => ({
        id: content.id,
        title: content.title,
        description: content.description,
        type: content.type.toLowerCase() as 'audio' | 'video' | 'image' | 'text',
        thumbnail: content.thumbnailUrl,
        createdAt: content.createdAt.toISOString(),
        artist: {
          displayName: content.artist.displayName,
          avatar: content.artist.avatar
        }
      }));

      logger.info('Fan content feed fetched', {
        fanId: req.user.id,
        contentCount: formattedContent.length,
        subscribedArtists: subscribedArtistIds.length
      });

      return NextResponse.json({
        success: true,
        data: {
          content: formattedContent
        }
      });

    } catch (error) {
      logger.error('Get fan content feed error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to fetch content feed' },
        { status: 500 }
      );
    }
  });
}