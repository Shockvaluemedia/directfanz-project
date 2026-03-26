import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const updateSubscriptionSchema = z.object({
  amount: z.number().min(0.01).optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: params.id,
        fanId: session.user.id, // Ensure fan can only access their own subscriptions
      },
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
    });

    if (!subscription) {
      return apiError('NOT_FOUND', 'Subscription not found');
    }

    return apiSuccess({ subscription });
  } catch (error) {
    logger.error('Get subscription error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch subscription');
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { amount } = updateSubscriptionSchema.parse(body);

    // Get subscription and verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: params.id,
        fanId: session.user.id,
      },
      include: {
        tiers: true,
      },
    });

    if (!subscription) {
      return apiError('NOT_FOUND', 'Subscription not found');
    }

    if (subscription.status !== 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Can only update active subscriptions');
    }

    if (amount) {
      // Validate minimum amount
      if (amount < parseFloat(subscription.tiers.minimumPrice.toString())) {
        return apiError('BAD_REQUEST', 'Amount is below minimum price');
      }

      // Update subscription amount in Stripe
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );

        // Update the subscription item with new price
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price_data: {
                currency: 'usd',
                product: stripeSubscription.items.data[0].price.product as string,
                unit_amount: Math.round(amount * 100),
                recurring: {
                  interval: 'month',
                },
              },
            },
          ],
          proration_behavior: 'create_prorations',
        });

        // Update local database
        await prisma.subscriptions.update({
          where: { id: subscription.id },
          data: { amount },
        });

        return apiSuccess({
          message: 'Subscription updated successfully',
          amount,
        });
      } catch (stripeError) {
        logger.error('Stripe update error', {}, stripeError as Error);
        return apiError('INTERNAL_ERROR', 'Failed to update subscription with payment provider');
      }
    }

    return apiSuccess({ message: 'No changes made' });
  } catch (error) {
    logger.error('Update subscription error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', 'Invalid request data', error.errors);
    }

    return apiError('INTERNAL_ERROR', 'Failed to update subscription');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    // Get subscription and verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: params.id,
        fanId: session.user.id,
      },
    });

    if (!subscription) {
      return apiError('NOT_FOUND', 'Subscription not found');
    }

    if (subscription.status === 'CANCELED') {
      return apiError('BAD_REQUEST', 'Subscription is already canceled');
    }

    // Cancel subscription in Stripe
    try {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

      // Update local database (webhook will handle the final status update)
      await prisma.subscriptions.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED' },
      });

      return apiSuccess({
        message: 'Subscription canceled successfully',
      });
    } catch (stripeError) {
      logger.error('Stripe cancellation error', {}, stripeError as Error);
      return apiError('INTERNAL_ERROR', 'Failed to cancel subscription with payment provider');
    }
  } catch (error) {
    logger.error('Cancel subscription error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to cancel subscription');
  }
}
