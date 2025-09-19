import { NextRequest, NextResponse } from 'next/server';
import { withFanApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  return withFanApi(request, async req => {
    try {
      const fan = await prisma.users.findUnique({
        where: { id: req.user.id },
        include: {
          subscriptions: {
            include: {
              tier: {
                include: {
                  artist: {
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
        return NextResponse.json({ error: 'Fan profile not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
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
        },
      });
    } catch (error) {
      console.error('Fan profile fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch fan profile' }, { status: 500 });
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

      return NextResponse.json({
        success: true,
        message: 'Fan profile updated successfully',
        data: updatedFan,
      });
    } catch (error) {
      console.error('Fan profile update error:', error);
      return NextResponse.json({ error: 'Failed to update fan profile' }, { status: 500 });
    }
  });
}
