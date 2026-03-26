import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { retryPayment, getPaymentFailures, getArtistPaymentFailures } from '@/lib/payment-retry';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
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
        return apiError('NOT_FOUND', 'Subscription not found');
      }

      const failures = await getPaymentFailures(subscriptionId);
      return apiSuccess({ failures });
    } else if (artistId) {
      // Verify artist ownership
      if (session.user.id !== artistId) {
        return apiError('FORBIDDEN', 'Unauthorized');
      }

      const failures = await getArtistPaymentFailures(artistId);
      return apiSuccess({ failures });
    } else {
      return apiError('BAD_REQUEST', 'Missing subscriptionId or artistId parameter');
    }
  } catch (error) {
    logger.error('Error retrieving payment failures', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve payment failures');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { paymentFailureId } = body;

    if (!paymentFailureId) {
      return apiError('BAD_REQUEST', 'Missing paymentFailureId parameter');
    }

    // Get payment failure and verify ownership
    const failure = await prisma.payment_failures.findUnique({
      where: { id: paymentFailureId },
      include: {
        subscriptions: true,
      },
    });

    if (!failure) {
      return apiError('NOT_FOUND', 'Payment failure not found');
    }

    // Verify ownership
    if (
      failure.subscriptions.fanId !== session.user.id &&
      failure.subscriptions.artistId !== session.user.id
    ) {
      return apiError('FORBIDDEN', 'Unauthorized');
    }

    const result = await retryPayment(paymentFailureId);

    return apiSuccess({
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
    logger.error('Error retrying payment', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to retry payment');
  }
}
