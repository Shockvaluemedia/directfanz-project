// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptions: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tiers: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    invoices: {
      retrieve: jest.fn(),
    },
  },
}));

import {
  calculateTierChangeProration,
  getBillingCycleInfo,
  upgradeSubscription,
  downgradeSubscription,
  generateInvoiceData,
} from '../billing';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStripe = stripe as jest.Mocked<typeof stripe>;

beforeEach(() => {
  // Reset all mocks between tests
  jest.clearAllMocks();
  mockStripe.invoices.retrieve.mockReset();
});

describe('Billing Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTierChangeProration', () => {
    it('should calculate proration for tier upgrade correctly', async () => {
      const mockSubscription = {
        id: 'sub123',
        amount: new Decimal(10.0),
        tier: { id: 'tier1' },
      };

      const mockStripeSubscription = {
        current_period_start: 1640995200, // Jan 1, 2022
        current_period_end: 1643673600, // Feb 1, 2022 (31 days)
      };

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);

      // Mock current date to be 15 days into the period (16 days remaining)
      const mockDate = new Date('2022-01-16T00:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const result = await calculateTierChangeProration('sub123', 'tier2', 20.0);

      expect(result.currentAmount).toBe(10.0);
      expect(result.newAmount).toBe(20.0);
      expect(result.totalDaysInPeriod).toBe(31);
      expect(result.daysRemaining).toBe(16);

      // Proration calculation:
      // Daily current rate: $10.00 / 31 = $0.3226
      // Daily new rate: $20.00 / 31 = $0.6452
      // Unused current amount: $0.3226 * 16 = $5.16
      // New amount for remaining period: $0.6452 * 16 = $10.32
      // Proration amount: $10.32 - $5.16 = $5.16
      expect(result.prorationAmount).toBeCloseTo(5.16, 2);
      expect(result.nextInvoiceAmount).toBe(20.0);

      jest.useRealTimers();
    });

    it('should calculate proration for tier downgrade correctly', async () => {
      const mockSubscription = {
        id: 'sub123',
        amount: new Decimal(20.0),
        tier: { id: 'tier1' },
      };

      const mockStripeSubscription = {
        current_period_start: 1640995200, // Jan 1, 2022
        current_period_end: 1643673600, // Feb 1, 2022 (31 days)
      };

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);

      // Mock current date to be 15 days into the period (16 days remaining)
      const mockDate = new Date('2022-01-16T00:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const result = await calculateTierChangeProration('sub123', 'tier2', 10.0);

      expect(result.currentAmount).toBe(20.0);
      expect(result.newAmount).toBe(10.0);
      expect(result.prorationAmount).toBeCloseTo(-5.16, 2); // Negative for downgrade
      expect(result.nextInvoiceAmount).toBe(10.0);

      jest.useRealTimers();
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscriptions.findUnique.mockResolvedValue(null);

      await expect(calculateTierChangeProration('nonexistent', 'tier2', 20.0)).rejects.toThrow(
        'Failed to calculate proration'
      );
    });
  });

  describe('getBillingCycleInfo', () => {
    it('should return billing cycle information correctly', async () => {
      const mockSubscription = {
        id: 'sub123',
        stripeSubscriptionId: 'stripe_sub123',
      };

      const mockStripeSubscription = {
        current_period_start: 1640995200, // Jan 1, 2022
        current_period_end: 1643673600, // Feb 1, 2022
      };

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);

      // Mock current date to be 15 days into the period (16 days remaining)
      const mockDate = new Date('2022-01-16T00:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const result = await getBillingCycleInfo('sub123');

      expect(result.currentPeriodStart).toEqual(new Date(1640995200 * 1000));
      expect(result.currentPeriodEnd).toEqual(new Date(1643673600 * 1000));
      expect(result.nextBillingDate).toEqual(new Date(1643673600 * 1000));
      expect(result.daysInCurrentPeriod).toBe(31);
      expect(result.daysRemaining).toBe(16);

      jest.useRealTimers();
    });

    it('should handle past due subscriptions correctly', async () => {
      const mockSubscription = {
        id: 'sub123',
        stripeSubscriptionId: 'stripe_sub123',
      };

      const mockStripeSubscription = {
        current_period_start: 1640995200, // Jan 1, 2022
        current_period_end: 1643673600, // Feb 1, 2022
      };

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);

      // Mock current date to be after the period end
      const mockDate = new Date('2022-02-05T00:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const result = await getBillingCycleInfo('sub123');

      expect(result.daysRemaining).toBe(0); // Should be 0 for past due

      jest.useRealTimers();
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub123',
        tierId: 'tier1',
        amount: new Decimal(10.0),
        status: 'ACTIVE',
        stripeSubscriptionId: 'stripe_sub123',
        tier: {
          artist: { id: 'artist123' },
        },
      };

      const mockNewTier = {
        id: 'tier2',
        minimumPrice: new Decimal(15.0),
      };

      const mockStripeSubscription = {
        items: {
          data: [
            {
              id: 'si_test123',
              price: { product: 'prod_test123' },
            },
          ],
        },
        current_period_start: 1640995200, // Jan 1, 2022
        current_period_end: 1643673600, // Feb 1, 2022
      };

      // Mock current date to be 15 days into the period (16 days remaining)
      const mockDate = new Date('2022-01-16T00:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.tiers.findUnique.mockResolvedValue(mockNewTier as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      mockStripe.subscriptions.update.mockResolvedValue({} as any);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback({
          subscriptions: {
            update: jest.fn().mockResolvedValue({}),
          },
          tiers: {
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await upgradeSubscription('sub123', 'tier2', 20.0);

      expect(result.success).toBe(true);
      expect(result.prorationAmount).toBeGreaterThan(0); // Should be positive for upgrade
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'stripe_sub123',
        expect.objectContaining({
          proration_behavior: 'create_prorations',
        })
      );

      jest.useRealTimers();
    });

    it('should throw error for inactive subscription', async () => {
      const mockSubscription = {
        id: 'sub123',
        status: 'CANCELED',
      };

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);

      await expect(upgradeSubscription('sub123', 'tier2', 20.0)).rejects.toThrow(
        'Can only change tier for active subscriptions'
      );
    });

    it('should throw error for amount below minimum', async () => {
      const mockSubscription = {
        id: 'sub123',
        status: 'ACTIVE',
        tier: { users: { id: 'artist123' } },
      };

      const mockNewTier = {
        id: 'tier2',
        minimumPrice: new Decimal(15.0),
      };

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.tiers.findUnique.mockResolvedValue(mockNewTier as any);

      await expect(
        upgradeSubscription('sub123', 'tier2', 10.0) // Below minimum of $15
      ).rejects.toThrow('Amount is below minimum price for the new tier');
    });
  });

  describe('downgradeSubscription', () => {
    it('should downgrade subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub123',
        tierId: 'tier1',
        amount: new Decimal(20.0),
        status: 'ACTIVE',
        stripeSubscriptionId: 'stripe_sub123',
        tier: {
          artist: { id: 'artist123' },
        },
      };

      const mockNewTier = {
        id: 'tier2',
        minimumPrice: new Decimal(5.0),
      };

      const mockStripeSubscription = {
        items: {
          data: [
            {
              id: 'si_test123',
              price: { product: 'prod_test123' },
            },
          ],
        },
        current_period_start: 1640995200, // Jan 1, 2022
        current_period_end: 1643673600, // Feb 1, 2022
      };

      // Mock current date to be 15 days into the period (16 days remaining)
      const mockDate = new Date('2022-01-16T00:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.tiers.findUnique.mockResolvedValue(mockNewTier as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      mockStripe.subscriptions.update.mockResolvedValue({} as any);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback({
          subscriptions: {
            update: jest.fn().mockResolvedValue({}),
          },
          tiers: {
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await downgradeSubscription('sub123', 'tier2', 10.0);

      expect(result.success).toBe(true);
      expect(result.prorationAmount).toBeLessThan(0); // Should be negative for downgrade

      jest.useRealTimers();
    });
  });

  describe('generateInvoiceData', () => {
    it('should generate invoice data correctly', async () => {
      const mockInvoice = {
        id: 'in_test123',
        subscription: 'stripe_sub123',
        amount_paid: 1000, // $10.00 in cents
        status: 'paid',
        due_date: 1640995200,
        created: 1640995200,
        status_transitions: {
          paid_at: 1640995300,
        },
        lines: {
          data: [
            {
              description: 'Premium Tier Subscription',
              amount: 1000,
              quantity: 1,
              period: {
                start: 1640995200,
                end: 1643673600,
              },
            },
          ],
        },
      };

      // Override the global mock for this test
      (mockStripe.invoices.retrieve as jest.Mock).mockImplementationOnce(() => {
        return Promise.resolve(mockInvoice);
      });

      const result = await generateInvoiceData('in_test123');

      expect(result.id).toBe('in_test123');
      expect(result.subscriptionId).toBe('stripe_sub123');
      expect(result.amount).toBe(10.0);
      expect(result.status).toBe('paid');
      expect(result.dueDate).toEqual(new Date(1640995200 * 1000));
      expect(result.paidAt).toEqual(new Date(1640995300 * 1000));
      expect(result.items).toHaveLength(1);
      expect(result.items[0].description).toBe('Premium Tier Subscription');
      expect(result.items[0].amount).toBe(10.0);
    });

    it('should handle invoice without paid_at timestamp', async () => {
      const mockInvoice = {
        id: 'in_test123',
        subscription: 'stripe_sub123',
        amount_paid: 1000,
        status: 'open',
        due_date: 1640995200,
        created: 1640995200,
        status_transitions: {},
        lines: {
          data: [],
        },
      };

      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);

      const result = await generateInvoiceData('in_test123');

      expect(result.paidAt).toBeUndefined();
    });

    it('should throw error when invoice retrieval fails', async () => {
      // Override the global mock to throw an error
      (mockStripe.invoices.retrieve as jest.Mock).mockImplementationOnce(() => {
        return Promise.reject(new Error('Invoice not found'));
      });

      await expect(generateInvoiceData('nonexistent')).rejects.toThrow(
        'Failed to generate invoice data'
      );
    });
  });
});
