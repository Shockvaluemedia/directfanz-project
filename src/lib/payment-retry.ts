import { prisma } from './prisma';
import { stripe } from './stripe';
import { sendEmail } from './notifications';
import { logger } from './logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface RetryResult {
  success: boolean;
  resolved: boolean;
  nextRetryAt?: Date;
  attemptCount: number;
}

/**
 * Create a payment failure record
 */
export async function createPaymentFailure(
  subscriptionId: string,
  stripeInvoiceId: string,
  amount: number,
  failureReason: string
): Promise<any> {
  try {
    // Check if there's already a payment failure record for this invoice
    const existingFailure = await prisma.paymentFailure.findUnique({
      where: { stripeInvoiceId },
    });

    if (existingFailure) {
      // Update existing record
      const updatedFailure = await prisma.paymentFailure.update({
        where: { id: existingFailure.id },
        data: {
          attemptCount: { increment: 1 },
          failureReason,
          nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        },
      });

      return updatedFailure;
    } else {
      // Create new record
      const newFailure = await prisma.paymentFailure.create({
        data: {
          subscriptionId,
          stripeInvoiceId,
          amount: new Decimal(amount),
          failureReason,
          nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Update subscription status
      await prisma.subscriptions.update({
        where: { id: subscriptionId },
        data: { status: 'PAST_DUE' },
      });

      return newFailure;
    }
  } catch (error) {
    logger.error('Error creating payment failure record:', { subscriptionId }, error as Error);
    throw new Error('Failed to create payment failure record');
  }
}

/**
 * Retry a failed payment
 */
export async function retryPayment(paymentFailureId: string): Promise<RetryResult> {
  try {
    // Get payment failure record
    const failure = await prisma.paymentFailure.findUnique({
      where: { id: paymentFailureId },
      include: {
        subscription: {
          include: {
            fan: true,
            tier: {
              include: {
                artist: true,
              },
            },
          },
        },
      },
    });

    if (!failure) {
      throw new Error('Payment failure record not found');
    }

    if (failure.isResolved) {
      return {
        success: true,
        resolved: true,
        attemptCount: failure.attemptCount,
      };
    }

    // Get the invoice from Stripe
    const invoice = await stripe.invoices.retrieve(failure.stripeInvoiceId);

    if (invoice.status === 'paid') {
      // Payment was already successful, mark as resolved
      await prisma.paymentFailure.update({
        where: { id: paymentFailureId },
        data: {
          isResolved: true,
          updatedAt: new Date(),
        },
      });

      // Update subscription status
      await prisma.subscriptions.update({
        where: { id: failure.subscriptionId },
        data: { status: 'ACTIVE' },
      });

      return {
        success: true,
        resolved: true,
        attemptCount: failure.attemptCount,
      };
    }

    // Try to pay the invoice
    try {
      await stripe.invoices.pay(failure.stripeInvoiceId);

      // Payment successful, mark as resolved
      await prisma.paymentFailure.update({
        where: { id: paymentFailureId },
        data: {
          isResolved: true,
          updatedAt: new Date(),
        },
      });

      // Update subscription status
      await prisma.subscriptions.update({
        where: { id: failure.subscriptionId },
        data: { status: 'ACTIVE' },
      });

      // Send success notification
      if (failure.subscription.users.email) {
        const prefs = failure.subscription.users.notificationPreferences as any;
        if (!prefs || prefs?.billing !== false) {
          await sendEmail({
            to: failure.subscription.users.email,
            subject: `Payment Successful - ${failure.subscription.tiers.artist?.displayName}`,
            html: `
              <h1>Payment Successful</h1>
              <p>Your payment for ${failure.subscription.tiers.artist?.displayName}'s ${failure.subscription.tiers.name} tier has been processed successfully.</p>
              <p>Amount: $${parseFloat(failure.amount.toString()).toFixed(2)}</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions">Manage your subscriptions</a></p>
            `,
            text: `Payment Successful\n\nYour payment for ${failure.subscription.tiers.artist?.displayName}'s ${failure.subscription.tiers.name} tier has been processed successfully.\n\nAmount: $${parseFloat(failure.amount.toString()).toFixed(2)}\n\nManage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fan/subscriptions`,
          });
        }
      }

      return {
        success: true,
        resolved: true,
        attemptCount: failure.attemptCount + 1,
      };
    } catch (error) {
      // Payment failed again
      const attemptCount = failure.attemptCount + 1;
      const nextRetryAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Check if we've reached max attempts
      if (attemptCount >= 3) {
        // Cancel subscription
        await stripe.subscriptions.cancel(failure.subscription.stripeSubscriptionId);

        await prisma.subscriptions.update({
          where: { id: failure.subscriptionId },
          data: { status: 'CANCELED' },
        });

        await prisma.paymentFailure.update({
          where: { id: paymentFailureId },
          data: {
            attemptCount,
            isResolved: true, // Mark as resolved since we're canceling
            updatedAt: new Date(),
          },
        });

        // Send cancellation notification
        if (failure.subscription.users.email) {
          const prefs = failure.subscription.users.notificationPreferences as any;
          if (!prefs || prefs?.billing !== false) {
            await sendEmail({
              to: failure.subscription.users.email,
              subject: `Subscription Canceled - Payment Failed`,
              html: `
                <h1>Subscription Canceled</h1>
                <p>Your subscription to ${failure.subscription.tiers.artist?.displayName}'s ${failure.subscription.tiers.name} tier has been canceled due to repeated payment failures.</p>
                <p>You can resubscribe at any time by visiting the artist's page.</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/artist/${failure.subscription.tiers.artistId}">Visit ${failure.subscription.tiers.artist?.displayName}'s page</a></p>
              `,
              text: `Subscription Canceled\n\nYour subscription to ${failure.subscription.tiers.artist?.displayName}'s ${failure.subscription.tiers.name} tier has been canceled due to repeated payment failures.\n\nYou can resubscribe at any time by visiting the artist's page.\n\nVisit ${failure.subscription.tiers.artist?.displayName}'s page: ${process.env.NEXT_PUBLIC_APP_URL}/artist/${failure.subscription.tiers.artistId}`,
            });
          }
        }

        return {
          success: false,
          resolved: true, // Resolved by cancellation
          attemptCount,
        };
      } else {
        // Update retry information
        await prisma.paymentFailure.update({
          where: { id: paymentFailureId },
          data: {
            attemptCount,
            nextRetryAt,
            updatedAt: new Date(),
          },
        });

        return {
          success: false,
          resolved: false,
          nextRetryAt,
          attemptCount,
        };
      }
    }
  } catch (error) {
    logger.error(
      `Error retrying payment ${paymentFailureId}:`,
      { paymentFailureId },
      error as Error
    );
    // Re-throw the original error message if it's a known error
    if (error instanceof Error && error.message === 'Payment failure record not found') {
      throw error;
    }
    throw new Error('Failed to retry payment');
  }
}

/**
 * Get payment failures for a subscription
 */
export async function getPaymentFailures(subscriptionId: string): Promise<any[]> {
  try {
    const failures = await prisma.paymentFailure.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
    });

    return failures;
  } catch (error) {
    logger.error(
      `Error getting payment failures for subscription ${subscriptionId}:`,
      { subscriptionId },
      error as Error
    );
    throw new Error('Failed to get payment failures');
  }
}

/**
 * Get active payment failures for an artist
 */
export async function getArtistPaymentFailures(artistId: string): Promise<any[]> {
  try {
    const failures = await prisma.paymentFailure.findMany({
      where: {
        isResolved: false,
        subscription: {
          artistId,
        },
      },
      include: {
        subscription: {
          include: {
            fan: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
            tier: true,
          },
        },
      },
      orderBy: { nextRetryAt: 'asc' },
    });

    return failures;
  } catch (error) {
    logger.error(
      `Error getting payment failures for artist ${artistId}:`,
      { artistId },
      error as Error
    );
    throw new Error('Failed to get artist payment failures');
  }
}
