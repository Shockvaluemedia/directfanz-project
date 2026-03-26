import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

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

    return NextResponse.json({
      success: true,
      data: {
        totalStreams,
        liveStreams,
        totalViewers,
        totalTips: totalTips._sum.amount || 0,
        totalMessages,
        recentStreams,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch streaming stats', {}, error as Error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
