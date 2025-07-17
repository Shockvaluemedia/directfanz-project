// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    tier: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    paymentFailure: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
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
const mockGenerateInvoiceData = generateInvoiceData as jest.MockedFunction<typeof generateInvoiceData>;

describe('Extended Billing Cycle Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('processScheduledTierChanges', () => {
    it('should process scheduled tier changes', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockInvoices = [
        {
          id: 'invoice1',
          subscriptionId: 'sub1',
          items: {
            scheduledTierChange: {
              newTierId: 'tier2',
              newAmount: 20.00,
            }
          },
          subscription: {
            id: 'sub1',
            tierId: 'tier1',
            amount: new Decimal(10.00),
            fan: {
              email: 'fan@example.com',
              notificationPreferences: { billing: true },
            },
          }
        },
      ];

      const mockNewTier = {
        id: 'tier2',
        name: 'Premium Tier',
      };

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any);
      mockPrisma.tier.findUnique.mockResolvedValue(mockNewTier as any);
      
      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          subscription: {
            update: jest.fn().mockResolvedValue({}),
          },
          tier: {
            update: jest.fn().mockResolvedValue({}),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({}),
          },
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

      jest.restoreAllMocks();
    });

    it('should handle errors gracefully and continue processing', async () => {
      const mockInvoices = [
        {
          id: 'invoice1',
          subscriptionId: 'sub1',
          items: {
            scheduledTierChange: {
              newTierId: 'tier2',
              newAmount: 20.00,
            }
          },
          subscription: {
            id: 'sub1',
            tierId: 'tier1',
            amount: new Decimal(10.00),
            fan: {
              email: 'fan@example.com',
              notificationPreferences: { billing: true },
            },
          }
        },
        {
          id: 'invoice2',
          subscriptionId: 'sub2',
          items: {
            scheduledTierChange: {
              newTierId: 'nonexistent',
              newAmount: 15.00,
            }
          },
          subscription: {
            id: 'sub2',
            tierId: 'tier1',
            amount: new Decimal(10.00),
            fan: {
              email: 'fan2@example.com',
              notificationPreferences: { billing: true },
            },
          }
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any);
      mockPrisma.tier.findUnique
        .mockResolvedValueOnce({ id: 'tier2', name: 'Premium Tier' } as any)
        .mockResolvedValueOnce(null); // Second tier doesn't exist
      
      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          subscription: {
            update: jest.fn().mockResolvedValue({}),
          },
          tier: {
            update: jest.fn().mockResolvedValue({}),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await processScheduledTierChanges();

      expect(result).toHaveLength(1); // Only one successful change
      expect(result[0].subscriptionId).toBe('sub1');

      jest.restoreAllMocks();
    });
  });

  describe('recordPaymentFailure', () => {
    it('should create new payment failure record', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      mockPrisma.paymentFailure.findUnique.mockResolvedValue(null);
      mockPrisma.paymentFailure.create.mockResolvedValue({} as any);
      mockPrisma.subscription.update.mockResolvedValue({} as any);

      await recordPaymentFailure('sub123', 'in_test123', 10.00, 'Card declined');

      expect(mockPrisma.paymentFailure.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: 'sub123',
          stripeInvoiceId: 'in_test123',
          amount: new Decimal(10.00),
          failureReason: 'Card declined',
          nextRetryAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        }
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub123' },
        data: { status: 'PAST_DUE' }
      });

      jest.restoreAllMocks();
    });

    it('should update existing payment failure record', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockExistingFailure = {
        id: 'failure1',
        attemptCount: 1,
      };

      mockPrisma.paymentFailure.findUnique.mockResolvedValue(mockExistingFailure as any);
      mockPrisma.paymentFailure.update.mockResolvedValue({} as any);
      mockPrisma.subscription.update.mockResolvedValue({} as any);

      await recordPaymentFailure('sub123', 'in_test123', 10.00, 'Card declined');

      expect(mockPrisma.paymentFailure.update).toHaveBeenCalledWith({
        where: { id: 'failure1' },
        data: {
          attemptCount: { increment: 1 },
          failureReason: 'Card declined',
          nextRetryAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          updatedAt: now,
        }
      });

      jest.restoreAllMocks();
    });
  });

  describe('syncSubscriptionInvoices', () => {
    it('should sync invoices for a subscription', async () => {
      const mockSubscription = {
        id: 'sub123',
        stripeSubscriptionId: 'stripe_sub123',
      };

      const mockStripeInvoices = {
        data: [
          { id: 'in_test1' },
          { id: 'in_test2' },
        ],
        has_more: false,
      };

      const mockInvoiceData1 = {
        id: 'in_test1',
        subscriptionId: 'stripe_sub123',
        amount: 10.00,
        status: 'paid',
        dueDate: new Date('2022-01-01'),
        items: [
          {
            description: 'Monthly subscription',
            amount: 10.00,
            quantity: 1,
            period: {
              start: new Date('2022-01-01'),
              end: new Date('2022-02-01'),
            }
          }
        ],
      };

      const mockInvoiceData2 = {
        id: 'in_test2',
        subscriptionId: 'stripe_sub123',
        amount: 10.00,
        status: 'paid',
        dueDate: new Date('2022-02-01'),
        items: [
          {
            description: 'Monthly subscription',
            amount: 10.00,
            quantity: 1,
            period: {
              start: new Date('2022-02-01'),
              end: new Date('2022-03-01'),
            }
          }
        ],
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list.mockResolvedValue(mockStripeInvoices as any);
      mockGenerateInvoiceData
        .mockResolvedValueOnce(mockInvoiceData1 as any)
        .mockResolvedValueOnce(mockInvoiceData2 as any);
      
      // First invoice doesn't exist, second one does
      mockPrisma.invoice.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'db_invoice2' } as any);
      
      mockPrisma.invoice.create.mockResolvedValue({} as any);
      mockPrisma.invoice.update.mockResolvedValue({} as any);

      const result = await syncSubscriptionInvoices('sub123');

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.total).toBe(2);

      expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.invoice.update).toHaveBeenCalledTimes(1);
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
        amount: 10.00,
        status: 'paid',
        dueDate: new Date('2022-01-01'),
        items: [
          {
            description: 'Monthly subscription',
            amount: 10.00,
            quantity: 1,
            period: {
              start: new Date('2022-01-01'),
              end: new Date('2022-02-01'),
            }
          }
        ],
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list
        .mockResolvedValueOnce(mockStripeInvoices1 as any)
        .mockResolvedValueOnce(mockStripeInvoices2 as any);
      
      mockGenerateInvoiceData.mockResolvedValue(mockInvoiceData as any);
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue({} as any);

      const result = await syncSubscriptionInvoices('sub123');

      expect(result.created).toBe(2);
      expect(result.total).toBe(2);
      expect(mockStripe.invoices.list).toHaveBeenCalledTimes(2);
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        syncSubscriptionInvoices('nonexistent')
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('syncArtistInvoices', () => {
    it('should sync invoices for all artist subscriptions', async () => {
      const mockSubscriptions = [
        { id: 'sub1', stripeSubscriptionId: 'stripe_sub1' },
        { id: 'sub2', stripeSubscriptionId: 'stripe_sub2' },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions as any);
      
      // Mock syncSubscriptionInvoices behavior
      mockPrisma.subscription.findUnique
        .mockResolvedValueOnce(mockSubscriptions[0] as any)
        .mockResolvedValueOnce(mockSubscriptions[1] as any);
      
      mockStripe.invoices.list.mockResolvedValue({ data: [], has_more: false } as any);

      const result = await syncArtistInvoices('artist123');

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: { artistId: 'artist123' }
      });
      
      // Should have attempted to sync both subscriptions
      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should handle errors for individual subscriptions', async () => {
      const mockSubscriptions = [
        { id: 'sub1', stripeSubscriptionId: 'stripe_sub1' },
        { id: 'sub2', stripeSubscriptionId: 'stripe_sub2' },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions as any);
      
      // First subscription sync succeeds, second fails
      mockPrisma.subscription.findUnique
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
      const now = new Date('2022-01-31T12:00:00Z');
      const currentMonthStart = new Date('2022-01-01T00:00:00Z');
      const previousMonthStart = new Date('2021-12-01T00:00:00Z');
      const previousMonthEnd = new Date('2021-12-31T23:59:59Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockCurrentMonthInvoices = [
        { amount: new Decimal(10.00) },
        { amount: new Decimal(20.00) },
      ];

      const mockPreviousMonthInvoices = [
        { amount: new Decimal(15.00) },
      ];

      const mockTiers = [
        {
          id: 'tier1',
          name: 'Basic',
          subscriberCount: 10,
          subscriptions: [
            { amount: new Decimal(5.00) },
            { amount: new Decimal(10.00) },
          ]
        },
        {
          id: 'tier2',
          name: 'Premium',
          subscriberCount: 5,
          subscriptions: [
            { amount: new Decimal(20.00) },
          ]
        },
      ];

      mockPrisma.invoice.findMany
        .mockResolvedValueOnce(mockCurrentMonthInvoices as any)
        .mockResolvedValueOnce(mockPreviousMonthInvoices as any);
      
      mockPrisma.subscription.count
        .mockResolvedValueOnce(15) // Active subscriptions
        .mockResolvedValueOnce(3); // Upcoming renewals
      
      mockPrisma.paymentFailure.count.mockResolvedValue(2);
      
      mockPrisma.subscription.aggregate.mockResolvedValue({
        _avg: { amount: new Decimal(12.50) }
      } as any);
      
      mockPrisma.tier.findMany.mockResolvedValue(mockTiers as any);

      const result = await getArtistBillingSummary('artist123');

      expect(result.currentMonthRevenue).toBe(30.00);
      expect(result.previousMonthRevenue).toBe(15.00);
      expect(result.revenueChange).toBe(100); // 100% increase
      expect(result.activeSubscriptions).toBe(15);
      expect(result.upcomingRenewals).toBe(3);
      expect(result.failedPayments).toBe(2);
      expect(result.averageSubscriptionValue).toBe(12.50);
      expect(result.topTiers).toHaveLength(2);
      expect(result.topTiers[0].tierId).toBe('tier1');
      expect(result.topTiers[0].revenue).toBe(15.00);
      expect(result.topTiers[1].tierId).toBe('tier2');
      expect(result.topTiers[1].revenue).toBe(20.00);

      jest.restoreAllMocks();
    });

    it('should handle zero previous month revenue', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      const mockCurrentMonthInvoices = [
        { amount: new Decimal(10.00) },
      ];

      const mockPreviousMonthInvoices = [];

      mockPrisma.invoice.findMany
        .mockResolvedValueOnce(mockCurrentMonthInvoices as any)
        .mockResolvedValueOnce(mockPreviousMonthInvoices as any);
      
      mockPrisma.subscription.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1);
      
      mockPrisma.paymentFailure.count.mockResolvedValue(0);
      
      mockPrisma.subscription.aggregate.mockResolvedValue({
        _avg: { amount: new Decimal(10.00) }
      } as any);
      
      mockPrisma.tier.findMany.mockResolvedValue([] as any);

      const result = await getArtistBillingSummary('artist123');

      expect(result.currentMonthRevenue).toBe(10.00);
      expect(result.previousMonthRevenue).toBe(0);
      expect(result.revenueChange).toBe(100); // Consider it 100% growth
      expect(result.topTiers).toHaveLength(0);

      jest.restoreAllMocks();
    });

    it('should handle zero active subscriptions', async () => {
      const now = new Date('2022-01-31T12:00:00Z');
      
      jest.spyOn(global, 'Date').mockImplementation((dateString?: string) => {
        if (dateString) return new Date(dateString) as any;
        return now as any;
      });

      mockPrisma.invoice.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      
      mockPrisma.subscription.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      
      mockPrisma.paymentFailure.count.mockResolvedValue(0);
      
      mockPrisma.subscription.aggregate.mockResolvedValue({
        _avg: { amount: null }
      } as any);
      
      mockPrisma.tier.findMany.mockResolvedValue([] as any);

      const result = await getArtistBillingSummary('artist123');

      expect(result.currentMonthRevenue).toBe(0);
      expect(result.previousMonthRevenue).toBe(0);
      expect(result.revenueChange).toBe(100);
      expect(result.activeSubscriptions).toBe(0);
      expect(result.averageSubscriptionValue).toBe(0);

      jest.restoreAllMocks();
    });
  });
});