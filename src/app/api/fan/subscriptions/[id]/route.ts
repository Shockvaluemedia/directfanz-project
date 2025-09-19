import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';

const updateSubscriptionSchema = z.object({
  amount: z.number().min(0.01).optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: params.id,
        fanId: session.user.id, // Ensure fan can only access their own subscriptions
      },
      include: {
        tier: {
          include: {
            artist: {
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
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        tier: true,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    if (subscription.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Can only update active subscriptions' }, { status: 400 });
    }

    if (amount) {
      // Validate minimum amount
      if (amount < parseFloat(subscription.tiers.minimumPrice.toString())) {
        return NextResponse.json({ error: 'Amount is below minimum price' }, { status: 400 });
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

        return NextResponse.json({
          message: 'Subscription updated successfully',
          amount,
        });
      } catch (stripeError) {
        console.error('Stripe update error:', stripeError);
        return NextResponse.json(
          { error: 'Failed to update subscription with payment provider' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ message: 'No changes made' });
  } catch (error) {
    console.error('Update subscription error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get subscription and verify ownership
    const subscription = await prisma.subscriptions.findUnique({
      where: {
        id: params.id,
        fanId: session.user.id,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    if (subscription.status === 'CANCELED') {
      return NextResponse.json({ error: 'Subscription is already canceled' }, { status: 400 });
    }

    // Cancel subscription in Stripe
    try {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

      // Update local database (webhook will handle the final status update)
      await prisma.subscriptions.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED' },
      });

      return NextResponse.json({
        message: 'Subscription canceled successfully',
      });
    } catch (stripeError) {
      console.error('Stripe cancellation error:', stripeError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription with payment provider' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
