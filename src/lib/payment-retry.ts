import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

/**
 * Retry failed payment for a subscription
 */
export async function retryFailedPayment(subscriptionId: string): Promise<boolean> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        paymentFailures: {
          where: { isResolved: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!subscription || subscription.paymentFailures.length === 0) {
      return false;
    }

    const latestFailure = subscription.paymentFailures[0];

    // Check if we should retry based on attempt count and time
    if (latestFailure.attemptCount >= 3) {
      console.log(`Max retry attempts reached for subscription ${subscriptionId}`);
      return false;
    }

    if (latestFailure.nextRetryAt && latestFailure.nextRetryAt > new Date()) {
      console.log(`Too early to retry subscription ${subscriptionId}`);
      return false;
    }

    // Attempt to retry the invoice in Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    if (stripeSubscription.latest_invoice) {
      const invoice = await stripe.invoices.retrieve(
        stripeSubscription.latest_invoice as string
      );

      if (invoice.status === 'open') {
        // Attempt to pay the invoice
        const paidInvoice = await stripe.invoices.pay(invoice.id);
        
        if (paidInvoice.status === 'paid') {
          // Mark failure as resolved
          await prisma.paymentFailure.update({
            where: { id: latestFailure.id },
            data: { isResolved: true },
          });

          // Update subscription status
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'ACTIVE' },
          });

          console.log(`Successfully retried payment for subscription ${subscriptionId}`);
          return true;
        }
      }
    }

    // Update attempt count if retry failed
    await prisma.paymentFailure.update({
      where: { id: latestFailure.id },
      data: {
        attemptCount: latestFailure.attemptCount + 1,
        nextRetryAt: new Date(Date.now() + (24 * 60 * 60 * 1000)), // Retry in 24 hours
      },
    });

    return false;
  } catch (error) {
    console.error('Error retrying payment:', error);
    return false;
  }
}

/**
 * Get all subscriptions with failed payments that are eligible for retry
 */
export async function getRetryEligibleSubscriptions(): Promise<string[]> {
  try {
    const failures = await prisma.paymentFailure.findMany({
      where: {
        isResolved: false,
        attemptCount: { lt: 3 },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } },
        ],
      },
      select: {
        subscriptionId: true,
      },
    });

    return failures.map(f => f.subscriptionId);
  } catch (error) {
    console.error('Error getting retry eligible subscriptions:', error);
    return [];
  }
}

/**
 * Process all eligible payment retries
 */
export async function processPaymentRetries(): Promise<void> {
  try {
    const eligibleSubscriptions = await getRetryEligibleSubscriptions();
    
    console.log(`Processing ${eligibleSubscriptions.length} payment retries`);

    for (const subscriptionId of eligibleSubscriptions) {
      await retryFailedPayment(subscriptionId);
      // Add small delay between retries to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error processing payment retries:', error);
  }
}

/**
 * Cancel subscriptions with too many failed payment attempts
 */
export async function cancelFailedSubscriptions(): Promise<void> {
  try {
    const failedSubscriptions = await prisma.paymentFailure.findMany({
      where: {
        isResolved: false,
        attemptCount: { gte: 3 },
        createdAt: {
          lte: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)), // 7 days old
        },
      },
      include: {
        subscription: true,
      },
    });

    for (const failure of failedSubscriptions) {
      if (failure.subscription.status !== 'CANCELED') {
        try {
          // Cancel in Stripe
          await stripe.subscriptions.cancel(failure.subscription.stripeSubscriptionId);

          // Update local database
          await prisma.subscription.update({
            where: { id: failure.subscription.id },
            data: { status: 'CANCELED' },
          });

          // Mark failure as resolved
          await prisma.paymentFailure.update({
            where: { id: failure.id },
            data: { isResolved: true },
          });

          console.log(`Canceled subscription ${failure.subscription.id} due to repeated payment failures`);
        } catch (error) {
          console.error(`Error canceling subscription ${failure.subscription.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error canceling failed subscriptions:', error);
  }
}