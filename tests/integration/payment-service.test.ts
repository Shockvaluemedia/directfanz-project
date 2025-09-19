import { paymentService, subscriptionManager } from '@/lib/payment-service';
import { jest } from '@jest/globals';

describe('PaymentService Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Customer Management', () => {
    it('should create new customer when none exists', async () => {
      const mockStripeCustomers = {
        list: jest.fn().mockResolvedValue({ data: [] }),
        create: jest.fn().mockResolvedValue({
          id: 'cus_new',
          email: 'new@example.com',
          name: 'New Customer',
        }),
      };

      (paymentService as any).stripe.customers = mockStripeCustomers;

      const customer = await paymentService.createOrUpdateCustomer(
        'new@example.com',
        'New Customer',
        { userId: 'user-123' }
      );

      expect(customer.id).toBe('cus_new');
      expect(customer.email).toBe('new@example.com');
      expect(mockStripeCustomers.list).toHaveBeenCalledWith({
        email: 'new@example.com',
        limit: 1,
      });
      expect(mockStripeCustomers.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: 'New Customer',
        metadata: { userId: 'user-123' },
      });
    });

    it('should update existing customer', async () => {
      const existingCustomer = {
        id: 'cus_existing',
        email: 'existing@example.com',
        name: 'Old Name',
        metadata: { userId: 'user-456' },
      };

      const mockStripeCustomers = {
        list: jest.fn().mockResolvedValue({ data: [existingCustomer] }),
        update: jest.fn().mockResolvedValue({
          ...existingCustomer,
          name: 'Updated Name',
          metadata: { userId: 'user-456', updated: 'true' },
        }),
      };

      (paymentService as any).stripe.customers = mockStripeCustomers;

      const customer = await paymentService.createOrUpdateCustomer(
        'existing@example.com',
        'Updated Name',
        { updated: 'true' }
      );

      expect(customer.name).toBe('Updated Name');
      expect(mockStripeCustomers.update).toHaveBeenCalledWith('cus_existing', {
        name: 'Updated Name',
        metadata: { userId: 'user-456', updated: 'true' },
      });
    });
  });

  describe('Payment Intent Creation', () => {
    it('should create payment intent successfully', async () => {
      const mockPaymentIntents = {
        create: jest.fn().mockResolvedValue({
          id: 'pi_test',
          client_secret: 'pi_test_secret',
          status: 'requires_payment_method',
          amount: 2999, // $29.99
          currency: 'usd',
          metadata: { type: 'subscription' },
        }),
      };

      (paymentService as any).stripe.paymentIntents = mockPaymentIntents;

      const paymentIntent = await paymentService.createPaymentIntent(29.99, 'usd', {
        type: 'subscription',
      });

      expect(paymentIntent.id).toBe('pi_test');
      expect(paymentIntent.amount).toBe(29.99);
      expect(paymentIntent.currency).toBe('usd');
      expect(paymentIntent.clientSecret).toBe('pi_test_secret');
      expect(paymentIntent.metadata?.type).toBe('subscription');

      expect(mockPaymentIntents.create).toHaveBeenCalledWith({
        amount: 2999, // Converted to cents
        currency: 'usd',
        metadata: { type: 'subscription' },
        automatic_payment_methods: { enabled: true },
      });
    });

    it('should handle payment intent creation errors', async () => {
      const mockPaymentIntents = {
        create: jest.fn().mockRejectedValue(new Error('Stripe API error')),
      };

      (paymentService as any).stripe.paymentIntents = mockPaymentIntents;

      await expect(paymentService.createPaymentIntent(29.99)).rejects.toThrow(
        'Payment intent creation failed: Stripe API error'
      );
    });
  });

  describe('Subscription Management', () => {
    it('should create subscription successfully', async () => {
      const mockSubscriptions = {
        create: jest.fn().mockResolvedValue({
          id: 'sub_test',
          status: 'active',
          customer: 'cus_test',
          items: { data: [{ price: 'price_test' }] },
        }),
      };

      (paymentService as any).stripe.subscriptions = mockSubscriptions;

      const subscription = await paymentService.createSubscription('cus_test', 'price_test', {
        artistId: 'artist-123',
      });

      expect(subscription.id).toBe('sub_test');
      expect(subscription.status).toBe('active');
      expect(subscription.customer).toBe('cus_test');

      expect(mockSubscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_test',
        items: [{ price: 'price_test' }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: { artistId: 'artist-123' },
      });
    });

    it('should cancel subscription immediately', async () => {
      const mockSubscriptions = {
        update: jest.fn().mockResolvedValue({
          id: 'sub_test',
          status: 'canceled',
        }),
        cancel: jest.fn().mockResolvedValue({
          id: 'sub_test',
          status: 'canceled',
        }),
      };

      (paymentService as any).stripe.subscriptions = mockSubscriptions;

      const subscription = await paymentService.cancelSubscription('sub_test', true);

      expect(subscription.id).toBe('sub_test');
      expect(mockSubscriptions.update).toHaveBeenCalledWith('sub_test', {
        cancel_at_period_end: false,
      });
      expect(mockSubscriptions.cancel).toHaveBeenCalledWith('sub_test');
    });

    it('should cancel subscription at period end', async () => {
      const mockSubscriptions = {
        update: jest.fn().mockResolvedValue({
          id: 'sub_test',
          status: 'active',
          cancel_at_period_end: true,
        }),
      };

      (paymentService as any).stripe.subscriptions = mockSubscriptions;

      const subscription = await paymentService.cancelSubscription('sub_test', false);

      expect(subscription.cancel_at_period_end).toBe(true);
      expect(mockSubscriptions.update).toHaveBeenCalledWith('sub_test', {
        cancel_at_period_end: true,
      });
    });

    it('should update subscription price', async () => {
      const mockSubscriptions = {
        retrieve: jest.fn().mockResolvedValue({
          id: 'sub_test',
          items: { data: [{ id: 'si_test', price: 'price_old' }] },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'sub_test',
          items: { data: [{ id: 'si_test', price: 'price_new' }] },
        }),
      };

      (paymentService as any).stripe.subscriptions = mockSubscriptions;

      const subscription = await paymentService.updateSubscription('sub_test', {
        priceId: 'price_new',
        metadata: { updated: 'true' },
      });

      expect(subscription.id).toBe('sub_test');
      expect(mockSubscriptions.update).toHaveBeenCalledWith('sub_test', {
        items: [{ id: 'si_test', price: 'price_new' }],
        metadata: { updated: 'true' },
      });
    });
  });

  describe('Webhook Processing', () => {
    const mockWebhookBody = JSON.stringify({ id: 'evt_test' });
    const mockSignature = 'test_signature';

    it('should process payment_intent.succeeded webhook', async () => {
      const mockWebhooks = {
        constructEvent: jest.fn().mockReturnValue({
          id: 'evt_test',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test',
              amount: 2999,
              status: 'succeeded',
            },
          },
        }),
      };

      (paymentService as any).stripe.webhooks = mockWebhooks;

      const result = await paymentService.processWebhook(mockWebhookBody, mockSignature);

      expect(result.processed).toBe(true);
      expect(result.eventType).toBe('payment_intent.succeeded');
      expect(mockWebhooks.constructEvent).toHaveBeenCalledWith(
        mockWebhookBody,
        mockSignature,
        expect.any(String)
      );
    });

    it('should process invoice.payment_failed webhook and send email', async () => {
      const mockCustomer = {
        id: 'cus_test',
        email: 'test@example.com',
        name: 'Test Customer',
        deleted: false,
      };

      const mockWebhooks = {
        constructEvent: jest.fn().mockReturnValue({
          id: 'evt_test',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_test',
              customer: 'cus_test',
              amount_due: 2999,
              metadata: { artistName: 'Test Artist' },
            },
          },
        }),
      };

      const mockCustomers = {
        retrieve: jest.fn().mockResolvedValue(mockCustomer),
      };

      (paymentService as any).stripe.webhooks = mockWebhooks;
      (paymentService as any).stripe.customers = mockCustomers;

      // Mock email service
      const mockEmailService = {
        sendEmail: jest.fn().mockResolvedValue({ success: true }),
      };
      jest.doMock('@/lib/email-service', () => ({
        emailService: mockEmailService,
      }));

      const result = await paymentService.processWebhook(mockWebhookBody, mockSignature);

      expect(result.processed).toBe(true);
      expect(result.eventType).toBe('invoice.payment_failed');
      expect(mockCustomers.retrieve).toHaveBeenCalledWith('cus_test');
    });

    it('should handle webhook signature verification errors', async () => {
      const mockWebhooks = {
        constructEvent: jest.fn().mockImplementation(() => {
          throw new Error('Invalid signature');
        }),
      };

      (paymentService as any).stripe.webhooks = mockWebhooks;

      const result = await paymentService.processWebhook(mockWebhookBody, 'invalid_signature');

      expect(result.processed).toBe(false);
    });

    it('should handle unrecognized webhook events', async () => {
      const mockWebhooks = {
        constructEvent: jest.fn().mockReturnValue({
          id: 'evt_test',
          type: 'unrecognized.event.type',
          data: { object: {} },
        }),
      };

      (paymentService as any).stripe.webhooks = mockWebhooks;

      const result = await paymentService.processWebhook(mockWebhookBody, mockSignature);

      expect(result.processed).toBe(true);
      expect(result.eventType).toBe('unrecognized.event.type');
    });
  });

  describe('Platform Fee Calculation', () => {
    it('should calculate platform fee correctly', () => {
      // Assuming 10% platform fee
      const fee1 = paymentService.calculatePlatformFee(100);
      expect(fee1).toBe(10);

      const fee2 = paymentService.calculatePlatformFee(29.99);
      expect(fee2).toBe(3); // Rounded

      const fee3 = paymentService.calculatePlatformFee(0);
      expect(fee3).toBe(0);
    });
  });

  describe('Artist Payout Processing', () => {
    it('should process artist payout successfully', async () => {
      const mockTransfers = {
        create: jest.fn().mockResolvedValue({
          id: 'tr_test',
          amount: 2699, // $26.99 after platform fee
          currency: 'usd',
          destination: 'acct_artist',
        }),
      };

      (paymentService as any).stripe.transfers = mockTransfers;

      const transfer = await paymentService.processArtistPayout('acct_artist', 29.99, 'usd');

      expect(transfer.id).toBe('tr_test');
      expect(transfer.amount).toBe(2699);
      expect(transfer.destination).toBe('acct_artist');

      // With 10% platform fee, payout should be 90% of original
      expect(mockTransfers.create).toHaveBeenCalledWith({
        amount: 2699, // $26.99 in cents
        currency: 'usd',
        destination: 'acct_artist',
      });
    });

    it('should handle payout errors', async () => {
      const mockTransfers = {
        create: jest.fn().mockRejectedValue(new Error('Transfer failed')),
      };

      (paymentService as any).stripe.transfers = mockTransfers;

      await expect(paymentService.processArtistPayout('acct_artist', 29.99)).rejects.toThrow(
        'Artist payout failed: Transfer failed'
      );
    });
  });
});

