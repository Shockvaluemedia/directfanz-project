import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return withApi(request, async req => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '10');

      let recommendedArtists;

      if (req.user.role === 'FAN') {
        // Get personalized recommendations for fans
        // First, get artists the user is already subscribed to
        const subscribedArtistIds = await prisma.subscriptions
          .findMany({
            where: {
              fanId: req.user.id,
              status: 'ACTIVE',
            },
            select: {
              artistId: true,
            },
          })
          .then(subs => subs.map(s => s.artistId));

        // Get genres/preferences from user's current subscriptions
        const userPreferences = await prisma.subscriptions.findMany({
          where: {
            fanId: req.user.id,
            status: 'ACTIVE',
          },
          include: {
            tier: {
              include: {
                artist: {
                  select: {
                    id: true,
                    socialLinks: true, // This might contain genre info
                  },
                },
              },
            },
          },
        });

        // For now, recommend artists with similar subscriber counts or recent activity
        recommendedArtists = await prisma.users.findMany({
          where: {
            role: 'ARTIST',
            id: {
              notIn: subscribedArtistIds.length > 0 ? subscribedArtistIds : undefined,
            },
            // Only recommend artists with at least some content
            content: {
              some: {
                visibility: 'PUBLIC',
              },
            },
          },
          take: limit,
          orderBy: [
            // Prioritize artists with recent content
            { createdAt: 'desc' },
          ],
          include: {
            artists: {
              select: {
                totalSubscribers: true,
              },
            },
            content: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                type: true,
                createdAt: true,
              },
            },
          },
        });
      } else {
        // General recommendations for non-fans or artists
        recommendedArtists = await prisma.users.findMany({
          where: {
            role: 'ARTIST',
            content: {
              some: {
                visibility: 'PUBLIC',
              },
            },
          },
          take: limit,
          orderBy: [{ createdAt: 'desc' }],
          include: {
            artists: {
              select: {
                totalSubscribers: true,
              },
            },
            content: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                type: true,
                createdAt: true,
              },
            },
          },
        });
      }

      // Format recommendations
      const formattedRecommendations = recommendedArtists.map(artist => {
        // Determine primary genre (simplified)
        const contentType = artist.content[0]?.type || 'AUDIO';
        const genre =
          contentType === 'AUDIO'
            ? 'Music'
            : contentType === 'VIDEO'
              ? 'Video'
              : contentType === 'IMAGE'
                ? 'Visual'
                : 'Content';

        // Generate description based on available data
        const subscriberCount = artist.artists?.totalSubscribers || 0;
        const hasRecentContent =
          artist.content[0]?.createdAt &&
          new Date(artist.content[0].createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const description = hasRecentContent
          ? `Active creator sharing ${genre.toLowerCase()} content regularly`
          : `Creator sharing ${genre.toLowerCase()} content with ${subscriberCount > 0 ? 'growing community' : 'emerging presence'}`;

        return {
          id: artist.id,
          displayName: artist.displayName,
          avatar: artist.avatar,
          genre,
          subscriberCount,
          description,
        };
      });

      // Sort by subscriber count for better recommendations
      formattedRecommendations.sort((a, b) => b.subscriberCount - a.subscriberCount);

      logger.info('Artist recommendations fetched', {
        userId: req.user.id,
        userRole: req.user.role,
        recommendationCount: formattedRecommendations.length,
      });

      return NextResponse.json({
        success: true,
        data: {
          artists: formattedRecommendations,
        },
      });
    } catch (error) {
      logger.error('Get recommendations error', { userId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
    }
  });
}
