import { NextRequest } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { withArtistApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const artist = await prisma.users.findUnique({
        where: { id: req.user.id },
        include: {
          artists: true,
          tiers: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              content: true,
              tiers: true,
            },
          },
        },
      });

      if (!artist) {
        return apiError('NOT_FOUND', 'Artist profile not found');
      }

      return apiSuccess({
          id: artist.id,
          email: artist.email,
          displayName: artist.displayName,
          bio: artist.bio,
          avatar: artist.avatar,
          socialLinks: artist.socialLinks,
          artists: artist.artists,
          tiers: artist.tiers,
          stats: {
            totalContent: artist._count.content,
            totalTiers: artist._count.tiers,
            totalSubscribers: artist.artists?.totalSubscribers || 0,
            totalEarnings: artist.artists?.totalEarnings || 0,
          },
        });
    } catch (error) {
      logger.error('Artist profile fetch error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to fetch artist profile');
    }
  });
}

export async function PUT(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const body = await request.json();
      const { displayName, bio, avatar, socialLinks } = body;

      const updatedArtist = await prisma.users.update({
        where: { id: req.user.id },
        data: {
          displayName,
          bio,
          avatar,
          socialLinks,
        },
        include: {
          artists: true,
        },
      });

      return apiSuccess({ message: 'Artist profile updated successfully',
        data: updatedArtist });
    } catch (error) {
      logger.error('Artist profile update error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to update artist profile');
    }
  });
}
