import { NextRequest, NextResponse } from 'next/server';
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

const createCheckoutSchema = z.object({
  tierId: z.string(),
  amount: z.number().min(0.01),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tierId, amount } = createCheckoutSchema.parse(body);

    // Get user (fan) details
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can create subscriptions' }, { status: 403 });
    }

    // Get tier and artist details
    const tier = await prisma.tiers.findUnique({
      where: { id: tierId },
      include: {
        artist: {
          include: {
            artists: true,
          },
        },
      },
    });

    if (!tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    if (!tier.isActive) {
      return NextResponse.json({ error: 'Tier is not active' }, { status: 400 });
    }

    // Validate minimum amount
    if (amount < parseFloat(tier.minimumPrice.toString())) {
      return NextResponse.json({ error: 'Amount is below minimum price' }, { status: 400 });
    }

    // Check if artist is onboarded with Stripe
    if (!tier.artist.artists?.stripeAccountId || !tier.artist.artists.isStripeOnboarded) {
      return NextResponse.json(
        { error: 'Artist is not set up to receive payments' },
        { status: 400 }
      );
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
      return NextResponse.json({ error: 'Already subscribed to this tier' }, { status: 400 });
    }

    const stripeAccountId = tier.artist.artists.stripeAccountId;

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

    return NextResponse.json({
      checkoutUrl,
    });
  } catch (error) {
    console.error('Create checkout error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
