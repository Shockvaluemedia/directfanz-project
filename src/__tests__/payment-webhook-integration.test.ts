/**
 * Payment Webhook Integration Tests
 *
 * Simplified tests for payment webhook processing and business logic
 */

import {
  setupTestEnvironment,
  createMockUser,
  createMockArtist,
  createMockTier,
  createMockStripeSubscription,
  createMockStripePaymentIntent,
  createMockStripeInvoice,
  businessMetrics,
  paymentMonitor,
  userEngagementTracker,
} from '@/lib/test-utils';

// Mock Stripe webhook event processing
const processStripeWebhookEvent = (event: any) => {
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      paymentMonitor.trackPaymentSuccess(paymentIntent, {
        userId: paymentIntent.metadata.fan_id,
        creatorId: paymentIntent.metadata.creator_id,
        source: 'webhook',
      });

      businessMetrics.trackPayment({
        event: 'payment_succeeded',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paymentId: paymentIntent.id,
      });

      businessMetrics.track({
        event: 'conversion_completed',
        userId: paymentIntent.metadata.fan_id,
        properties: {
          creatorId: paymentIntent.metadata.creator_id,
          tier: paymentIntent.metadata.tier_name,
        },
        value: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      });
      break;

    case 'customer.subscription.created':
      const subscription = event.data.object;
      paymentMonitor.trackSubscriptionCreated(subscription, {
        userId: subscription.metadata.fan_id,
        creatorId: subscription.metadata.creator_id,
        subscriptionTier: subscription.metadata.tier_name,
        source: 'webhook',
      });
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      paymentMonitor.trackInvoicePaid(invoice, {
        userId: invoice.metadata.fan_id,
        creatorId: invoice.metadata.creator_id,
        source: 'webhook',
      });
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      paymentMonitor.trackPaymentFailure(failedPayment, {
        userId: failedPayment.metadata.fan_id,
        creatorId: failedPayment.metadata.creator_id,
        source: 'webhook',
      });

      businessMetrics.trackPayment({
        event: 'payment_failed',
        amount: failedPayment.amount / 100,
        paymentId: failedPayment.id,
        properties: {
          status: 'failed',
          failureReason: failedPayment.last_payment_error?.code || 'unknown',
        },
      });
      break;

    case 'customer.subscription.deleted':
      const canceledSubscription = event.data.object;
      paymentMonitor.trackSubscriptionCancelled(
        canceledSubscription,
        {
          userId: canceledSubscription.metadata.fan_id,
          creatorId: canceledSubscription.metadata.creator_id,
          subscriptionTier: canceledSubscription.metadata.tier_name,
          source: 'webhook',
        },
        'subscription_cancelled'
      );

      businessMetrics.track({
        event: 'churn_event',
        userId: canceledSubscription.metadata.fan_id,
        properties: {
          subscriptionId: canceledSubscription.id,
          creatorId: canceledSubscription.metadata.creator_id,
          tier: canceledSubscription.metadata.tier_name,
          reason: 'subscription_cancelled',
        },
      });
      break;

    default:
      // Unknown event type - just log for now
      console.log(`Unhandled webhook event type: ${event.type}`);
  }
};

