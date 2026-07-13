import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { simulatedSubscriptionsEnabled } from '@/lib/subscription-mode';

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
      orderBy: { createdAt: 'desc' },
    });

    // Format subscriptions for dashboard consistency
    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      artist: {
        id: sub.tiers.users.id,
        displayName: sub.tiers.users.displayName,
        avatar: sub.tiers.users.avatar,
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

// POST /api/fan/subscriptions — create (or reactivate) a simulated subscription.
// This exists so the fan access flow works before Stripe is configured; it writes
// the same ACTIVE subscription row the Stripe webhook would, which is all the
// content-access check needs.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can subscribe' }, { status: 403 });
    }

    if (!simulatedSubscriptionsEnabled()) {
      return NextResponse.json(
        { error: 'Simulated subscriptions are disabled. Use checkout to subscribe.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const tierId = body?.tierId as string | undefined;
    if (!tierId) {
      return NextResponse.json({ error: 'tierId is required' }, { status: 400 });
    }

    const tier = await prisma.tiers.findUnique({ where: { id: tierId } });
    if (!tier || !tier.isActive) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Upsert the subscription and recompute the subscriber counts from the
    // actual ACTIVE rows in one transaction. Recomputing (rather than
    // incrementing off a prior read) is idempotent, so concurrent retries or
    // double-clicks on the same (fan, tier) cannot over-count.
    const subscription = await prisma.$transaction(async tx => {
      const sub = await tx.subscriptions.upsert({
        where: { fanId_tierId: { fanId: user.id, tierId } },
        update: {
          status: 'ACTIVE',
          amount: tier.minimumPrice,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        },
        create: {
          id: randomUUID(),
          fanId: user.id,
          artistId: tier.artistId,
          tierId,
          stripeSubscriptionId: `sim_${randomUUID()}`,
          amount: tier.minimumPrice,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        },
      });

      const [tierActive, artistActive] = await Promise.all([
        tx.subscriptions.count({ where: { tierId, status: 'ACTIVE' } }),
        tx.subscriptions.count({ where: { artistId: tier.artistId, status: 'ACTIVE' } }),
      ]);

      await tx.tiers.update({ where: { id: tierId }, data: { subscriberCount: tierActive } });
      await tx.artists
        .update({ where: { userId: tier.artistId }, data: { totalSubscribers: artistActive } })
        .catch(() => {});

      return sub;
    });

    return NextResponse.json({
      success: true,
      simulated: true,
      data: {
        id: subscription.id,
        tierId,
        artistId: tier.artistId,
        status: 'active',
        currentPeriodEnd: periodEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create simulated subscription error:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
