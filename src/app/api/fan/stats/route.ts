import { NextRequest, NextResponse } from 'next/server';
import { safeParseURL } from '@/lib/api-utils';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return withApi(request, async req => {
    try {
      // Verify user is a fan
      if (req.user.role !== 'FAN') {
        return NextResponse.json({ error: 'Access denied. Fan role required.' }, { status: 403 });
      }

      // Get fan statistics
      const [activeSubscriptions, allSubscriptions, unreadMessages] = await Promise.all([
        // Active subscriptions count
        prisma.subscriptions.count({
          where: {
            fanId: req.user.id,
            status: 'ACTIVE',
          },
        }),

        // All subscriptions for total spent calculation
        prisma.subscriptions.findMany({
          where: {
            fanId: req.user.id,
          },
          select: {
            amount: true,
            status: true,
            createdAt: true,
            currentPeriodEnd: true,
          },
        }),

        // Unread messages count
        prisma.messages.count({
          where: {
            recipientId: req.user.id,
            readAt: null,
          },
        }),
      ]);

      // Calculate total spent (simplified calculation)
      const totalSpent = allSubscriptions.reduce((sum, sub) => {
        // For simplicity, calculate based on subscription duration
        const now = new Date();
        const createdAt = new Date(sub.createdAt);
        const monthsActive = Math.max(
          1,
          Math.floor((now.getTime() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000))
        );
        return sum + Number(sub.amount) * monthsActive;
      }, 0);

      // Get unique artists from subscriptions (favorite artists count)
      const favoriteArtists = await prisma.subscriptions.findMany({
        where: {
          fanId: req.user.id,
          status: 'ACTIVE',
        },
        select: {
          artistId: true,
        },
        distinct: ['artistId'],
      });

      // Calculate hours listened (simplified - based on content interactions)
      // This would typically come from actual listening/viewing analytics
      const contentInteractions = await prisma.comments.count({
        where: {
          fanId: req.user.id,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      });

      // Rough estimate: 10 minutes per interaction, converted to hours
      const hoursListened = Math.round((contentInteractions * 10) / 60);

      const stats = {
        activeSubscriptions,
        totalSpent: Math.round(totalSpent),
        favoriteArtists: favoriteArtists.length,
        hoursListened: Math.max(hoursListened, activeSubscriptions * 2), // Minimum 2 hours per subscription
        unreadMessages,
      };

      logger.info('Fan stats fetched', {
        fanId: req.user.id,
        stats,
      });

      return NextResponse.json({
        success: true,
        data: {
          stats,
        },
      });
    } catch (error) {
      logger.error('Get fan stats error', { userId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to fetch fan statistics' }, { status: 500 });
    }
  });
}
