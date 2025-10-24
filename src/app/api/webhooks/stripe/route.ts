import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  sendTrialEndingEmail,
  sendTrialConvertedEmail,
  sendPaymentFailedEmail,
  sendNewSubscriberEmail,
} from '@/lib/email/email-service';
import Stripe from 'stripe';

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    logger.error('Missing Stripe signature');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    logger.error('Webhook signature verification failed', { error: err.message });
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      // Trial events
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // Payment events
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Account events
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook handler failed', { type: event.type, error });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle trial ending in 3 days
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  logger.info('Trial will end soon', { subscriptionId });

  // Get subscription from database
  const dbSubscription = await prisma.subscriptions.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      fan: true,
      artist: true,
      tier: true,
    },
  });

  if (!dbSubscription) {
    logger.warn('Subscription not found in database', { subscriptionId });
    return;
  }

  // Send reminder notification to fan
  await prisma.notifications.create({
    data: {
      userId: dbSubscription.fanId,
      type: 'TRIAL_ENDING_SOON',
      title: 'Your trial is ending soon',
      message: `Your trial subscription to ${dbSubscription.artist.displayName} ends in 3 days. You'll be charged $${dbSubscription.amount} on ${new Date(dbSubscription.trialEndDate!).toLocaleDateString()}.`,
      data: JSON.stringify({
        subscriptionId: dbSubscription.id,
        artistId: dbSubscription.artistId,
        tierId: dbSubscription.tierId,
        amount: dbSubscription.amount.toString(),
        trialEndDate: dbSubscription.trialEndDate,
      }),
      read: false,
    },
  });

  logger.info('Trial ending reminder sent', {
    fanId: dbSubscription.fanId,
    artistId: dbSubscription.artistId,
  });

  // Send email notification
  await sendTrialEndingEmail({
    fanEmail: dbSubscription.fan.email,
    fanName: dbSubscription.fan.displayName,
    artistName: dbSubscription.artist.displayName,
    tierName: dbSubscription.tier.name,
    amount: Number(dbSubscription.amount),
    trialEndDate: dbSubscription.trialEndDate!,
  });
}

