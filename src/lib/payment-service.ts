import Stripe from 'stripe';
import { logger } from './logger';
import { emailService } from './email-service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export interface PaymentConfig {
  stripeSecretKey: string;
  stripePublishableKey: string;
  webhookSecret: string;
  currency: string;
  applicationFee: number; // Percentage (e.g., 10 for 10%)
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId?: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  clientSecret: string;
  metadata?: Record<string, string>;
}

const paymentConfig: PaymentConfig = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  currency: process.env.CURRENCY || 'usd',
  applicationFee: parseFloat(process.env.APPLICATION_FEE_PERCENTAGE || '10'),
};

class PaymentService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor() {
    this.stripe = stripe;
    this.webhookSecret = paymentConfig.webhookSecret;
  }

  // Create a payment intent for one-time payments
  async createPaymentIntent(
    amount: number,
    currency: string = paymentConfig.currency,
    metadata?: Record<string, string>
  ): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
      });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret!,
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      logger.error(
        'Failed to create payment intent',
        { amount, currency, metadata },
        error as Error
      );
      throw new Error(`Payment intent creation failed: ${(error as Error).message}`);
    }
  }

  // Create a subscription for recurring payments
  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: metadata || {},
      });

      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        customerId,
        priceId,
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create subscription', { customerId, priceId }, error as Error);
      throw new Error(`Subscription creation failed: ${(error as Error).message}`);
    }
  }

  // Create or retrieve a customer
  async createOrUpdateCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer> {
    try {
      // Check if customer already exists
      const existingCustomers = await this.stripe.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        const customer = existingCustomers.data[0];

        // Update customer if needed
        if (name || metadata) {
          const updatedCustomer = await this.stripe.customers.update(customer.id, {
            name: name || customer.name,
            metadata: { ...customer.metadata, ...metadata },
          });
          return updatedCustomer;
        }

        return customer;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: metadata || {},
      });

      logger.info('Customer created', {
        customerId: customer.id,
        email,
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create or update customer', { email, name }, error as Error);
      throw new Error(`Customer operation failed: ${(error as Error).message}`);
    }
  }

  // Cancel a subscription
  async cancelSubscription(
    subscriptionId: string,
    immediately = false
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !immediately,
      });

      if (immediately) {
        await this.stripe.subscriptions.cancel(subscriptionId);
      }

      logger.info('Subscription cancelled', {
        subscriptionId,
        immediately,
      });

      return subscription;
    } catch (error) {
      logger.error(
        'Failed to cancel subscription',
        { subscriptionId, immediately },
        error as Error
      );
      throw new Error(`Subscription cancellation failed: ${(error as Error).message}`);
    }
  }

  // Update subscription
  async updateSubscription(
    subscriptionId: string,
    updates: { priceId?: string; metadata?: Record<string, string> }
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const updateData: Stripe.SubscriptionUpdateParams = {};

      if (updates.priceId) {
        updateData.items = [
          {
            id: subscription.items.data[0].id,
            price: updates.priceId,
          },
        ];
      }

      if (updates.metadata) {
        updateData.metadata = updates.metadata;
      }

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscriptionId,
        updateData
      );

      logger.info('Subscription updated', {
        subscriptionId,
        updates,
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to update subscription', { subscriptionId, updates }, error as Error);
      throw new Error(`Subscription update failed: ${(error as Error).message}`);
    }
  }

  // Process webhook events
  async processWebhook(
    body: string,
    signature: string
  ): Promise<{ processed: boolean; eventType?: string }> {
    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);

      logger.info('Webhook received', {
        eventType: event.type,
        eventId: event.id,
      });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSuccess(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailure(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        default:
          logger.info('Unhandled webhook event type', { eventType: event.type });
      }

      return { processed: true, eventType: event.type };
    } catch (error) {
      logger.error('Webhook processing failed', { signature }, error as Error);
      return { processed: false };
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('Failed to retrieve subscription', { subscriptionId }, error as Error);
      return null;
    }
  }

  // Get customer subscriptions
  async getCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
      });
      return subscriptions.data;
    } catch (error) {
      logger.error('Failed to retrieve customer subscriptions', { customerId }, error as Error);
      return [];
    }
  }

  // Create setup intent for saving payment methods
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      logger.info('Setup intent created', {
        setupIntentId: setupIntent.id,
        customerId,
      });

      return setupIntent;
    } catch (error) {
      logger.error('Failed to create setup intent', { customerId }, error as Error);
      throw new Error(`Setup intent creation failed: ${(error as Error).message}`);
    }
  }

  // Calculate platform fee
  calculatePlatformFee(amount: number): number {
    return Math.round((amount * paymentConfig.applicationFee) / 100);
  }

  // Process artist payout
  async processArtistPayout(
    artistStripeAccountId: string,
    amount: number,
    currency: string = paymentConfig.currency
  ): Promise<Stripe.Transfer> {
    try {
      const platformFee = this.calculatePlatformFee(amount);
      const payoutAmount = amount - platformFee;

      const transfer = await this.stripe.transfers.create({
        amount: Math.round(payoutAmount * 100), // Convert to cents
        currency,
        destination: artistStripeAccountId,
      });

      logger.info('Artist payout processed', {
        transferId: transfer.id,
        artistAccountId: artistStripeAccountId,
        amount: payoutAmount,
        platformFee,
      });

      return transfer;
    } catch (error) {
      logger.error(
        'Failed to process artist payout',
        {
          artistStripeAccountId,
          amount,
        },
        error as Error
      );
      throw new Error(`Artist payout failed: ${(error as Error).message}`);
    }
  }

  // Webhook event handlers
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info('Payment succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
    });

    // TODO: Update database with successful payment
    // TODO: Send confirmation email
    // TODO: Grant access to purchased content
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.error('Payment failed', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      lastPaymentError: paymentIntent.last_payment_error,
    });

    // TODO: Update database with failed payment
    // TODO: Send failure notification email
    // TODO: Implement retry logic
  }

  private async handleInvoicePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Invoice payment succeeded', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_paid / 100,
    });

    // TODO: Update subscription status in database
    // TODO: Send subscription confirmation email
    // TODO: Grant/extend access
  }

  private async handleInvoicePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
    logger.error('Invoice payment failed', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_due / 100,
    });

    try {
      const customer = await this.stripe.customers.retrieve(invoice.customer as string);

      if (customer && !customer.deleted && customer.email) {
        await emailService.sendEmail({
          to: customer.email,
          template: 'paymentFailed',
          variables: {
            name: customer.name || 'Customer',
            amount: invoice.amount_due / 100,
            artistName: invoice.metadata?.artistName || 'Artist',
            retryUrl: `${process.env.NEXTAUTH_URL}/billing/retry?invoice=${invoice.id}`,
          },
        });
      }
    } catch (error) {
      logger.error(
        'Failed to send payment failure email',
        { invoiceId: invoice.id },
        error as Error
      );
    }

    // TODO: Update subscription status
    // TODO: Implement grace period logic
    // TODO: Schedule retry attempts
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription created', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
    });

    // TODO: Update database with new subscription
    // TODO: Send welcome email
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription updated', {
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    // TODO: Update database with subscription changes
    // TODO: Handle status changes (active, past_due, canceled, etc.)
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription deleted', {
      subscriptionId: subscription.id,
    });

    // TODO: Update database - mark subscription as cancelled
    // TODO: Revoke access
    // TODO: Send cancellation confirmation email
  }
}

