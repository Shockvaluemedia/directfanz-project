/**
 * Payment Flow Monitoring
 * 
 * Comprehensive monitoring for Stripe payment events, subscription lifecycle,
 * and revenue analytics with business context
 */

import { businessMetrics } from './business-metrics';
import { logger } from './logger';
import { captureError, captureMessage } from './sentry';
import type Stripe from 'stripe';

export interface PaymentFlowContext {
  userId?: string;
  creatorId?: string;
  fanId?: string;
  subscriptionTier?: string;
  source?: 'web' | 'mobile' | 'api';
  userAgent?: string;
  ipAddress?: string;
}

export interface PaymentMetadata {
  creator_id?: string;
  fan_id?: string;
  tier_name?: string;
  content_access?: string;
  promo_code?: string;
  source?: string;
}

class PaymentMonitor {
  /**
   * Track payment intent creation
   */
  trackPaymentIntentCreated(
    paymentIntent: Stripe.PaymentIntent,
    context: PaymentFlowContext
  ): void {
    try {
      const metadata = paymentIntent.metadata as PaymentMetadata;
      
      businessMetrics.trackPayment({
        event: 'payment_intent_created',
        paymentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        paymentMethod: paymentIntent.payment_method_types[0] || 'unknown',
        userId: context.fanId,
        creatorId: metadata.creator_id || context.creatorId,
        fanId: context.fanId,
        properties: {
          status: paymentIntent.status,
          paymentType: 'subscription',
          source: context.source,
          tier: metadata.tier_name,
          promoCode: metadata.promo_code,
          clientSecret: paymentIntent.client_secret ? 'present' : 'missing',
          confirmationMethod: paymentIntent.confirmation_method,
        },
      });

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        creatorId: metadata.creator_id,
        fanId: context.fanId,
        tier: metadata.tier_name,
      });
    } catch (error) {
      logger.error('Failed to track payment intent creation', {
        paymentIntentId: paymentIntent.id,
      }, error as Error);
    }
  }

  /**
   * Track payment success
   */
  trackPaymentSuccess(
    paymentIntent: Stripe.PaymentIntent,
    context: PaymentFlowContext
  ): void {
    try {
      const metadata = paymentIntent.metadata as PaymentMetadata;
      
      businessMetrics.trackPayment({
        event: 'payment_succeeded',
        paymentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paymentMethod: paymentIntent.payment_method_types[0] || 'unknown',
        userId: context.fanId,
        creatorId: metadata.creator_id || context.creatorId,
        fanId: context.fanId,
        properties: {
          status: 'succeeded',
          paymentType: 'subscription',
          source: context.source,
          tier: metadata.tier_name,
          promoCode: metadata.promo_code,
          processingTime: this.calculateProcessingTime(paymentIntent),
          receiptUrl: undefined, // Would need to expand charges or fetch separately
        },
      });

      // Track conversion event
      businessMetrics.track({
        event: 'conversion_completed',
        userId: context.fanId,
        properties: {
          paymentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          creatorId: metadata.creator_id,
          tier: metadata.tier_name,
          source: context.source,
        },
        value: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      });

      logger.info('Payment succeeded', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        creatorId: metadata.creator_id,
        fanId: context.fanId,
      });
    } catch (error) {
      logger.error('Failed to track payment success', {
        paymentIntentId: paymentIntent.id,
      }, error as Error);
    }
  }

  /**
   * Track payment failure
   */
  trackPaymentFailure(
    paymentIntent: Stripe.PaymentIntent,
    context: PaymentFlowContext,
    error?: Stripe.StripeRawError
  ): void {
    try {
      const metadata = paymentIntent.metadata as PaymentMetadata;
      
      businessMetrics.trackPayment({
        event: 'payment_failed',
        paymentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paymentMethod: paymentIntent.payment_method_types[0] || 'unknown',
        userId: context.fanId,
        creatorId: metadata.creator_id || context.creatorId,
        fanId: context.fanId,
        properties: {
          status: 'failed',
          paymentType: 'subscription',
          source: context.source,
          tier: metadata.tier_name,
          failureReason: error?.code || paymentIntent.last_payment_error?.code || 'unknown',
          failureMessage: error?.message || paymentIntent.last_payment_error?.message,
          declineCode: paymentIntent.last_payment_error?.decline_code,
          paymentMethodId: paymentIntent.payment_method as string,
        },
      });

      // Alert on payment failure
      captureMessage('Payment failed', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        creatorId: metadata.creator_id,
        fanId: context.fanId,
        failureReason: error?.code || 'unknown',
        tier: metadata.tier_name,
      }, 'warning');

      logger.warn('Payment failed', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        failureReason: error?.code || 'unknown',
        creatorId: metadata.creator_id,
        fanId: context.fanId,
      });
    } catch (trackingError) {
      logger.error('Failed to track payment failure', {
        paymentIntentId: paymentIntent.id,
      }, trackingError as Error);
    }
  }

  /**
   * Track subscription creation
   */
  trackSubscriptionCreated(
    subscription: Stripe.Subscription,
    context: PaymentFlowContext
  ): void {
    try {
      const metadata = subscription.metadata as PaymentMetadata;
      const priceId = subscription.items.data[0]?.price.id;
      const amount = subscription.items.data[0]?.price.unit_amount || 0;
      
      businessMetrics.trackSubscription({
        event: 'subscription_created',
        subscriptionId: subscription.id,
        creatorId: metadata.creator_id || context.creatorId || '',
        fanId: metadata.fan_id || context.fanId || '',
        tierName: metadata.tier_name || context.subscriptionTier || '',
        amount: amount / 100,
        currency: subscription.currency.toUpperCase(),
        status: subscription.status as any,
        properties: {
          action: 'created',
          priceId,
          source: context.source,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          promoCode: metadata.promo_code,
          trialEnd: subscription.trial_end,
        },
      });

      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        creatorId: metadata.creator_id,
        fanId: metadata.fan_id,
        amount: amount / 100,
        tier: metadata.tier_name,
        status: subscription.status,
      });
    } catch (error) {
      logger.error('Failed to track subscription creation', {
        subscriptionId: subscription.id,
      }, error as Error);
    }
  }

  /**
   * Track subscription update
   */
  trackSubscriptionUpdated(
    subscription: Stripe.Subscription,
    previousAttributes: Partial<Stripe.Subscription>,
    context: PaymentFlowContext
  ): void {
    try {
      const metadata = subscription.metadata as PaymentMetadata;
      const amount = subscription.items.data[0]?.price.unit_amount || 0;
      
      // Determine what changed
      const changes = this.getSubscriptionChanges(subscription, previousAttributes);
      
      businessMetrics.trackSubscription({
        event: 'subscription_updated',
        subscriptionId: subscription.id,
        creatorId: metadata.creator_id || context.creatorId || '',
        fanId: metadata.fan_id || context.fanId || '',
        tierName: metadata.tier_name || context.subscriptionTier || '',
        amount: amount / 100,
        currency: subscription.currency.toUpperCase(),
        status: subscription.status as any,
        properties: {
          action: 'updated',
          changes,
          source: context.source,
          previousStatus: previousAttributes.status,
          newStatus: subscription.status,
        },
      });

      logger.info('Subscription updated', {
        subscriptionId: subscription.id,
        changes,
        creatorId: metadata.creator_id,
        fanId: metadata.fan_id,
      });
    } catch (error) {
      logger.error('Failed to track subscription update', {
        subscriptionId: subscription.id,
      }, error as Error);
    }
  }

  /**
   * Track subscription cancellation
   */
  trackSubscriptionCancelled(
    subscription: Stripe.Subscription,
    context: PaymentFlowContext,
    reason?: string
  ): void {
    try {
      const metadata = subscription.metadata as PaymentMetadata;
      const amount = subscription.items.data[0]?.price.unit_amount || 0;
      
      businessMetrics.trackSubscription({
        event: 'subscription_cancelled',
        subscriptionId: subscription.id,
        creatorId: metadata.creator_id || context.creatorId || '',
        fanId: metadata.fan_id || context.fanId || '',
        tierName: metadata.tier_name || context.subscriptionTier || '',
        amount: amount / 100,
        currency: subscription.currency.toUpperCase(),
        status: subscription.status as any,
        properties: {
          action: 'cancelled',
          reason: reason || 'user_requested',
          source: context.source,
          cancelAt: subscription.cancel_at,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at,
        },
      });

      // Track churn event
      businessMetrics.track({
        event: 'churn_event',
        userId: context.fanId,
        properties: {
          subscriptionId: subscription.id,
          creatorId: metadata.creator_id,
          tier: metadata.tier_name,
          reason,
          subscriptionLength: this.calculateSubscriptionLength(subscription),
          totalRevenue: this.calculateTotalRevenue(subscription),
        },
      });

      logger.info('Subscription cancelled', {
        subscriptionId: subscription.id,
        reason,
        creatorId: metadata.creator_id,
        fanId: metadata.fan_id,
        tier: metadata.tier_name,
      });
    } catch (error) {
      logger.error('Failed to track subscription cancellation', {
        subscriptionId: subscription.id,
      }, error as Error);
    }
  }

  /**
   * Track invoice payment success
   */
  trackInvoicePaid(
    invoice: Stripe.Invoice,
    context: PaymentFlowContext
  ): void {
    try {
      const metadata = invoice.metadata as PaymentMetadata;
      
      businessMetrics.trackPayment({
        event: 'invoice_paid',
        paymentId: invoice.payment_intent as string || invoice.id,
        amount: (invoice.amount_paid || 0) / 100,
        currency: invoice.currency?.toUpperCase() || 'USD',
        paymentMethod: 'subscription',
        userId: context.fanId,
        creatorId: metadata.creator_id || context.creatorId,
        fanId: context.fanId,
        subscriptionId: invoice.subscription as string,
        properties: {
          status: 'paid',
          paymentType: 'subscription_renewal',
          invoiceNumber: invoice.number,
          source: context.source,
          attemptCount: invoice.attempt_count,
          billingReason: invoice.billing_reason,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end,
        },
      });

      logger.info('Invoice paid', {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        amount: (invoice.amount_paid || 0) / 100,
        currency: invoice.currency,
        creatorId: metadata.creator_id,
        fanId: context.fanId,
      });
    } catch (error) {
      logger.error('Failed to track invoice payment', {
        invoiceId: invoice.id,
      }, error as Error);
    }
  }

  /**
   * Track invoice payment failure
   */
  trackInvoicePaymentFailed(
    invoice: Stripe.Invoice,
    context: PaymentFlowContext
  ): void {
    try {
      const metadata = invoice.metadata as PaymentMetadata;
      
      businessMetrics.trackPayment({
        event: 'invoice_payment_failed',
        paymentId: invoice.payment_intent as string || invoice.id,
        amount: (invoice.amount_due || 0) / 100,
        currency: invoice.currency?.toUpperCase() || 'USD',
        paymentMethod: 'subscription',
        userId: context.fanId,
        creatorId: metadata.creator_id || context.creatorId,
        fanId: context.fanId,
        subscriptionId: invoice.subscription as string,
        properties: {
          status: 'failed',
          paymentType: 'subscription_renewal',
          invoiceNumber: invoice.number,
          source: context.source,
          attemptCount: invoice.attempt_count,
          billingReason: invoice.billing_reason,
          nextPaymentAttempt: invoice.next_payment_attempt,
          failureReason: 'payment_failed',
        },
      });

      // Alert on recurring payment failure
      captureMessage('Recurring payment failed', {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        amount: (invoice.amount_due || 0) / 100,
        currency: invoice.currency,
        creatorId: metadata.creator_id,
        fanId: context.fanId,
        attemptCount: invoice.attempt_count,
      }, 'warning');

      logger.warn('Invoice payment failed', {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        amount: (invoice.amount_due || 0) / 100,
        attemptCount: invoice.attempt_count,
        creatorId: metadata.creator_id,
        fanId: context.fanId,
      });
    } catch (error) {
      logger.error('Failed to track invoice payment failure', {
        invoiceId: invoice.id,
      }, error as Error);
    }
  }

  /**
   * Track dispute/chargeback
   */
  trackDispute(
    dispute: Stripe.Dispute,
    context: PaymentFlowContext
  ): void {
    try {
      const charge = dispute.charge as Stripe.Charge;
      const metadata = charge?.metadata as PaymentMetadata;
      
      businessMetrics.trackPayment({
        event: 'payment_disputed',
        paymentId: charge?.payment_intent as string || dispute.id,
        amount: dispute.amount / 100,
        currency: dispute.currency.toUpperCase(),
        paymentMethod: charge?.payment_method_details?.type || 'unknown',
        userId: context.fanId,
        creatorId: metadata?.creator_id || context.creatorId,
        fanId: context.fanId,
        properties: {
          status: 'disputed',
          disputeReason: dispute.reason,
          disputeStatus: dispute.status,
          evidenceDueBy: dispute.evidence_details?.due_by,
          isChargeable: dispute.is_charge_refundable,
          source: context.source,
        },
      });

      // Critical alert for disputes
      captureMessage('Payment disputed', {
        disputeId: dispute.id,
        chargeId: dispute.charge,
        amount: dispute.amount / 100,
        currency: dispute.currency,
        reason: dispute.reason,
        creatorId: metadata?.creator_id,
        fanId: context.fanId,
      }, 'error');

      logger.error('Payment disputed', {
        disputeId: dispute.id,
        chargeId: dispute.charge,
        amount: dispute.amount / 100,
        reason: dispute.reason,
        creatorId: metadata?.creator_id,
        fanId: context.fanId,
      });
    } catch (error) {
      logger.error('Failed to track dispute', {
        disputeId: dispute.id,
      }, error as Error);
    }
  }

  /**
   * Calculate processing time for payment
   */
  private calculateProcessingTime(paymentIntent: Stripe.PaymentIntent): number | undefined {
    if (!paymentIntent.created) return undefined;
    
    const createdTime = paymentIntent.created * 1000; // Convert to milliseconds
    const now = Date.now();
    return now - createdTime;
  }

  /**
   * Get subscription changes
   */
  private getSubscriptionChanges(
    current: Stripe.Subscription,
    previous: Partial<Stripe.Subscription>
  ): string[] {
    const changes: string[] = [];
    
    if (current.status !== previous.status) {
      changes.push(`status: ${previous.status} -> ${current.status}`);
    }
    
    // Check for price changes
    const currentPrice = current.items.data[0]?.price.id;
    const previousPrice = previous.items?.data?.[0]?.price.id;
    if (currentPrice !== previousPrice) {
      changes.push(`price: ${previousPrice} -> ${currentPrice}`);
    }
    
    if (current.cancel_at_period_end !== previous.cancel_at_period_end) {
      changes.push(`cancel_at_period_end: ${previous.cancel_at_period_end} -> ${current.cancel_at_period_end}`);
    }
    
    return changes;
  }

  /**
   * Calculate subscription length in days
   */
  private calculateSubscriptionLength(subscription: Stripe.Subscription): number {
    if (!subscription.created || !subscription.canceled_at) return 0;
    
    const startTime = subscription.created * 1000;
    const endTime = subscription.canceled_at * 1000;
    return Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate total revenue from subscription
   */
  private calculateTotalRevenue(subscription: Stripe.Subscription): number {
    // This is a simplified calculation - in practice, you'd want to
    // query your database for actual invoice amounts
    const price = subscription.items.data[0]?.price.unit_amount || 0;
    const length = this.calculateSubscriptionLength(subscription);
    const billingCycle = subscription.items.data[0]?.price.recurring?.interval === 'month' ? 30 : 365;
    
    return (price / 100) * Math.floor(length / billingCycle);
  }
}

// Export singleton instance
export const paymentMonitor = new PaymentMonitor();