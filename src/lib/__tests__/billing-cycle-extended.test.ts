// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptions: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    invoices: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    tiers: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    payment_failures: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: {
      list: jest.fn(),
      retrieve: jest.fn(),
      retrieveUpcoming: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('@/lib/notifications', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/lib/billing', () => ({
  generateInvoiceData: jest.fn(),
  getBillingCycleInfo: jest.fn(),
}));

import {
  processScheduledTierChanges,
  recordPaymentFailure,
  syncSubscriptionInvoices,
  syncArtistInvoices,
  getArtistBillingSummary,
} from '../billing-cycle';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/notifications';
import { generateInvoiceData } from '@/lib/billing';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockGenerateInvoiceData = generateInvoiceData as jest.MockedFunction<
  typeof generateInvoiceData
>;

describe('Extended Billing Cycle Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    jest.restoreAllMocks();
  });

  describe('processScheduledTierChanges', () => {
    it('should process scheduled tier changes', async () => {
      const OriginalDate = Date;
      const now = new OriginalDate('2022-01-31T12:00:00Z');

      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new OriginalDate(dateString) as any;
        return now as any;
      });

      // Mock $queryRaw to return scheduled changes data
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'invoice1',
          subscriptionId: 'sub1',
          tierId: 'tier1',
          amount: new Decimal(10.0),
          fanId: 'fan1',
          artistId: 'artist1',
          email: 'fan@example.com',
          notificationPreferences: { billing: true },
          tierName: 'Current Tier',
          items: {
            scheduledTierChange: {
              newTierId: 'tier2',
              newAmount: 20.0,
            },
          },
          subscription: {
            id: 'sub1',
            tierId: 'tier1',
            amount: new Decimal(10.0),
            users: {
              email: 'fan@example.com',
              notificationPreferences: { billing: true },
            },
          },
        },
      ]);

      mockPrisma.tiers.findUnique.mockResolvedValue({ id: 'tier2', name: 'Premium Tier' } as any);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback({
          subscriptions: {
            update: jest.fn().mockResolvedValue({}),
          },
          tiers: {
            update: jest.fn().mockResolvedValue({}),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({}),
          },
          $executeRaw: jest.fn().mockResolvedValue({}),
        });
      });

      mockSendEmail.mockResolvedValue(undefined);

      const result = await processScheduledTierChanges();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('renewal');
      expect(result[0].metadata?.tierChange).toBeDefined();
      expect(result[0].metadata?.tierChange.fromTierId).toBe('tier1');
      expect(result[0].metadata?.tierChange.toTierId).toBe('tier2');
      expect(result[0].metadata?.tierChange.isUpgrade).toBe(true);

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'fan@example.com',
        subject: 'Subscription Tier Changed - Premium Tier',
        html: expect.stringContaining('Subscription Tier Changed'),
        text: expect.stringContaining('Subscription Tier Changed'),
      });

      jest.useRealTimers();
    });

    it('should handle errors gracefully and continue processing', async () => {
      // Mock $queryRaw to return scheduled changes data
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'invoice1',
          subscriptionId: 'sub1',
          items: {
            scheduledTierChange: {
              newTierId: 'tier2',
              newAmount: 20.0,
            },
          },
          subscription: {
            id: 'sub1',
            tierId: 'tier1',
            amount: new Decimal(10.0),
            users: {
              email: 'fan@example.com',
              notificationPreferences: { billing: true },
            },
          },
        },
        {
          id: 'invoice2',
          subscriptionId: 'sub2',
          items: {
            scheduledTierChange: {
              newTierId: 'nonexistent',
              newAmount: 15.0,
            },
          },
          subscription: {
            id: 'sub2',
            tierId: 'tier1',
            amount: new Decimal(10.0),
            users: {
              email: 'fan2@example.com',
              notificationPreferences: { billing: true },
            },
          },
        },
      ]);

      mockPrisma.tiers.findUnique
        .mockResolvedValueOnce({ id: 'tier2', name: 'Premium Tier' } as any)
        .mockResolvedValueOnce(null); // Second tier doesn't exist

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback({
          subscriptions: {
            update: jest.fn().mockResolvedValue({}),
          },
          tiers: {
            update: jest.fn().mockResolvedValue({}),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({}),
          },
          $executeRaw: jest.fn().mockResolvedValue({}),
        });
      });

      const result = await processScheduledTierChanges();

      expect(result).toHaveLength(1); // Only one successful change
      expect(result[0].subscriptionId).toBe('sub1');

      jest.useRealTimers();
    });
  });

  describe('recordPaymentFailure', () => {
    it('should create new payment failure record', async () => {
      // Source uses $queryRaw to check existing and $executeRaw to create
      mockPrisma.$queryRaw.mockResolvedValue([]); // No existing failure
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);

      await recordPaymentFailure('sub123', 'in_test123', 10.0, 'Card declined');

      // Should call $executeRaw to insert
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();

      expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
        where: { id: 'sub123' },
        data: { status: 'PAST_DUE' },
      });
    });

    it('should update existing payment failure record', async () => {
      const mockExistingFailure = {
        id: 'failure1',
        attemptCount: 1,
      };

      // Source uses $queryRaw to find existing failure
      mockPrisma.$queryRaw.mockResolvedValue([mockExistingFailure]);
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);

      await recordPaymentFailure('sub123', 'in_test123', 10.0, 'Card declined');

      // Should call $executeRaw to update
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('syncSubscriptionInvoices', () => {
    it('should sync invoices for a subscription', async () => {
      const mockSubscription = {
        id: 'sub123',
        stripeSubscriptionId: 'stripe_sub123',
      };

      const mockStripeInvoices = {
        data: [{ id: 'in_test1' }, { id: 'in_test2' }],
        has_more: false,
      };

      const mockInvoiceData1 = {
        id: 'in_test1',
        subscriptionId: 'stripe_sub123',
        amount: 10.0,
        status: 'paid',
        dueDate: new Date('2022-01-01'),
        items: [
          {
            description: 'Monthly subscription',
            amount: 10.0,
            quantity: 1,
            period: {
              start: new Date('2022-01-01'),
              end: new Date('2022-02-01'),
            },
          },
        ],
      };

      const mockInvoiceData2 = {
        id: 'in_test2',
        subscriptionId: 'stripe_sub123',
        amount: 10.0,
        status: 'paid',
        dueDate: new Date('2022-02-01'),
        items: [
          {
            description: 'Monthly subscription',
            amount: 10.0,
            quantity: 1,
            period: {
              start: new Date('2022-02-01'),
              end: new Date('2022-03-01'),
            },
          },
        ],
      };

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list.mockResolvedValue(mockStripeInvoices as any);
      mockGenerateInvoiceData
        .mockResolvedValueOnce(mockInvoiceData1 as any)
        .mockResolvedValueOnce(mockInvoiceData2 as any);

      // Source uses $queryRaw to check if invoice exists and $executeRaw to create/update
      // First invoice doesn't exist, second one does
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // First invoice not found
        .mockResolvedValueOnce([{ id: 'db_invoice2' }]); // Second invoice found

      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await syncSubscriptionInvoices('sub123');

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.total).toBe(2);

      // $executeRaw is called for both create and update
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('should handle pagination for large invoice lists', async () => {
      const mockSubscription = {
        id: 'sub123',
        stripeSubscriptionId: 'stripe_sub123',
      };

      const mockStripeInvoices1 = {
        data: [{ id: 'in_test1' }],
        has_more: true,
      };

      const mockStripeInvoices2 = {
        data: [{ id: 'in_test2' }],
        has_more: false,
      };

      const mockInvoiceData = {
        id: 'in_test1',
        subscriptionId: 'stripe_sub123',
        amount: 10.0,
        status: 'paid',
        dueDate: new Date('2022-01-01'),
        items: [
          {
            description: 'Monthly subscription',
            amount: 10.0,
            quantity: 1,
            period: {
              start: new Date('2022-01-01'),
              end: new Date('2022-02-01'),
            },
          },
        ],
      };

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list
        .mockResolvedValueOnce(mockStripeInvoices1 as any)
        .mockResolvedValueOnce(mockStripeInvoices2 as any);

      mockGenerateInvoiceData.mockResolvedValue(mockInvoiceData as any);
      mockPrisma.$queryRaw.mockResolvedValue([]); // No existing invoices
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await syncSubscriptionInvoices('sub123');

      expect(result.created).toBe(2);
      expect(result.total).toBe(2);
      expect(mockStripe.invoices.list).toHaveBeenCalledTimes(2);
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscriptions.findUnique.mockResolvedValue(null);

      await expect(syncSubscriptionInvoices('nonexistent')).rejects.toThrow(
        'Failed to sync subscription invoices'
      );
    });
  });

  describe('syncArtistInvoices', () => {
    it('should sync invoices for all artist subscriptions', async () => {
      const mockSubscriptions = [
        { id: 'sub1', stripeSubscriptionId: 'stripe_sub1' },
        { id: 'sub2', stripeSubscriptionId: 'stripe_sub2' },
      ];

      mockPrisma.subscriptions.findMany.mockResolvedValue(mockSubscriptions as any);

      // Mock syncSubscriptionInvoices behavior - it calls subscriptions.findUnique internally
      mockPrisma.subscriptions.findUnique
        .mockResolvedValueOnce(mockSubscriptions[0] as any)
        .mockResolvedValueOnce(mockSubscriptions[1] as any);

      mockStripe.invoices.list.mockResolvedValue({ data: [], has_more: false } as any);

      const result = await syncArtistInvoices('artist123');

      expect(mockPrisma.subscriptions.findMany).toHaveBeenCalledWith({
        where: { artistId: 'artist123' },
      });

      // Should have attempted to sync both subscriptions
      expect(mockPrisma.subscriptions.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should handle errors for individual subscriptions', async () => {
      const mockSubscriptions = [
        { id: 'sub1', stripeSubscriptionId: 'stripe_sub1' },
        { id: 'sub2', stripeSubscriptionId: 'stripe_sub2' },
      ];

      mockPrisma.subscriptions.findMany.mockResolvedValue(mockSubscriptions as any);

      // First subscription sync succeeds, second fails
      mockPrisma.subscriptions.findUnique
        .mockResolvedValueOnce(mockSubscriptions[0] as any)
        .mockRejectedValueOnce(new Error('Sync failed'));

      mockStripe.invoices.list.mockResolvedValue({ data: [], has_more: false } as any);

      const result = await syncArtistInvoices('artist123');

      // Should still return results from the successful sync
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });
  });

  describe('getArtistBillingSummary', () => {
    it('should return billing summary for artist', async () => {
      const OriginalDate = Date;
      const now = new OriginalDate('2022-01-31T12:00:00Z');

      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new OriginalDate(dateString) as any;
        return now as any;
      });

      const mockCurrentMonthInvoices = [
        { amount: new Decimal(10.0) },
        { amount: new Decimal(20.0) },
      ];

      const mockPreviousMonthInvoices = [{ amount: new Decimal(15.0) }];

      const mockTiers = [
        {
          id: 'tier1',
          name: 'Basic',
          subscriberCount: 10,
          subscriptions: [{ amount: new Decimal(5.0) }, { amount: new Decimal(10.0) }],
        },
        {
          id: 'tier2',
          name: 'Premium',
          subscriberCount: 5,
          subscriptions: [{ amount: new Decimal(20.0) }],
        },
      ];

      mockPrisma.invoices.findMany
        .mockResolvedValueOnce(mockCurrentMonthInvoices as any)
        .mockResolvedValueOnce(mockPreviousMonthInvoices as any);

      mockPrisma.subscriptions.count
        .mockResolvedValueOnce(15) // Active subscriptions
        .mockResolvedValueOnce(3); // Upcoming renewals

      // Source uses $queryRaw for failed payments count
      mockPrisma.$queryRaw.mockResolvedValue([{ count: '2' }]);

      mockPrisma.subscriptions.aggregate.mockResolvedValue({
        _avg: { amount: new Decimal(12.5) },
      } as any);

      mockPrisma.tiers.findMany.mockResolvedValue(mockTiers as any);

      const result = await getArtistBillingSummary('artist123');

      expect(result.currentMonthRevenue).toBe(30.0);
      expect(result.previousMonthRevenue).toBe(15.0);
      expect(result.revenueChange).toBe(100); // 100% increase
      expect(result.activeSubscriptions).toBe(15);
      expect(result.upcomingRenewals).toBe(3);
      expect(result.failedPayments).toBe(2);
      expect(result.averageSubscriptionValue).toBe(12.5);
      expect(result.topTiers).toHaveLength(2);
      expect(result.topTiers[0].tierId).toBe('tier1');
      expect(result.topTiers[0].revenue).toBe(15.0);
      expect(result.topTiers[1].tierId).toBe('tier2');
      expect(result.topTiers[1].revenue).toBe(20.0);

      jest.useRealTimers();
    });

    it('should handle zero previous month revenue', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2022-01-31T12:00:00Z'));

      const mockCurrentMonthInvoices = [{ amount: new Decimal(10.0) }];

      const mockPreviousMonthInvoices: any[] = [];

      mockPrisma.invoices.findMany
        .mockResolvedValueOnce(mockCurrentMonthInvoices as any)
        .mockResolvedValueOnce(mockPreviousMonthInvoices as any);

      mockPrisma.subscriptions.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);

      // Source uses $queryRaw for failed payments count
      mockPrisma.$queryRaw.mockResolvedValue([{ count: '0' }]);

      mockPrisma.subscriptions.aggregate.mockResolvedValue({
        _avg: { amount: new Decimal(10.0) },
      } as any);

      mockPrisma.tiers.findMany.mockResolvedValue([] as any);

      const result = await getArtistBillingSummary('artist123');

      expect(result.currentMonthRevenue).toBe(10.0);
      expect(result.previousMonthRevenue).toBe(0);
      expect(result.revenueChange).toBe(100); // Consider it 100% growth
      expect(result.topTiers).toHaveLength(0);

      jest.useRealTimers();
    });

    it('should handle zero active subscriptions', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2022-01-31T12:00:00Z'));

      mockPrisma.invoices.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      mockPrisma.subscriptions.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      // Source uses $queryRaw for failed payments count
      mockPrisma.$queryRaw.mockResolvedValue([{ count: '0' }]);

      mockPrisma.subscriptions.aggregate.mockResolvedValue({
        _avg: { amount: null },
      } as any);

      mockPrisma.tiers.findMany.mockResolvedValue([] as any);

      const result = await getArtistBillingSummary('artist123');

      expect(result.currentMonthRevenue).toBe(0);
      expect(result.previousMonthRevenue).toBe(0);
      expect(result.revenueChange).toBe(100);
      expect(result.activeSubscriptions).toBe(0);
      expect(result.averageSubscriptionValue).toBe(0);

      jest.useRealTimers();
    });
  });
});
