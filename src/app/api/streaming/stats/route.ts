import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    const [
      totalStreams,
      liveStreams,
      totalViewers,
      totalTips,
      totalMessages,
      recentStreams,
    ] = await Promise.all([
      prisma.live_streams.count({ where: { artistId: userId } }),
      prisma.live_streams.count({ where: { artistId: userId, status: 'LIVE' } }),
      prisma.stream_viewers.count({
        where: { live_streams: { artistId: userId } },
      }),
      prisma.stream_tips.aggregate({
        where: { live_streams: { artistId: userId }, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.stream_chat_messages.count({
        where: { live_streams: { artistId: userId } },
      }),
      prisma.live_streams.findMany({
        where: { artistId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          startedAt: true,
          endedAt: true,
          totalViewers: true,
          peakViewers: true,
          totalTips: true,
          totalMessages: true,
        },
      }),
    ]);

    const trendingStreams = await prisma.live_streams.findMany({
      where: { status: 'LIVE' },
      orderBy: { totalViewers: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, totalViewers: true, artistId: true },
    });

    const categoryGroups = await prisma.live_streams.groupBy({
      by: ['category'],
      where: { status: 'LIVE', category: { not: null } },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
      take: 5,
    });
    const popularCategories = categoryGroups
      .map(g => g.category)
      .filter(Boolean) as string[];

    return NextResponse.json({
      success: true,
      data: {
        totalStreams,
        totalLiveStreams: liveStreams,
        liveStreams,
        totalViewers,
        totalTips: totalTips._sum.amount || 0,
        totalMessages,
        recentStreams,
        trendingStreams,
        popularCategories,
      },
    });
  } catch (error) {
    console.error('Failed to fetch streaming stats:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
