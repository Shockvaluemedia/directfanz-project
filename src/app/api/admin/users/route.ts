import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const userFilterSchema = z.object({
  role: z.enum(['ARTIST', 'FAN']).optional(),
  status: z.enum(['active', 'suspended', 'all']).default('all'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  search: z.string().optional(),
  sortBy: z.enum(['newest', 'oldest', 'name', 'earnings', 'subscribers']).default('newest'),
});

const userUpdateSchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().optional(),
  role: z.enum(['ARTIST', 'FAN']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

export async function GET(request: NextRequest) {
  return withAdminApi(request, async req => {
    try {
      const { searchParams } = new URL(request.url);

      const params = userFilterSchema.parse({
        role: searchParams.get('role') || undefined,
        status: searchParams.get('status') || 'all',
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0'),
        search: searchParams.get('search') || undefined,
        sortBy: searchParams.get('sortBy') || 'newest',
      });

      const whereClause: any = {
        ...(params.role && { role: params.role }),
        ...(params.search && {
          OR: [
            { displayName: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
            { bio: { contains: params.search, mode: 'insensitive' } },
          ],
        }),
      };

      // Note: Status filtering would require a status field in the User model
      // For now, we'll assume all users are 'active'

      const orderBy = getOrderBy(params.sortBy);

      const [users, totalCount] = await Promise.all([
        prisma.users.findMany({
          where: whereClause,
          include: {
            artists: true,
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { tiers: true },
            },
            _count: {
              select: {
                content: true,
                subscriptions: true,
                comments: true,
              },
            },
          },
          orderBy,
          take: params.limit,
          skip: params.offset,
        }),
        prisma.users.count({ where: whereClause }),
      ]);

      const formattedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar,
        role: user.role,
        socialLinks: user.socialLinks,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,

        // Artist-specific data
        ...(user.role === 'ARTIST' && {
          artists: user.artists,
          contentCount: user._count.content,
          totalEarnings: user.artists?.totalEarnings || 0,
          totalSubscribers: user.artists?.totalSubscribers || 0,
        }),

        // Fan-specific data
        ...(user.role === 'FAN' && {
          subscriptionCount: user._count.subscriptions,
          activeSubscriptions: user.subscriptions.length,
          monthlySpending: user.subscriptions.reduce(
            (sum, sub) => sum + parseFloat(sub.amount.toString()),
            0
          ),
          commentCount: user._count.comments,
        }),

        // General stats
        accountAge: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      }));

      logger.info('Admin users list fetched', {
        adminUserId: req.user.id,
        totalUsers: totalCount,
        filters: params,
      });

      return NextResponse.json({
        success: true,
        data: formattedUsers,
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total: totalCount,
          hasNext: params.offset + params.limit < totalCount,
        },
        stats: {
          total: totalCount,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid parameters',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Admin users endpoint error', { adminUserId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAdminApi(request, async req => {
    try {
      const body = await request.json();
      const { userId, action, ...updateData } = body;

      if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }

      let result;

      if (action === 'suspend') {
        // For now, we'll log the suspension action
        // In a real implementation, you'd add a status field to track this
        logger.warn('User suspension requested', {
          adminUserId: req.user.id,
          targetUserId: userId,
          action: 'suspend',
        });

        result = await prisma.users.findUnique({
          where: { id: userId },
          include: { artists: true },
        });

        // Note: Implement actual suspension logic here
        // This might involve:
        // - Setting a status field
        // - Canceling active subscriptions
        // - Hiding content
        // - Sending notifications
      } else if (action === 'reactivate') {
        logger.info('User reactivation requested', {
          adminUserId: req.user.id,
          targetUserId: userId,
          action: 'reactivate',
        });

        result = await prisma.users.findUnique({
          where: { id: userId },
          include: { artists: true },
        });
      } else {
        // Update user data
        const validatedData = userUpdateSchema.parse(updateData);

        result = await prisma.users.update({
          where: { id: userId },
          data: validatedData,
          include: { artists: true },
        });

        logger.info('User updated by admin', {
          adminUserId: req.user.id,
          targetUserId: userId,
          changes: validatedData,
        });
      }

      if (!result) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `User ${action || 'updated'} successfully`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid update data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Admin user update error', { adminUserId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
  });
}

function getOrderBy(sortBy: string) {
  switch (sortBy) {
    case 'oldest':
      return { createdAt: 'asc' as const };
    case 'name':
      return { displayName: 'asc' as const };
    case 'earnings':
      return { artists: { totalEarnings: 'desc' as const } };
    case 'subscribers':
      return { artists: { totalSubscribers: 'desc' as const } };
    default:
      return { createdAt: 'desc' as const };
  }
}