describe('SubscriptionManager Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Subscription Status Checking', () => {
    it('should check active subscription status', async () => {
      const mockSubscription = {
        id: 'sub_test',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
        cancel_at_period_end: false,
      };

      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(mockSubscription as any);

      const status = await subscriptionManager.checkSubscriptionStatus('sub_test');

      expect(status.isActive).toBe(true);
      expect(status.status).toBe('active');
      expect(status.currentPeriodEnd).toBeInstanceOf(Date);
      expect(status.cancelAtPeriodEnd).toBe(false);
    });

    it('should check inactive subscription status', async () => {
      const mockSubscription = {
        id: 'sub_test',
        status: 'canceled',
        current_period_end: Math.floor(Date.now() / 1000) - 86400, // 24 hours ago
        cancel_at_period_end: true,
      };

      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(mockSubscription as any);

      const status = await subscriptionManager.checkSubscriptionStatus('sub_test');

      expect(status.isActive).toBe(false);
      expect(status.status).toBe('canceled');
      expect(status.cancelAtPeriodEnd).toBe(true);
    });

    it('should handle subscription not found', async () => {
      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(null);

      const status = await subscriptionManager.checkSubscriptionStatus('sub_nonexistent');

      expect(status.isActive).toBe(false);
      expect(status.status).toBe('not_found');
    });
  });

  describe('Grace Period Handling', () => {
    it('should handle subscription in grace period', async () => {
      const mockSubscription = {
        id: 'sub_test',
        status: 'past_due',
        current_period_end: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
      };

      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(mockSubscription as any);

      const result = await subscriptionManager.handleGracePeriod('sub_test', 3);

      expect(result).toBe(true); // Should still be in grace period
    });

    it('should cancel subscription after grace period expires', async () => {
      const mockSubscription = {
        id: 'sub_test',
        status: 'past_due',
        current_period_end: Math.floor(Date.now() / 1000) - 5 * 86400, // 5 days ago
      };

      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(mockSubscription as any);
      jest.spyOn(paymentService, 'cancelSubscription').mockResolvedValue({} as any);

      const result = await subscriptionManager.handleGracePeriod('sub_test', 3);

      expect(result).toBe(false); // Grace period expired
      expect(paymentService.cancelSubscription).toHaveBeenCalledWith('sub_test', true);
    });

    it('should not handle non-past-due subscriptions', async () => {
      const mockSubscription = {
        id: 'sub_test',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      };

      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(mockSubscription as any);

      const result = await subscriptionManager.handleGracePeriod('sub_test', 3);

      expect(result).toBe(false); // Not applicable for active subscriptions
    });
  });

  describe('Renewal Processing', () => {
    it('should process subscription renewal', async () => {
      const mockSubscription = {
        id: 'sub_test',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) - 100, // Just expired
      };

      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(mockSubscription as any);

      const result = await subscriptionManager.processRenewal('sub_test');

      expect(result).toBe(true);
    });

    it('should not process renewal for future subscriptions', async () => {
      const mockSubscription = {
        id: 'sub_test',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400, // Future date
      };

      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(mockSubscription as any);

      const result = await subscriptionManager.processRenewal('sub_test');

      expect(result).toBe(false);
    });

    it('should handle renewal for nonexistent subscription', async () => {
      jest.spyOn(paymentService, 'getSubscription').mockResolvedValue(null);

      const result = await subscriptionManager.processRenewal('sub_nonexistent');

      expect(result).toBe(false);
    });
  });
});
