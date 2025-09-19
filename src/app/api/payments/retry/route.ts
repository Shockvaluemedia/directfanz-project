import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { retryPayment, getPaymentFailures, getArtistPaymentFailures } from '@/lib/payment-retry';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get('subscriptionId');
    const artistId = url.searchParams.get('artistId');

    if (subscriptionId) {
      // Verify subscription ownership
      const subscription = await prisma.subscriptions.findUnique({
        where: {
          id: subscriptionId,
          OR: [{ fanId: session.user.id }, { artistId: session.user.id }],
        },
      });

      if (!subscription) {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }

      const failures = await getPaymentFailures(subscriptionId);
      return NextResponse.json({ failures });
    } else if (artistId) {
      // Verify artist ownership
      if (session.user.id !== artistId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const failures = await getArtistPaymentFailures(artistId);
      return NextResponse.json({ failures });
    } else {
      return NextResponse.json(
        { error: 'Missing subscriptionId or artistId parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error retrieving payment failures:', error);
    return NextResponse.json({ error: 'Failed to retrieve payment failures' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentFailureId } = body;

    if (!paymentFailureId) {
      return NextResponse.json({ error: 'Missing paymentFailureId parameter' }, { status: 400 });
    }

    // Get payment failure and verify ownership
    const failure = await prisma.paymentFailure.findUnique({
      where: { id: paymentFailureId },
      include: {
        subscription: true,
      },
    });

    if (!failure) {
      return NextResponse.json({ error: 'Payment failure not found' }, { status: 404 });
    }

    // Verify ownership
    if (
      failure.subscription.fanId !== session.user.id &&
      failure.subscription.artistId !== session.user.id
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await retryPayment(paymentFailureId);

    return NextResponse.json({
      success: result.success,
      resolved: result.resolved,
      nextRetryAt: result.nextRetryAt,
      attemptCount: result.attemptCount,
      message: result.success
        ? 'Payment processed successfully'
        : result.resolved
          ? 'Subscription canceled due to repeated payment failures'
          : 'Payment retry failed, will try again later',
    });
  } catch (error) {
    console.error('Error retrying payment:', error);
    return NextResponse.json({ error: 'Failed to retry payment' }, { status: 500 });
  }
}
