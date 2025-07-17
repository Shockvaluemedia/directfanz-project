// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tier: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
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
      list: jest.fn(),
    },
  },
}));

jest.mock('@/lib/notifications', () => ({
  sendEmail: jest.fn(),
}));

import {
  scheduleTierChange,
  syncInvoices,
  getSubscriptionInvoices,
} from '../billing';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/notifications';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe('Extended Billing Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('scheduleTierChange', () => {
    it('should schedule a tier change for the next billing cycle', async () => {
      const mockSubscription = {
        id: 'sub123',
        tierId: 'tier1',
        amount: new Decimal(10.00),
        status: 'ACTIVE',
        stripeSubscriptionId: 'stripe_sub123',
        currentPeriodEnd: new Date('2022-02-01'),
        fan: {
          email: 'fan@example.com',
        },
        tier: {
          name: 'Basic Tier',
          artist: { displayName: 'Test Artist' },
        },
      };

      const mockNewTier = {
        id: 'tier2',
        name: 'Premium Tier',
        minimumPrice: new Decimal(15.00),
        artist: { displayName: 'Test Artist' },
      };

      const mockStripeSubscription = {
        items: {
          data: [{
            id: 'si_test123',
            price: { product: 'prod_test123' },
          }],
        },
      };

      const mockInvoice = {
        id: 'invoice123',
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.tier.findUnique.mockResolvedValue(mockNewTier as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      mockStripe.subscriptions.update.mockResolvedValue({} as any);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice as any);
      mockSendEmail.mockResolvedValue(undefined);

      const result = await scheduleTierChange('sub123', 'tier2', 20.00);

      expect(result.success).toBe(true);
      expect(result.scheduledDate).toEqual(mockSubscription.currentPeriodEnd);
      expect(result.invoiceId).toBe('invoice123');

      // Verify Stripe subscription update
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'stripe_sub123',
        expect.objectContaining({
          proration_behavior: 'none',
          billing_cycle_anchor: 'unchanged',
          metadata: expect.objectContaining({
            scheduled_tier_change: 'true',
            scheduled_tier_id: 'tier2',
            scheduled_amount: '20',
          }),
        })
      );

      // Verify invoice creation
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionId: 'sub123',
          status: 'DRAFT',
          amount: new Decimal(0),
          items: expect.objectContaining({
            scheduledTierChange: expect.objectContaining({
              fromTierId: 'tier1',
              toTierId: 'tier2',
              fromAmount: 10,
              toAmount: 20,
              isUpgrade: true,
              processed: false,
            }),
          }),
        }),
      });

      // Verify notification email
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'fan@example.com',
          subject: 'Subscription Change Scheduled - Test Artist',
        })
      );
    });

    it('should throw error for inactive subscription', async () => {
      const mockSubscription = {
        id: 'sub123',
        status: 'CANCELED',
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);

      await expect(
        scheduleTierChange('sub123', 'tier2', 20.00)
      ).rejects.toThrow('Can only schedule tier changes for active subscriptions');
    });

    it('should throw error for amount below minimum', async () => {
      const mockSubscription = {
        id: 'sub123',
        status: 'ACTIVE',
        tier: { artist: { id: 'artist123' } },
      };

      const mockNewTier = {
        id: 'tier2',
        minimumPrice: new Decimal(15.00),
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.tier.findUnique.mockResolvedValue(mockNewTier as any);

      await expect(
        scheduleTierChange('sub123', 'tier2', 10.00) // Below minimum of $15
      ).rejects.toThrow('Amount is below minimum price for the new tier');
    });
  });

  describe('syncInvoices', () => {
    it('should sync invoices from Stripe to database', async () => {
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
        paidAt: new Date('2022-02-01'),
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

      // Mock dependencies
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list.mockResolvedValue(mockStripeInvoices as any);
      
      // Mock invoice retrieval
      mockStripe.invoices.retrieve
        .mockResolvedValueOnce({
          id: 'in_test1',
          subscription: 'stripe_sub123',
          amount_paid: 1000,
          status: 'paid',
          due_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
          created: Math.floor(new Date('2022-01-01').getTime() / 1000),
          lines: {
            data: [
              {
                description: 'Monthly subscription',
                amount: 1000,
                quantity: 1,
                period: {
                  start: Math.floor(new Date('2022-01-01').getTime() / 1000),
                  end: Math.floor(new Date('2022-02-01').getTime() / 1000),
                },
              },
            ],
          },
        } as any)
        .mockResolvedValueOnce({
          id: 'in_test2',
          subscription: 'stripe_sub123',
          amount_paid: 1000,
          status: 'paid',
          due_date: Math.floor(new Date('2022-02-01').getTime() / 1000),
          created: Math.floor(new Date('2022-02-01').getTime() / 1000),
          status_transitions: {
            paid_at: Math.floor(new Date('2022-02-01').getTime() / 1000),
          },
          lines: {
            data: [
              {
                description: 'Monthly subscription',
                amount: 1000,
                quantity: 1,
                period: {
                  start: Math.floor(new Date('2022-02-01').getTime() / 1000),
                  end: Math.floor(new Date('2022-03-01').getTime() / 1000),
                },
              },
            ],
          },
        } as any);
      
      // First invoice doesn't exist, second one does
      mockPrisma.invoice.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'db_invoice2' } as any);
      
      mockPrisma.invoice.create.mockResolvedValue({} as any);
      mockPrisma.invoice.update.mockResolvedValue({} as any);

      const result = await syncInvoices('sub123');

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

      // Mock dependencies
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list
        .mockResolvedValueOnce(mockStripeInvoices1 as any)
        .mockResolvedValueOnce(mockStripeInvoices2 as any);
      
      // Mock invoice retrieval
      mockStripe.invoices.retrieve
        .mockResolvedValueOnce({
          id: 'in_test1',
          subscription: 'stripe_sub123',
          amount_paid: 1000,
          status: 'paid',
          due_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
          created: Math.floor(new Date('2022-01-01').getTime() / 1000),
          lines: { data: [] },
        } as any)
        .mockResolvedValueOnce({
          id: 'in_test2',
          subscription: 'stripe_sub123',
          amount_paid: 1000,
          status: 'paid',
          due_date: Math.floor(new Date('2022-02-01').getTime() / 1000),
          created: Math.floor(new Date('2022-02-01').getTime() / 1000),
          lines: { data: [] },
        } as any);
      
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue({} as any);

      const result = await syncInvoices('sub123');

      expect(result.created).toBe(2);
      expect(result.total).toBe(2);
      expect(mockStripe.invoices.list).toHaveBeenCalledTimes(2);
      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        subscription: 'stripe_sub123',
        limit: 100,
      });
      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        subscription: 'stripe_sub123',
        limit: 100,
        starting_after: 'in_test1',
      });
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        syncInvoices('nonexistent')
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('getSubscriptionInvoices', () => {
    it('should return invoices for a subscription', async () => {
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
        items: [],
      };

      const mockInvoiceData2 = {
        id: 'in_test2',
        subscriptionId: 'stripe_sub123',
        amount: 10.00,
        status: 'paid',
        dueDate: new Date('2022-02-01'),
        items: [],
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list.mockResolvedValue(mockStripeInvoices as any);
      mockStripe.invoices.retrieve
        .mockResolvedValueOnce({
          id: 'in_test1',
          subscription: 'stripe_sub123',
          amount_paid: 1000,
          status: 'paid',
          due_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
          created: Math.floor(new Date('2022-01-01').getTime() / 1000),
          lines: { data: [] },
        } as any)
        .mockResolvedValueOnce({
          id: 'in_test2',
          subscription: 'stripe_sub123',
          amount_paid: 1000,
          status: 'paid',
          due_date: Math.floor(new Date('2022-02-01').getTime() / 1000),
          created: Math.floor(new Date('2022-02-01').getTime() / 1000),
          lines: { data: [] },
        } as any);

      const result = await getSubscriptionInvoices('sub123');

      expect(result.invoices).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        subscription: 'stripe_sub123',
        limit: 10,
      });
    });

    it('should handle pagination options', async () => {
      const mockSubscription = {
        id: 'sub123',
        stripeSubscriptionId: 'stripe_sub123',
      };

      const mockStripeInvoices = {
        data: [{ id: 'in_test1' }],
        has_more: true,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list.mockResolvedValue(mockStripeInvoices as any);
      mockStripe.invoices.retrieve.mockResolvedValue({
        id: 'in_test1',
        subscription: 'stripe_sub123',
        amount_paid: 1000,
        status: 'paid',
        due_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
        created: Math.floor(new Date('2022-01-01').getTime() / 1000),
        lines: { data: [] },
      } as any);

      const result = await getSubscriptionInvoices('sub123', {
        limit: 5,
        startingAfter: 'in_previous',
      });

      expect(result.hasMore).toBe(true);
      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        subscription: 'stripe_sub123',
        limit: 5,
        starting_after: 'in_previous',
      });
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        getSubscriptionInvoices('nonexistent')
      ).rejects.toThrow('Subscription not found');
    });

    it('should handle errors when generating invoice data', async () => {
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

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list.mockResolvedValue(mockStripeInvoices as any);
      
      // First invoice succeeds, second fails
      mockStripe.invoices.retrieve
        .mockResolvedValueOnce({
          id: 'in_test1',
          subscription: 'stripe_sub123',
          amount_paid: 1000,
          status: 'paid',
          due_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
          created: Math.floor(new Date('2022-01-01').getTime() / 1000),
          lines: { data: [] },
        } as any)
        .mockRejectedValueOnce(new Error('Invoice not found'));

      const result = await getSubscriptionInvoices('sub123');

      expect(result.invoices).toHaveLength(1); // Only the successful one
      expect(result.invoices[0].id).toBe('in_test1');
    });
  });
});