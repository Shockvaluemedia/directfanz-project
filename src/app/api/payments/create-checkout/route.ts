import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createStripeProduct,
  createStripePrice,
  createCheckoutSession,
  createOrRetrieveCustomer,
} from '@/lib/stripe';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const createCheckoutSchema = z.object({
  tierId: z.string(),
  amount: z.number().min(0.01),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();
    const { tierId, amount } = createCheckoutSchema.parse(body);

    // Get user (fan) details
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== 'FAN') {
      return apiError('FORBIDDEN', 'Only fans can create subscriptions');
    }

    // Get tier and artist details
    const tier = await prisma.tiers.findUnique({
      where: { id: tierId },
      include: {
        users: {
          include: {
            artists: true,
          },
        },
      },
    });

    if (!tier) {
      return apiError('NOT_FOUND', 'Tier not found');
    }

    if (!tier.isActive) {
      return apiError('BAD_REQUEST', 'Tier is not active');
    }

    // Validate minimum amount
    if (amount < parseFloat(tier.minimumPrice.toString())) {
      return apiError('BAD_REQUEST', 'Amount is below minimum price');
    }

    // Check if artist is onboarded with Stripe
    if (!tier.users.artists?.stripeAccountId || !tier.users.artists.isStripeOnboarded) {
      return apiError('BAD_REQUEST', 'Artist is not set up to receive payments');
    }

    // Check if fan already has a subscription to this tier
    const existingSubscription = await prisma.subscriptions.findUnique({
      where: {
        fanId_tierId: {
          fanId: user.id,
          tierId: tier.id,
        },
      },
    });

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      return apiError('BAD_REQUEST', 'Already subscribed to this tier');
    }

    const stripeAccountId = tier.users.artists.stripeAccountId;

    // Create or retrieve Stripe customer
    const customerId = await createOrRetrieveCustomer(
      user.email,
      user.displayName,
      stripeAccountId
    );

    // Create Stripe product for this tier (or use existing one)
    const productId = await createStripeProduct(tier.name, tier.description, stripeAccountId);

    // Create Stripe price for the custom amount
    const priceId = await createStripePrice(productId, amount, stripeAccountId);

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/dashboard/fan/subscriptions?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/artist/${tier.artistId}?canceled=true`;

    const metadata = {
      fanId: user.id,
      artistId: tier.artistId,
      tierId: tier.id,
      amount: amount.toString(),
    };

    const checkoutUrl = await createCheckoutSession(
      priceId,
      customerId,
      stripeAccountId,
      successUrl,
      cancelUrl,
      metadata
    );

    return apiSuccess({
      checkoutUrl,
    });
  } catch (error) {
    logger.error('Create checkout error', {}, error as Error);

    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', 'Invalid request data', error.errors);
    }

    return apiError('INTERNAL_ERROR', 'Failed to create checkout session');
  }
}
