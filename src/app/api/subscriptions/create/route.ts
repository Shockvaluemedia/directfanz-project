import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';

/**
 * POST /api/subscriptions/create
 * Creates a new subscription with optional free trial
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'FAN') {
      return NextResponse.json(
        { success: false, error: 'Only fans can create subscriptions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tierId } = body;

    if (!tierId) {
      return NextResponse.json({ success: false, error: 'Tier ID is required' }, { status: 400 });
    }

    // Get tier details
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
      return NextResponse.json({ success: false, error: 'Tier not found' }, { status: 404 });
    }

    if (!tier.isActive) {
      return NextResponse.json({ success: false, error: 'Tier is not active' }, { status: 400 });
    }

    // Check if user already has subscription to this tier
    const existingSubscription = await prisma.subscriptions.findUnique({
      where: {
        fanId_tierId: {
          fanId: session.user.id,
          tierId: tier.id,
        },
      },
    });

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'You already have an active subscription to this tier' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const fan = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (!fan) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let stripeCustomerId = fan.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: fan.email,
        name: fan.displayName,
        metadata: {
          userId: fan.id,
        },
      });

      stripeCustomerId = customer.id;

      await prisma.users.update({
        where: { id: fan.id },
        data: { stripeCustomerId },
      });
    }

    // Get artist's Stripe account
    const artistStripeAccountId = tier.users.artists?.stripeAccountId;

    if (!artistStripeAccountId) {
      return NextResponse.json(
        { success: false, error: 'Artist has not connected Stripe' },
        { status: 400 }
      );
    }

    // Create or get price in Stripe
    let stripePriceId = tier.stripePriceId;

    if (!stripePriceId) {
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: Math.round(Number(tier.minimumPrice) * 100), // Convert to cents
        recurring: {
          interval: 'month',
        },
        product_data: {
          name: tier.name,
          description: tier.description,
        },
        metadata: {
          tierId: tier.id,
          artistId: tier.artistId,
        },
      }, {
        stripeAccount: artistStripeAccountId,
      });

      stripePriceId = price.id;

      await prisma.tiers.update({
        where: { id: tier.id },
        data: { stripePriceId },
      });
    }

    // Determine if trial should be applied
    const applyTrial = tier.allowFreeTrial;
    const trialDays = tier.trialDays || 7;

    // Create Stripe subscription
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{
        price: stripePriceId,
      }],
      trial_period_days: applyTrial ? trialDays : undefined,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      application_fee_percent: 20, // Platform takes 20% (artist gets 80%)
      transfer_data: {
        destination: artistStripeAccountId,
      },
      metadata: {
        fanId: session.user.id,
        artistId: tier.artistId,
        tierId: tier.id,
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Calculate trial dates
    const trialStartDate = applyTrial ? new Date() : null;
    const trialEndDate = applyTrial
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
      : null;

    // Save subscription to database
    const dbSubscription = await prisma.subscriptions.create({
      data: {
        id: subscription.id,
        fanId: session.user.id,
        artistId: tier.artistId,
        tierId: tier.id,
        stripeSubscriptionId: subscription.id,
        amount: tier.minimumPrice,
        status: applyTrial ? 'TRIALING' : 'ACTIVE',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        isTrialing: applyTrial,
        trialStartDate,
        trialEndDate,
        convertedFromTrial: false,
        updatedAt: new Date(),
      },
    });

    // Update tier subscriber count
    await prisma.tiers.update({
      where: { id: tier.id },
      data: {
        subscriberCount: { increment: 1 },
      },
    });

    // Send welcome notification
    try {
      const { sendNotification } = await import('@/lib/notifications');
      await sendNotification({
        userId: session.user.id,
        type: 'subscription_created',
        title: `${applyTrial ? 'Free Trial Started' : 'Subscription Active'}!`,
        message: `You're now subscribed to ${tier.users.displayName}'s ${tier.name} tier.${applyTrial ? ` Enjoy your ${trialDays}-day free trial!` : ''}`,
        data: {
          subscriptionId: dbSubscription.id,
          tierId: tier.id,
          artistId: tier.artistId,
        },
        channels: ['email', 'in_app'],
        priority: 'high',
      });
    } catch (error) {
      logger.error('Failed to send subscription notification', { error });
    }

    logger.info('Subscription created', {
      subscriptionId: subscription.id,
      fanId: session.user.id,
      tierId: tier.id,
      hasTrial: applyTrial,
      trialDays,
    });

    // Get client secret for payment confirmation
    const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;

    return NextResponse.json({
      success: true,
      data: {
        subscription: dbSubscription,
        clientSecret,
        requiresAction: subscription.status === 'incomplete',
        hasTrial: applyTrial,
        trialDays,
        trialEndDate,
      },
    });
  } catch (error: any) {
    logger.error('Failed to create subscription', { error: error.message });
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create subscription',
      },
      { status: 500 }
    );
  }
}
