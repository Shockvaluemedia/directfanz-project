import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and verify they are a fan
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can view subscriptions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status if provided

    // Build where clause
    const whereClause: any = { fanId: user.id };
    if (status && status !== 'all') {
      whereClause.status = status.toUpperCase();
    }

    // Get subscriptions for this fan
    const subscriptions = await prisma.subscriptions.findMany({
      where: whereClause,
      include: {
        tiers: {
          include: {
            artists: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format subscriptions for dashboard consistency
    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      artist: {
        id: sub.tiers.artists.id,
        displayName: sub.tiers.artists.displayName,
        avatar: sub.tiers.artists.avatar,
      },
      tier: {
        name: sub.tiers.name,
        price: Number(sub.amount),
      },
      status: sub.status.toLowerCase(),
      nextBillingDate: sub.currentPeriodEnd.toISOString(),
      createdAt: sub.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: formattedSubscriptions,
      },
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}
