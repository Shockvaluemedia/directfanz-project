// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    paymentFailure: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: {
      retrieveUpcoming: jest.fn(),
      retrieve: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
      cancel: jest.fn(),
    },
  },
}));

jest.mock('@/lib/notifications', () => ({
  sendEmail: jest.fn(),
}));

import {
  getUpcomingInvoices,
  processBillingRenewals,
  processFailedPaymentRetries,
  sendBillingReminders,
  getBillingCycleStats,
} from '../billing-cycle';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/notifications';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe('Billing Cycle Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('getUpcomingInvoices', () => {
    it('should retrieve upcoming invoices for active subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub1',
          stripeSubscriptionId: 'stripe_sub1',
          fan: { id: 'fan1' },
          tier: { artist: { id: 'artist1' } },
        },
        {
          id: 'sub2',
          stripeSubscriptionId: 'stripe_sub2',
          fan: { id: 'fan2' },
          tier: { artist: { id: 'artist2' } },
        },
      ];

      const mockUpcomingInvoice1 = {
        amount_due: 1000, // $10.00
        due_date: 1640995200,
        period_start: 1640995200,
        period_end: 1643673600,
        lines: {
          data: [
            { proration: false, amount: 1000 },
          ],
        },
      };

      const mockUpcomingInvoice2 = {
        amount_due: 2000, // $20.00
        due_date: 1640995200,
        period_start: 1640995200,
        period_end: 1643673600,
        lines: {
          data: [
            { proration: true, amount: 500 }, // $5.00 proration
            { proration: false, amount: 1500 },
          ],
        },
      };

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions as any);
      mockStripe.invoices.retrieveUpcoming
        .mockResolvedValueOnce(mockUpcomingInvoice1 as any)
        .mockResolvedValueOnce(mockUpcomingInvoice2 as any);

      const result = await getUpcomingInvoices();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        subscriptionId: 'sub1',
        amount: 10.00,
        dueDate: new Date(1640995200 * 1000),
        periodStart: new Date(1640995200 * 1000),
        periodEnd: new Date(1643673600 * 1000),
        prorationAmount: undefined,
      });
      expect(result[1]).toEqual({
        subscriptionId: 'sub2',
        amount: 20.00,
        dueDate: new Date(1640995200 * 1000),
        periodStart: new Date(1640995200 * 1000),
        periodEnd: new Date(1643673600 * 1000),
        prorationAmount: 5.00,
      });
    });

    it('should handle errors gracefully and continue with other subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub1',
          stripeSubscriptionId: 'stripe_sub1',
        },
        {
          id: 'sub2',
          stripeSubscriptionId: 'stripe_sub2',
        },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions as any);
      mockStripe.invoices.retrieveUpcoming
        .mockRejectedValueOnce(new Error('Invoice not found'))
        .mockResolvedValueOnce({
          amount_due: 1000,
          due_date: 1640995200,
          period_start: 1640995200,
          period_end: 1643673600,
          lines: { data: [] },
        } as any);

      const result = await getUpcomingInvoices();

      expect(result).toHaveLength(1); // Only successful one
      expect(result[0].subscriptionId).toBe('sub2');
    });
  });

  describe('processBillingRenewals', () => {
    it('should process renewals for subscriptions due in next 24 hours', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      const tomorrow = new Date('2022-02-01T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockSubscriptions = [
        {
          id: 'sub1',
          stripeSubscriptionId: 'stripe_sub1',
          fan: {
            email: 'fan1@example.com',
            notificationPreferences: { billing: true },
          },
          tier: {
            name: 'Premium',
            artist: { displayName: 'Test Artist' },
          },
          amount: new Decimal(10.00),
        },
      ];

      const mockStripeSubscription = {
        current_period_start: 1640995200,
        current_period_end: 1643673600,
        status: 'active',
      };

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      mockPrisma.subscription.update.mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue(undefined);

      const result = await processBillingRenewals();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('renewal');
      expect(result[0].subscriptionId).toBe('sub1');
      expect(result[0].amount).toBe(10.00);
      
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: {
          currentPeriodStart: new Date(1640995200 * 1000),
          currentPeriodEnd: new Date(1643673600 * 1000),
          status: 'ACTIVE',
        },
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'fan1@example.com',
        subject: 'Subscription Renewed - Test Artist',
        html: expect.stringContaining('Subscription Renewed'),
        text: expect.stringContaining('Subscription Renewed'),
      });

      jest.restoreAllMocks();
    });

    it('should skip email notification if billing notifications disabled', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockSubscriptions = [
        {
          id: 'sub1',
          stripeSubscriptionId: 'stripe_sub1',
          fan: {
            email: 'fan1@example.com',
            notificationPreferences: { billing: false },
          },
          tier: {
            name: 'Premium',
            artist: { displayName: 'Test Artist' },
          },
          amount: new Decimal(10.00),
        },
      ];

      const mockStripeSubscription = {
        current_period_start: 1640995200,
        current_period_end: 1643673600,
        status: 'active',
      };

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      mockPrisma.subscription.update.mockResolvedValue({} as any);

      await processBillingRenewals();

      expect(mockSendEmail).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });

  describe('processFailedPaymentRetries', () => {
    it('should mark resolved failures as resolved', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockFailures = [
        {
          id: 'failure1',
          subscriptionId: 'sub1',
          stripeInvoiceId: 'in_test123',
          amount: new Decimal(10.00),
          attemptCount: 2,
          subscription: {
            fan: { email: 'fan@example.com' },
            tier: {
              name: 'Premium',
              artist: { displayName: 'Test Artist' },
            },
          },
        },
      ];

      const mockInvoice = {
        status: 'paid',
        attempt_count: 2,
      };

      mockPrisma.paymentFailure.findMany.mockResolvedValue(mockFailures as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockPrisma.paymentFailure.update.mockResolvedValue({} as any);
      mockPrisma.subscription.update.mockResolvedValue({} as any);

      const result = await processFailedPaymentRetries();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('retry');
      expect(result[0].metadata?.resolved).toBe(true);

      expect(mockPrisma.paymentFailure.update).toHaveBeenCalledWith({
        where: { id: 'failure1' },
        data: { isResolved: true },
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { status: 'ACTIVE' },
      });

      jest.restoreAllMocks();
    });

    it('should cancel subscription after max attempts', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockFailures = [
        {
          id: 'failure1',
          subscriptionId: 'sub1',
          stripeInvoiceId: 'in_test123',
          amount: new Decimal(10.00),
          attemptCount: 3,
          subscription: {
            stripeSubscriptionId: 'stripe_sub1',
            artistId: 'artist1',
            fan: { email: 'fan@example.com' },
            tier: {
              name: 'Premium',
              artist: { displayName: 'Test Artist' },
            },
          },
        },
      ];

      const mockInvoice = {
        status: 'open',
        attempt_count: 3,
      };

      mockPrisma.paymentFailure.findMany.mockResolvedValue(mockFailures as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockStripe.subscriptions.cancel.mockResolvedValue({} as any);
      mockPrisma.subscription.update.mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue(undefined);

      const result = await processFailedPaymentRetries();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('cancellation');
      expect(result[0].metadata?.reason).toBe('payment_failure');

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('stripe_sub1');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { status: 'CANCELED' },
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'fan@example.com',
        subject: 'Subscription Canceled - Payment Failed',
        html: expect.stringContaining('Subscription Canceled'),
        text: expect.stringContaining('Subscription Canceled'),
      });

      jest.restoreAllMocks();
    });

    it('should update retry information for ongoing failures', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      const nextRetry = new Date('2022-02-01T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockFailures = [
        {
          id: 'failure1',
          subscriptionId: 'sub1',
          stripeInvoiceId: 'in_test123',
          amount: new Decimal(10.00),
          attemptCount: 1,
          subscription: {
            fan: { email: 'fan@example.com' },
            tier: {
              name: 'Premium',
              artist: { displayName: 'Test Artist' },
            },
          },
        },
      ];

      const mockInvoice = {
        status: 'open',
        attempt_count: 2,
        next_payment_attempt: Math.floor(nextRetry.getTime() / 1000),
      };

      mockPrisma.paymentFailure.findMany.mockResolvedValue(mockFailures as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockPrisma.paymentFailure.update.mockResolvedValue({} as any);

      const result = await processFailedPaymentRetries();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('retry');
      expect(result[0].metadata?.resolved).toBe(false);

      expect(mockPrisma.paymentFailure.update).toHaveBeenCalledWith({
        where: { id: 'failure1' },
        data: {
          attemptCount: 2,
          nextRetryAt: nextRetry,
        },
      });

      jest.restoreAllMocks();
    });
  });

  describe('sendBillingReminders', () => {
    it('should send reminders for subscriptions renewing in 3 days', async () => {
      const now = new Date('2022-01-29T12:00:00Z');
      const renewalDate = new Date('2022-02-01T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockSubscriptions = [
        {
          id: 'sub1',
          currentPeriodEnd: renewalDate,
          amount: new Decimal(10.00),
          fan: {
            email: 'fan1@example.com',
            notificationPreferences: { billing: true },
          },
          tier: {
            name: 'Premium',
            artist: { displayName: 'Test Artist' },
          },
        },
        {
          id: 'sub2',
          currentPeriodEnd: renewalDate,
          amount: new Decimal(15.00),
          fan: {
            email: 'fan2@example.com',
            notificationPreferences: { billing: false }, // Disabled
          },
          tier: {
            name: 'VIP',
            artist: { displayName: 'Test Artist' },
          },
        },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions as any);
      mockSendEmail.mockResolvedValue(undefined);

      const result = await sendBillingReminders();

      expect(result).toBe(1); // Only one reminder sent (second one disabled)
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'fan1@example.com',
        subject: 'Upcoming Renewal - Test Artist',
        html: expect.stringContaining('Upcoming Subscription Renewal'),
        text: expect.stringContaining('Upcoming Subscription Renewal'),
      });

      jest.restoreAllMocks();
    });
  });

  describe('getBillingCycleStats', () => {
    it('should return billing cycle statistics', async () => {
      const now = new Date('2022-01-29T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      mockPrisma.subscription.count
        .mockResolvedValueOnce(100) // Active subscriptions
        .mockResolvedValueOnce(15); // Upcoming renewals

      mockPrisma.paymentFailure.count.mockResolvedValue(5); // Failed payments

      mockPrisma.subscription.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(2500.00) },
      } as any);

      const result = await getBillingCycleStats();

      expect(result).toEqual({
        activeSubscriptions: 100,
        upcomingRenewals: 15,
        failedPayments: 5,
        totalMonthlyRevenue: 2500.00,
      });

      jest.restoreAllMocks();
    });

    it('should handle null revenue sum', async () => {
      const now = new Date('2022-01-29T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      mockPrisma.subscription.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockPrisma.paymentFailure.count.mockResolvedValue(0);

      mockPrisma.subscription.aggregate.mockResolvedValue({
        _sum: { amount: null },
      } as any);

      const result = await getBillingCycleStats();

      expect(result.totalMonthlyRevenue).toBe(0);

      jest.restoreAllMocks();
    });
  });
});