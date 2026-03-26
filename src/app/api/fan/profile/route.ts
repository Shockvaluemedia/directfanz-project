import { NextRequest } from 'next/server';
import { withFanApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withFanApi(request, async req => {
    try {
      const fan = await prisma.users.findUnique({
        where: { id: req.user.id },
        include: {
          subscriptions: {
            include: {
              tiers: {
                include: {
                  users: {
                    select: {
                      id: true,
                      displayName: true,
                      avatar: true,
                    },
                  },
                },
              },
            },
            where: {
              status: 'ACTIVE',
            },
          },
          _count: {
            select: {
              subscriptions: true,
              comments: true,
            },
          },
        },
      });

      if (!fan) {
        return apiError('NOT_FOUND', 'Fan profile not found');
      }

      return apiSuccess({
          id: fan.id,
          email: fan.email,
          displayName: fan.displayName,
          bio: fan.bio,
          avatar: fan.avatar,
          socialLinks: fan.socialLinks,
          subscriptions: fan.subscriptions,
          stats: {
            totalSubscriptions: fan._count.subscriptions,
            totalComments: fan._count.comments,
            activeSubscriptions: fan.subscriptions.length,
          },
        });
    } catch (error) {
      logger.error('Fan profile fetch error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to fetch fan profile');
    }
  });
}

export async function PUT(request: NextRequest) {
  return withFanApi(request, async req => {
    try {
      const body = await request.json();
      const { displayName, bio, avatar, socialLinks } = body;

      const updatedFan = await prisma.users.update({
        where: { id: req.user.id },
        data: {
          displayName,
          bio,
          avatar,
          socialLinks,
        },
      });

      return apiSuccess({ message: 'Fan profile updated successfully',
        data: updatedFan });
    } catch (error) {
      logger.error('Fan profile update error', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to update fan profile');
    }
  });
}
