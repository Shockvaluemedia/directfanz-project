import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is an admin
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    const isAdmin = user?.role === 'ADMIN' || user?.email === 'admin@directfan.com';
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    // Calculate date ranges for analytics
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Optimized: Fetch stats using fewer, more efficient queries
    const [
      userStats,
      contentStats,
      recentActivity
    ] = await Promise.all([
      // Combined user statistics in single query
      prisma.users.groupBy({
        by: ['role'],
        _count: true,
        where: {
          // Include all users for role counts
        },
      }).then(async (roleGroups) => {
        // Get additional user counts in parallel
        const [totalUsers, recentSignups] = await Promise.all([
          prisma.users.count(),
          prisma.users.count({
            where: {
              createdAt: {
                gte: lastWeek,
              },
            },
          }),
        ]);
        
        const roleCounts = roleGroups.reduce((acc, item) => {
          acc[item.role] = item._count;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          totalUsers,
          totalArtists: roleCounts.ARTIST || 0,
          totalFans: roleCounts.FAN || 0,
          recentSignups,
          bannedUsers: 0, // TODO: implement when user status field exists
        };
      }),
      
      // Combined content statistics
      Promise.all([
        prisma.content.count(),
        prisma.content.count({
          where: {
            createdAt: {
              gte: today,
            },
          },
        }),
      ]).then(([totalContent, contentToday]) => ({
        totalContent,
        contentToday,
      })),
      
      // Recent activity (optimized to get recent activities efficiently)
      Promise.all([
        // Recent user signups
        prisma.users.findMany({
          where: {
            createdAt: {
              gte: lastWeek,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            displayName: true,
            role: true,
            createdAt: true,
          },
        }),
        
        // Recent content uploads
        prisma.content.findMany({
          where: {
            createdAt: {
              gte: lastWeek,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            title: true,
            createdAt: true,
            users: {
              select: {
                displayName: true,
              },
            },
          },
        }),
      ]),
    ]);

    // Process recent activity
    const [signupActivity, contentActivity] = recentActivity;
    
    const formattedActivity = [
      ...signupActivity.map(signup => ({
        type: 'user_signup',
        description: `${signup.displayName} (${signup.role.toLowerCase()}) joined the platform`,
        createdAt: signup.createdAt.toISOString(),
        actionRequired: false,
      })),
      ...contentActivity.map(content => ({
        type: 'content_upload',
        description: `${content.users.displayName} uploaded "${content.title}"`,
        createdAt: content.createdAt.toISOString(),
        actionRequired: false,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const stats = {
      totalUsers: userStats.totalUsers,
      totalArtists: userStats.totalArtists,
      totalFans: userStats.totalFans,
      totalRevenue: 0, // TODO: implement when payments table exists
      monthlyRevenue: 0, // TODO: implement when payments table exists
      totalContent: contentStats.totalContent,
      activeReports: 0, // TODO: implement when reports table exists
      bannedUsers: userStats.bannedUsers,
      recentSignups: userStats.recentSignups,
      contentUploadsToday: contentStats.contentToday,
    };

    logger.info('Admin dashboard stats fetched', {
      adminId: session.user.id,
      stats,
    });

    return NextResponse.json({
      success: true,
      data: {
        stats,
        recentActivity: formattedActivity,
      },
    });
    
  } catch (error) {
    logger.error('Admin dashboard stats error', { userId: session?.user?.id }, error as Error);
    return NextResponse.json({ error: 'Failed to fetch admin dashboard stats' }, { status: 500 });
  }
}