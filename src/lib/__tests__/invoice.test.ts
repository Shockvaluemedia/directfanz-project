// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    invoice: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: {
      retrieve: jest.fn(),
      retrieveUpcoming: jest.fn(),
      pay: jest.fn(),
    },
  },
}));

jest.mock('@/lib/notifications', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/lib/billing', () => ({
  generateInvoiceData: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import {
  createInvoice,
  updateInvoice,
  getInvoices,
  getInvoiceById,
  generateAndStoreInvoice,
  sendInvoiceNotification,
  processInvoicePayment,
  getUpcomingInvoice,
} from '../invoice';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/notifications';
import { generateInvoiceData } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockGenerateInvoiceData = generateInvoiceData as jest.MockedFunction<typeof generateInvoiceData>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Invoice Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('createInvoice', () => {
    it('should create an invoice in the database', async () => {
      const mockInvoiceData = {
        id: 'inv_123',
        subscriptionId: 'sub_123',
        stripeInvoiceId: 'in_stripe_123',
        amount: 10.00,
        status: 'OPEN' as const,
        dueDate: new Date('2022-01-01'),
        periodStart: new Date('2022-01-01'),
        periodEnd: new Date('2022-02-01'),
        items: [{ description: 'Monthly subscription' }],
      };

      mockPrisma.invoice.create.mockResolvedValue(mockInvoiceData as any);

      const result = await createInvoice({
        subscriptionId: 'sub_123',
        stripeInvoiceId: 'in_stripe_123',
        amount: 10.00,
        status: 'OPEN',
        dueDate: new Date('2022-01-01'),
        periodStart: new Date('2022-01-01'),
        periodEnd: new Date('2022-02-01'),
        items: [{ description: 'Monthly subscription' }],
      });

      expect(result).toEqual(mockInvoiceData);
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: 'sub_123',
          stripeInvoiceId: 'in_stripe_123',
          amount: new Decimal(10.00),
          status: 'OPEN',
          dueDate: new Date('2022-01-01'),
          paidAt: undefined,
          periodStart: new Date('2022-01-01'),
          periodEnd: new Date('2022-02-01'),
          prorationAmount: null,
          items: [{ description: 'Monthly subscription' }],
        },
      });
    });

    it('should handle errors when creating an invoice', async () => {
      mockPrisma.invoice.create.mockRejectedValue(new Error('Database error'));

      await expect(
        createInvoice({
          subscriptionId: 'sub_123',
          stripeInvoiceId: 'in_stripe_123',
          amount: 10.00,
          status: 'OPEN',
          dueDate: new Date('2022-01-01'),
          periodStart: new Date('2022-01-01'),
          periodEnd: new Date('2022-02-01'),
          items: [],
        })
      ).rejects.toThrow('Failed to create invoice');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateInvoice', () => {
    it('should update an invoice in the database', async () => {
      const mockInvoiceData = {
        id: 'inv_123',
        amount: new Decimal(15.00),
        status: 'PAID',
      };

      mockPrisma.invoice.update.mockResolvedValue(mockInvoiceData as any);

      const result = await updateInvoice('inv_123', {
        amount: 15.00,
        status: 'PAID',
      });

      expect(result).toEqual(mockInvoiceData);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_123' },
        data: {
          amount: new Decimal(15.00),
          status: 'PAID',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle errors when updating an invoice', async () => {
      mockPrisma.invoice.update.mockRejectedValue(new Error('Database error'));

      await expect(
        updateInvoice('inv_123', { status: 'PAID' })
      ).rejects.toThrow('Failed to update invoice');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getInvoices', () => {
    it('should get invoices with filters', async () => {
      const mockInvoices = [
        { id: 'inv_1', amount: new Decimal(10.00) },
        { id: 'inv_2', amount: new Decimal(15.00) },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any);

      const result = await getInvoices({
        subscriptionId: 'sub_123',
        status: 'PAID',
        limit: 10,
      });

      expect(result).toEqual(mockInvoices);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
        where: {
          subscriptionId: 'sub_123',
          status: 'PAID',
        },
        orderBy: {
          dueDate: 'desc',
        },
        skip: 0,
        take: 10,
        include: expect.any(Object),
      });
    });

    it('should handle date range filters', async () => {
      const startDate = new Date('2022-01-01');
      const endDate = new Date('2022-01-31');
      
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await getInvoices({
        startDate,
        endDate,
      });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
        where: {
          dueDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          dueDate: 'desc',
        },
        skip: 0,
        take: 10,
        include: expect.any(Object),
      });
    });

    it('should handle errors when getting invoices', async () => {
      mockPrisma.invoice.findMany.mockRejectedValue(new Error('Database error'));

      await expect(
        getInvoices({})
      ).rejects.toThrow('Failed to get invoices');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getInvoiceById', () => {
    it('should get an invoice by ID', async () => {
      const mockInvoice = {
        id: 'inv_123',
        amount: new Decimal(10.00),
        subscription: {
          fan: { id: 'fan_123', email: 'fan@example.com' },
          tier: { name: 'Premium' },
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      const result = await getInvoiceById('inv_123');

      expect(result).toEqual(mockInvoice);
      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv_123' },
        include: expect.any(Object),
      });
    });

    it('should throw error if invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        getInvoiceById('nonexistent')
      ).rejects.toThrow('Invoice not found');
    });

    it('should handle errors when getting an invoice', async () => {
      mockPrisma.invoice.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(
        getInvoiceById('inv_123')
      ).rejects.toThrow('Failed to get invoice');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('generateAndStoreInvoice', () => {
    it('should create a new invoice from Stripe data', async () => {
      const mockInvoiceData = {
        id: 'in_stripe_123',
        subscriptionId: 'stripe_sub_123',
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
            },
          },
        ],
      };

      const mockSubscription = {
        id: 'sub_123',
        stripeSubscriptionId: 'stripe_sub_123',
      };

      mockGenerateInvoiceData.mockResolvedValue(mockInvoiceData as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv_123' } as any);

      const result = await generateAndStoreInvoice('in_stripe_123');

      expect(result).toEqual({ id: 'inv_123' });
      expect(mockPrisma.invoice.create).toHaveBeenCalled();
    });

    it('should update an existing invoice', async () => {
      const mockInvoiceData = {
        id: 'in_stripe_123',
        subscriptionId: 'stripe_sub_123',
        amount: 10.00,
        status: 'paid',
        dueDate: new Date('2022-01-01'),
        paidAt: new Date('2022-01-01'),
        items: [],
      };

      const mockSubscription = {
        id: 'sub_123',
        stripeSubscriptionId: 'stripe_sub_123',
      };

      const existingInvoice = {
        id: 'inv_123',
        stripeInvoiceId: 'in_stripe_123',
      };

      mockGenerateInvoiceData.mockResolvedValue(mockInvoiceData as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.invoice.findUnique.mockResolvedValue(existingInvoice as any);
      mockPrisma.invoice.update.mockResolvedValue({ id: 'inv_123', updated: true } as any);

      const result = await generateAndStoreInvoice('in_stripe_123');

      expect(result).toEqual({ id: 'inv_123', updated: true });
      expect(mockPrisma.invoice.update).toHaveBeenCalled();
    });

    it('should handle proration items', async () => {
      const mockInvoiceData = {
        id: 'in_stripe_123',
        subscriptionId: 'stripe_sub_123',
        amount: 15.00,
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
            },
          },
          {
            description: 'Proration adjustment',
            amount: 5.00,
            quantity: 1,
            period: {
              start: new Date('2022-01-01'),
              end: new Date('2022-01-15'),
            },
          },
        ],
      };

      const mockSubscription = {
        id: 'sub_123',
        stripeSubscriptionId: 'stripe_sub_123',
      };

      mockGenerateInvoiceData.mockResolvedValue(mockInvoiceData as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv_123' } as any);

      await generateAndStoreInvoice('in_stripe_123');

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          prorationAmount: new Decimal(5.00),
        }),
      });
    });

    it('should throw error if subscription not found', async () => {
      mockGenerateInvoiceData.mockResolvedValue({
        id: 'in_stripe_123',
        subscriptionId: 'stripe_sub_123',
      } as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        generateAndStoreInvoice('in_stripe_123')
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('sendInvoiceNotification', () => {
    it('should send invoice notification email', async () => {
      const mockInvoice = {
        id: 'inv_123',
        amount: new Decimal(10.00),
        status: 'PAID',
        dueDate: new Date('2022-01-01'),
        subscription: {
          fan: {
            id: 'fan_123',
            email: 'fan@example.com',
            notificationPreferences: { billing: true },
          },
          tier: {
            name: 'Premium',
          },
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      mockSendEmail.mockResolvedValue(undefined);

      await sendInvoiceNotification('inv_123');

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'fan@example.com',
        subject: 'Invoice Receipt - Premium Subscription',
        html: expect.stringContaining('Invoice Receipt'),
        text: expect.stringContaining('Invoice Receipt'),
      });
    });

    it('should skip notification if email not available', async () => {
      const mockInvoice = {
        id: 'inv_123',
        subscription: {
          fan: {
            id: 'fan_123',
            email: null,
          },
          tier: {
            name: 'Premium',
          },
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      await sendInvoiceNotification('inv_123');

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should skip notification if billing notifications disabled', async () => {
      const mockInvoice = {
        id: 'inv_123',
        subscription: {
          fan: {
            id: 'fan_123',
            email: 'fan@example.com',
            notificationPreferences: { billing: false },
          },
          tier: {
            name: 'Premium',
          },
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      await sendInvoiceNotification('inv_123');

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('processInvoicePayment', () => {
    it('should process payment for an invoice', async () => {
      const mockInvoice = {
        id: 'inv_123',
        stripeInvoiceId: 'in_stripe_123',
        status: 'OPEN',
        subscription: {
          fan: {
            email: 'fan@example.com',
          },
          tier: {
            name: 'Premium',
          },
        },
      };

      const updatedInvoice = {
        ...mockInvoice,
        status: 'PAID',
        paidAt: new Date(),
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      mockStripe.invoices.pay.mockResolvedValue({} as any);
      mockPrisma.invoice.update.mockResolvedValue(updatedInvoice as any);
      mockSendEmail.mockResolvedValue(undefined);

      const result = await processInvoicePayment('inv_123');

      expect(result.success).toBe(true);
      expect(result.invoice).toEqual(updatedInvoice);
      expect(mockStripe.invoices.pay).toHaveBeenCalledWith('in_stripe_123');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_123' },
        data: {
          status: 'PAID',
          paidAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should skip payment if invoice already paid', async () => {
      const mockInvoice = {
        id: 'inv_123',
        status: 'PAID',
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      const result = await processInvoicePayment('inv_123');

      expect(result.success).toBe(true);
      expect(result.alreadyPaid).toBe(true);
      expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
    });
  });

  describe('getUpcomingInvoice', () => {
    it('should get upcoming invoice for a subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        stripeSubscriptionId: 'stripe_sub_123',
      };

      const mockStripeInvoice = {
        amount_due: 1000, // $10.00
        status: 'draft',
        due_date: Math.floor(new Date('2022-02-01').getTime() / 1000),
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
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.retrieveUpcoming.mockResolvedValue(mockStripeInvoice as any);

      const result = await getUpcomingInvoice('sub_123');

      expect(result.id).toBe('upcoming');
      expect(result.subscriptionId).toBe('stripe_sub_123');
      expect(result.amount).toBe(10.00);
      expect(result.status).toBe('draft');
      expect(result.dueDate).toEqual(new Date('2022-02-01'));
      expect(result.items).toHaveLength(1);
      expect(result.items[0].description).toBe('Monthly subscription');
      expect(result.items[0].amount).toBe(10.00);
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        getUpcomingInvoice('nonexistent')
      ).rejects.toThrow('Subscription not found');
    });
  });
});