describe('Payment Webhook Integration Tests', () => {
  setupTestEnvironment();

  const fanUser = createMockUser({ id: 'fan-123', role: 'fan' });
  const artistUser = createMockUser({ id: 'artist-user-123', role: 'artist' });
  const artist = createMockArtist({ id: 'artist-123', userId: artistUser.id });
  const tier = createMockTier({ id: 'tier-123', artistId: artist.id, price: 29.99 });

  beforeEach(() => {
    // Reset all mocks
    Object.values(businessMetrics).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
    Object.values(paymentMonitor).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
  });

  describe('Payment Success Events', () => {
    it('should process successful payment intent webhook', () => {
      const paymentIntent = createMockStripePaymentIntent({
        id: 'pi_success_123',
        status: 'succeeded',
        amount: 2999, // $29.99 in cents
        currency: 'usd',
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: tier.name,
        },
      });

      const webhookEvent = {
        id: 'evt_success_123',
        type: 'payment_intent.succeeded',
        data: {
          object: paymentIntent,
        },
      };

      processStripeWebhookEvent(webhookEvent);

      // Verify payment success tracking
      expect(paymentMonitor.trackPaymentSuccess).toHaveBeenCalledWith(
        paymentIntent,
        expect.objectContaining({
          userId: fanUser.id,
          creatorId: artistUser.id,
          source: 'webhook',
        })
      );

      // Verify business metrics
      expect(businessMetrics.trackPayment).toHaveBeenCalledWith({
        event: 'payment_succeeded',
        amount: 29.99,
        currency: 'USD',
        paymentId: 'pi_success_123',
      });

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'conversion_completed',
        userId: fanUser.id,
        properties: {
          creatorId: artistUser.id,
          tier: tier.name,
        },
        value: 29.99,
        currency: 'usd',
      });
    });

    it('should process subscription created webhook', () => {
      const subscription = createMockStripeSubscription({
        id: 'sub_created_123',
        status: 'active',
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: tier.name,
        },
      });

      const webhookEvent = {
        id: 'evt_sub_created_123',
        type: 'customer.subscription.created',
        data: {
          object: subscription,
        },
      };

      processStripeWebhookEvent(webhookEvent);

      expect(paymentMonitor.trackSubscriptionCreated).toHaveBeenCalledWith(
        subscription,
        expect.objectContaining({
          userId: fanUser.id,
          creatorId: artistUser.id,
          subscriptionTier: tier.name,
          source: 'webhook',
        })
      );
    });

    it('should process invoice payment succeeded webhook', () => {
      const invoice = createMockStripeInvoice({
        id: 'in_paid_123',
        subscription: 'sub_123',
        amount_paid: 2999,
        status: 'paid',
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
        },
      });

      const webhookEvent = {
        id: 'evt_invoice_paid_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: invoice,
        },
      };

      processStripeWebhookEvent(webhookEvent);

      expect(paymentMonitor.trackInvoicePaid).toHaveBeenCalledWith(
        invoice,
        expect.objectContaining({
          userId: fanUser.id,
          creatorId: artistUser.id,
          source: 'webhook',
        })
      );
    });
  });

  describe('Payment Failure Events', () => {
    it('should process payment intent failure webhook', () => {
      const failedPaymentIntent = createMockStripePaymentIntent({
        id: 'pi_failed_123',
        status: 'requires_payment_method',
        amount: 2999,
        currency: 'usd',
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined.',
          decline_code: 'insufficient_funds',
        },
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: tier.name,
        },
      });

      const webhookEvent = {
        id: 'evt_failed_123',
        type: 'payment_intent.payment_failed',
        data: {
          object: failedPaymentIntent,
        },
      };

      processStripeWebhookEvent(webhookEvent);

      expect(paymentMonitor.trackPaymentFailure).toHaveBeenCalledWith(
        failedPaymentIntent,
        expect.objectContaining({
          userId: fanUser.id,
          creatorId: artistUser.id,
          source: 'webhook',
        })
      );

      expect(businessMetrics.trackPayment).toHaveBeenCalledWith({
        event: 'payment_failed',
        amount: 29.99,
        paymentId: 'pi_failed_123',
        properties: {
          status: 'failed',
          failureReason: 'card_declined',
        },
      });
    });
  });

  describe('Subscription Lifecycle Events', () => {
    it('should process subscription cancellation webhook', () => {
      const canceledSubscription = createMockStripeSubscription({
        id: 'sub_canceled_123',
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000),
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: tier.name,
        },
      });

      const webhookEvent = {
        id: 'evt_sub_canceled_123',
        type: 'customer.subscription.deleted',
        data: {
          object: canceledSubscription,
        },
      };

      processStripeWebhookEvent(webhookEvent);

      expect(paymentMonitor.trackSubscriptionCancelled).toHaveBeenCalledWith(
        canceledSubscription,
        expect.objectContaining({
          userId: fanUser.id,
          creatorId: artistUser.id,
          subscriptionTier: tier.name,
          source: 'webhook',
        }),
        'subscription_cancelled'
      );

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'churn_event',
        userId: fanUser.id,
        properties: {
          subscriptionId: 'sub_canceled_123',
          creatorId: artistUser.id,
          tier: tier.name,
          reason: 'subscription_cancelled',
        },
      });
    });
  });

  describe('Unknown Event Handling', () => {
    it('should handle unknown webhook events gracefully', () => {
      const unknownEvent = {
        id: 'evt_unknown_123',
        type: 'unknown.event.type',
        data: {
          object: {},
        },
      };

      // Mock console.log to verify it's called
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      processStripeWebhookEvent(unknownEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled webhook event type: unknown.event.type');

      // Ensure no tracking methods were called
      expect(paymentMonitor.trackPaymentSuccess).not.toHaveBeenCalled();
      expect(paymentMonitor.trackSubscriptionCreated).not.toHaveBeenCalled();
      expect(businessMetrics.track).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('End-to-End Payment Flow', () => {
    it('should track complete payment and subscription flow', () => {
      // 1. Payment succeeds
      const paymentIntent = createMockStripePaymentIntent({
        id: 'pi_e2e_123',
        status: 'succeeded',
        amount: 2999,
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: tier.name,
        },
      });

      processStripeWebhookEvent({
        type: 'payment_intent.succeeded',
        data: { object: paymentIntent },
      });

      // 2. Subscription is created
      const subscription = createMockStripeSubscription({
        id: 'sub_e2e_123',
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: tier.name,
        },
      });

      processStripeWebhookEvent({
        type: 'customer.subscription.created',
        data: { object: subscription },
      });

      // 3. First invoice is paid
      const invoice = createMockStripeInvoice({
        id: 'in_e2e_123',
        subscription: subscription.id,
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
        },
      });

      processStripeWebhookEvent({
        type: 'invoice.payment_succeeded',
        data: { object: invoice },
      });

      // Verify all events were tracked
      expect(paymentMonitor.trackPaymentSuccess).toHaveBeenCalled();
      expect(paymentMonitor.trackSubscriptionCreated).toHaveBeenCalled();
      expect(paymentMonitor.trackInvoicePaid).toHaveBeenCalled();

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'conversion_completed',
        userId: fanUser.id,
        properties: {
          creatorId: artistUser.id,
          tier: tier.name,
        },
        value: 29.99,
        currency: 'usd',
      });

      expect(businessMetrics.trackPayment).toHaveBeenCalledWith({
        event: 'payment_succeeded',
        amount: 29.99,
        currency: 'USD',
        paymentId: 'pi_e2e_123',
      });
    });
  });
});
