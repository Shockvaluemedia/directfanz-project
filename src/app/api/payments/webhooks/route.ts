import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/notifications';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret!);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    if (!session.metadata) {
      console.error('No metadata in checkout session');
      return;
    }

    const { fanId, artistId, tierId, amount } = session.metadata;
    const subscriptionId = session.subscription as string;

    // Create subscription record
    await prisma.subscription.create({
      data: {
        fanId,
        artistId,
        tierId,
        stripeSubscriptionId: subscriptionId,
        amount: parseFloat(amount),
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    // Update tier subscriber count
    await prisma.tier.update({
      where: { id: tierId },
      data: {
        subscriberCount: {
          increment: 1,
        },
      },
    });

    // Update artist total subscribers
    await prisma.artist.update({
      where: { userId: artistId },
      data: {
        totalSubscribers: {
          increment: 1,
        },
      },
    });

    // Send welcome notification to fan
    const [fan, artist, tier] = await Promise.all([
      prisma.user.findUnique({ where: { id: fanId } }),
      prisma.user.findUnique({ where: { id: artistId } }),
      prisma.tier.findUnique({ where: { id: tierId } })
    ]);

    if (fan?.email && artist && tier) {
      await sendEmail({
        to: fan.email,
        subject: `Welcome to ${artist.displayName}'s ${tier.name} Tier!`,
        html: `
          <h1>Thank you for subscribing!</h1>
          <p>You are now subscribed to ${artist.displayName}'s ${tier.name} tier.</p>
          <p>You now have access to exclusive content from ${artist.displayName}.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/artist/${artistId}">Visit ${artist.displayName}'s page</a></p>
        `,
        text: `Thank you for subscribing!\n\nYou are now subscribed to ${artist.displayName}'s ${tier.name} tier.\n\nYou now have access to exclusive content from ${artist.displayName}.\n\nVisit ${artist.displayName}'s page: ${process.env.NEXT_PUBLIC_APP_URL}/artist/${artistId}`
      });
    }

    console.log(`Subscription created for fan ${fanId} to tier ${tierId}`);
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string;
    
    if (!subscriptionId) {
      return;
    }

    // Update subscription status and period
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(invoice.period_start * 1000),
          currentPeriodEnd: new Date(invoice.period_end * 1000),
        },
      });

      // Update artist earnings
      const amount = invoice.amount_paid / 100; // Convert from cents
      const platformFee = amount * 0.05; // 5% platform fee
      const artistEarnings = amount - platformFee;

      await prisma.artist.update({
        where: { userId: subscription.artistId },
        data: {
          totalEarnings: {
            increment: artistEarnings,
          },
        },
      });

      console.log(`Payment succeeded for subscription ${subscriptionId}`);
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string;
    
    if (!subscriptionId) {
      return;
    }

    // Update subscription status to past due
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: {
        fan: true,
        tier: {
          include: {
            artist: true,
          },
        },
      },
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAST_DUE' },
      });

      // Create a payment failure record for tracking
      await prisma.paymentFailure.create({
        data: {
          subscriptionId: subscription.id,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_due / 100,
          attemptCount: invoice.attempt_count || 1,
          nextRetryAt: invoice.next_payment_attempt 
            ? new Date(invoice.next_payment_attempt * 1000) 
            : null,
          failureReason: invoice.last_finalization_error?.message || 'Payment failed',
        },
      });

      // Send notification email to fan about payment failure
      if (subscription.fan.email) {
        await sendEmail({
          to: subscription.fan.email,
          subject: `Payment Failed for ${subscription.tier.artist?.displayName || 'Artist'} Subscription`,
          html: `
            <h1>Payment Failed</h1>
            <p>We were unable to process your payment for your subscription to ${subscription.tier.name}.</p>
            <p>This was attempt ${invoice.attempt_count} of 3. ${
              invoice.next_payment_attempt 
                ? `We'll try again on ${new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()}.` 
                : 'Please update your payment method to continue your subscription.'
            }</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions">Manage your subscriptions</a></p>
          `,
          text: `Payment Failed for ${subscription.tier.artist?.displayName || 'Artist'} Subscription\n\n` +
            `We were unable to process your payment for your subscription to ${subscription.tier.name}.\n\n` +
            `This was attempt ${invoice.attempt_count} of 3. ${
              invoice.next_payment_attempt 
                ? `We'll try again on ${new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()}.` 
                : 'Please update your payment method to continue your subscription.'
            }\n\n` +
            `Manage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions`
        });
      }
      
      console.log(`Payment failed for subscription ${subscriptionId}, attempt ${invoice.attempt_count}`);
    }
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const subscriptionRecord = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (subscriptionRecord) {
      await prisma.subscription.update({
        where: { id: subscriptionRecord.id },
        data: {
          status: subscription.status.toUpperCase() as any,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });

      console.log(`Subscription updated: ${subscription.id}`);
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const subscriptionRecord = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (subscriptionRecord) {
      // Update subscription status
      await prisma.subscription.update({
        where: { id: subscriptionRecord.id },
        data: { status: 'CANCELED' },
      });

      // Decrement tier subscriber count
      await prisma.tier.update({
        where: { id: subscriptionRecord.tierId },
        data: {
          subscriberCount: {
            decrement: 1,
          },
        },
      });

      // Decrement artist total subscribers
      await prisma.artist.update({
        where: { userId: subscriptionRecord.artistId },
        data: {
          totalSubscribers: {
            decrement: 1,
          },
        },
      });

      console.log(`Subscription canceled: ${subscription.id}`);
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}