// Subscription lifecycle management
export class SubscriptionManager {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  // Check subscription status
  async checkSubscriptionStatus(subscriptionId: string): Promise<{
    isActive: boolean;
    status: string;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
  }> {
    try {
      const subscription = await this.paymentService.getSubscription(subscriptionId);

      if (!subscription) {
        return { isActive: false, status: 'not_found' };
      }

      const isActive = ['active', 'trialing'].includes(subscription.status);

      return {
        isActive,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    } catch (error) {
      logger.error('Failed to check subscription status', { subscriptionId }, error as Error);
      return { isActive: false, status: 'error' };
    }
  }

  // Handle subscription renewals
  async processRenewal(subscriptionId: string): Promise<boolean> {
    try {
      const subscription = await this.paymentService.getSubscription(subscriptionId);

      if (!subscription) {
        return false;
      }

      // Check if subscription is active and due for renewal
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      const now = new Date();

      if (currentPeriodEnd <= now && subscription.status === 'active') {
        // Renewal will be handled automatically by Stripe
        // We just need to update our records
        logger.info('Subscription renewed', {
          subscriptionId,
          newPeriodEnd: currentPeriodEnd,
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to process renewal', { subscriptionId }, error as Error);
      return false;
    }
  }

  // Grace period handling
  async handleGracePeriod(subscriptionId: string, graceDays: number = 3): Promise<boolean> {
    try {
      const subscription = await this.paymentService.getSubscription(subscriptionId);

      if (!subscription || subscription.status !== 'past_due') {
        return false;
      }

      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      const gracePeriodEnd = new Date(currentPeriodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now <= gracePeriodEnd) {
        // Still within grace period
        logger.info('Subscription in grace period', {
          subscriptionId,
          gracePeriodEnd,
        });
        return true;
      }

      // Grace period expired, cancel subscription
      await this.paymentService.cancelSubscription(subscriptionId, true);

      logger.info('Subscription cancelled due to expired grace period', {
        subscriptionId,
      });

      return false;
    } catch (error) {
      logger.error('Failed to handle grace period', { subscriptionId }, error as Error);
      return false;
    }
  }
}

// Singleton instances
export const paymentService = new PaymentService();
export const subscriptionManager = new SubscriptionManager();

export default paymentService;