/**
 * Handle subscription status update (including trial → active)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  logger.info('Subscription updated', {
    subscriptionId,
    status: subscription.status,
    trialEnd: subscription.trial_end,
  });

  // Get subscription from database
  const dbSubscription = await prisma.subscriptions.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      fan: true,
      artist: true,
    },
  });

  if (!dbSubscription) {
    logger.warn('Subscription not found in database', { subscriptionId });
    return;
  }

  // Check if trial just ended (converted to active)
  const wasTrialing = dbSubscription.isTrialing;
  const isNowActive = subscription.status === 'active' && !subscription.trial_end;

  if (wasTrialing && isNowActive) {
    // Trial converted to paid subscription
    await prisma.subscriptions.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'ACTIVE',
        isTrialing: false,
        convertedFromTrial: true,
        updatedAt: new Date(),
      },
    });

    // Notify artist of conversion
    await prisma.notifications.create({
      data: {
        userId: dbSubscription.artistId,
        type: 'TRIAL_CONVERTED',
        title: 'Trial converted to paid subscription',
        message: `${dbSubscription.fan.displayName}'s trial has converted to a paid subscription!`,
        data: JSON.stringify({
          subscriptionId: dbSubscription.id,
          fanId: dbSubscription.fanId,
          tierId: dbSubscription.tierId,
        }),
        read: false,
      },
    });

    // Notify fan of successful conversion
    await prisma.notifications.create({
      data: {
        userId: dbSubscription.fanId,
        type: 'SUBSCRIPTION_ACTIVE',
        title: 'Your subscription is now active',
        message: `Your subscription to ${dbSubscription.artist.displayName} is now active. Thank you for your support!`,
        data: JSON.stringify({
          subscriptionId: dbSubscription.id,
          artistId: dbSubscription.artistId,
        }),
        read: false,
      },
    });

    logger.info('Trial converted to paid', {
      subscriptionId: dbSubscription.id,
      fanId: dbSubscription.fanId,
      artistId: dbSubscription.artistId,
    });

    // Send email to fan
    await sendTrialConvertedEmail({
      fanEmail: dbSubscription.fan.email,
      fanName: dbSubscription.fan.displayName,
      artistName: dbSubscription.artist.displayName,
      tierName: dbSubscription.tier.name,
      amount: Number(dbSubscription.amount),
    });
  } else {
    // Regular status update
    await prisma.subscriptions.update({
      where: { id: dbSubscription.id },
      data: {
        status: subscription.status.toUpperCase() as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        updatedAt: new Date(),
      },
    });

    logger.info('Subscription status updated', {
      subscriptionId: dbSubscription.id,
      newStatus: subscription.status,
    });
  }
}

/**
 * Handle subscription cancellation/deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  logger.info('Subscription deleted', { subscriptionId });

  // Update subscription in database
  const dbSubscription = await prisma.subscriptions.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      artist: true,
      tier: true,
    },
  });

  if (!dbSubscription) {
    logger.warn('Subscription not found in database', { subscriptionId });
    return;
  }

  await prisma.subscriptions.update({
    where: { id: dbSubscription.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Decrement tier subscriber count
  if (dbSubscription.tier) {
    await prisma.tiers.update({
      where: { id: dbSubscription.tierId },
      data: {
        subscriberCount: {
          decrement: 1,
        },
      },
    });
  }

  logger.info('Subscription canceled in database', {
    subscriptionId: dbSubscription.id,
  });
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  logger.info('Payment succeeded', {
    invoiceId: invoice.id,
    subscriptionId,
    amount: invoice.amount_paid,
  });

  const dbSubscription = await prisma.subscriptions.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      fan: true,
      artist: true,
    },
  });

  if (!dbSubscription) {
    logger.warn('Subscription not found for payment', { subscriptionId });
    return;
  }

  // Notify fan of successful payment
  await prisma.notifications.create({
    data: {
      userId: dbSubscription.fanId,
      type: 'PAYMENT_SUCCESS',
      title: 'Payment processed',
      message: `Your payment of $${(invoice.amount_paid / 100).toFixed(2)} to ${dbSubscription.artist.displayName} was successful.`,
      data: JSON.stringify({
        invoiceId: invoice.id,
        subscriptionId: dbSubscription.id,
        amount: invoice.amount_paid / 100,
      }),
      read: false,
    },
  });

  logger.info('Payment success notification sent', {
    fanId: dbSubscription.fanId,
  });
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  logger.error('Payment failed', {
    invoiceId: invoice.id,
    subscriptionId,
    amount: invoice.amount_due,
  });

  const dbSubscription = await prisma.subscriptions.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      fan: true,
      artist: true,
    },
  });

  if (!dbSubscription) {
    logger.warn('Subscription not found for failed payment', { subscriptionId });
    return;
  }

  // Notify fan of failed payment
  await prisma.notifications.create({
    data: {
      userId: dbSubscription.fanId,
      type: 'PAYMENT_FAILED',
      title: 'Payment failed',
      message: `Your payment to ${dbSubscription.artist.displayName} failed. Please update your payment method to continue your subscription.`,
      data: JSON.stringify({
        invoiceId: invoice.id,
        subscriptionId: dbSubscription.id,
        amount: invoice.amount_due / 100,
      }),
      read: false,
    },
  });

  logger.info('Payment failure notification sent', {
    fanId: dbSubscription.fanId,
  });

  // Send email notification
  await sendPaymentFailedEmail({
    fanEmail: dbSubscription.fan.email,
    fanName: dbSubscription.fan.displayName,
    artistName: dbSubscription.artist.displayName,
    amount: invoice.amount_due / 100,
  });
}

/**
 * Handle Stripe account updates (artist onboarding completion)
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const artistId = account.metadata?.userId;

  if (!artistId) {
    logger.warn('Account updated without userId metadata', {
      accountId: account.id,
    });
    return;
  }

  logger.info('Stripe account updated', {
    accountId: account.id,
    artistId,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  });

  // Update artist onboarding status
  if (account.charges_enabled && account.payouts_enabled) {
    await prisma.artists.update({
      where: { userId: artistId },
      data: {
        isStripeOnboarded: true,
      },
    });

    // Update onboarding progress
    await prisma.onboarding_progress.upsert({
      where: { userId: artistId },
      update: {
        stripeConnected: true,
      },
      create: {
        userId: artistId,
        stripeConnected: true,
        completionPercentage: 30, // Stripe step is 30%
      },
    });

    logger.info('Artist Stripe onboarding completed', { artistId });
  }
}
