// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment_failures: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscriptions: {
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: {
      retrieve: jest.fn(),
      pay: jest.fn(),
    },
    subscriptions: {
      cancel: jest.fn(),
    },
  },
}));

jest.mock('@/lib/notifications', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import {
  createPaymentFailure,
  retryPayment,
  getPaymentFailures,
  getArtistPaymentFailures,
} from '../payment-retry';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Payment Retry Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('createPaymentFailure', () => {
    it('should create a new payment failure record', async () => {
      const mockFailure = {
        id: 'pf_123',
        subscriptionId: 'sub_123',
        stripeInvoiceId: 'in_123',
        amount: new Decimal(10.0),
        failureReason: 'Card declined',
        nextRetryAt: expect.any(Date),
      };

      mockPrisma.payment_failures.findUnique.mockResolvedValue(null);
      mockPrisma.payment_failures.create.mockResolvedValue(mockFailure as any);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);

      const result = await createPaymentFailure('sub_123', 'in_123', 10.0, 'Card declined');

      expect(result).toEqual(mockFailure);
      expect(mockPrisma.payment_failures.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          subscriptionId: 'sub_123',
          stripeInvoiceId: 'in_123',
          amount: new Decimal(10.0),
          failureReason: 'Card declined',
          nextRetryAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
        where: { id: 'sub_123' },
        data: { status: 'PAST_DUE' },
      });
    });

    it('should update an existing payment failure record', async () => {
      const existingFailure = {
        id: 'pf_123',
        attemptCount: 1,
      };

      const updatedFailure = {
        id: 'pf_123',
        attemptCount: 2,
        failureReason: 'Card declined',
        nextRetryAt: expect.any(Date),
      };

      mockPrisma.payment_failures.findUnique.mockResolvedValue(existingFailure as any);
      mockPrisma.payment_failures.update.mockResolvedValue(updatedFailure as any);

      const result = await createPaymentFailure('sub_123', 'in_123', 10.0, 'Card declined');

      expect(result).toEqual(updatedFailure);
      expect(mockPrisma.payment_failures.update).toHaveBeenCalledWith({
        where: { id: 'pf_123' },
        data: {
          attemptCount: { increment: 1 },
          failureReason: 'Card declined',
          nextRetryAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle errors', async () => {
      mockPrisma.payment_failures.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(
        createPaymentFailure('sub_123', 'in_123', 10.0, 'Card declined')
      ).rejects.toThrow('Failed to create payment failure record');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('retryPayment', () => {
    it('should handle already resolved payment failures', async () => {
      const mockFailure = {
        id: 'pf_123',
        isResolved: true,
        attemptCount: 1,
      };

      mockPrisma.payment_failures.findUnique.mockResolvedValue(mockFailure as any);

      const result = await retryPayment('pf_123');

      expect(result.success).toBe(true);
      expect(result.resolved).toBe(true);
      expect(result.attemptCount).toBe(1);
      expect(mockStripe.invoices.retrieve).not.toHaveBeenCalled();
    });

    it('should handle already paid invoices', async () => {
      const mockFailure = {
        id: 'pf_123',
        isResolved: false,
        attemptCount: 1,
        stripeInvoiceId: 'in_123',
        subscriptionId: 'sub_123',
        subscriptions: {
          id: 'sub_123',
        },
      };

      const mockInvoice = {
        id: 'in_123',
        status: 'paid',
      };

      mockPrisma.payment_failures.findUnique.mockResolvedValue(mockFailure as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockPrisma.payment_failures.update.mockResolvedValue({} as any);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);

      const result = await retryPayment('pf_123');

      expect(result.success).toBe(true);
      expect(result.resolved).toBe(true);
      expect(mockPrisma.payment_failures.update).toHaveBeenCalledWith({
        where: { id: 'pf_123' },
        data: {
          isResolved: true,
          updatedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
        where: { id: 'sub_123' },
        data: { status: 'ACTIVE' },
      });
    });

    it('should successfully retry payment', async () => {
      const mockFailure = {
        id: 'pf_123',
        isResolved: false,
        attemptCount: 1,
        stripeInvoiceId: 'in_123',
        subscriptionId: 'sub_123',
        amount: new Decimal(10.0),
        subscriptions: {
          id: 'sub_123',
          users: {
            email: 'fan@example.com',
            notificationPreferences: { billing: true },
          },
          tiers: {
            name: 'Premium',
            users: { displayName: 'Test Artist' },
          },
        },
      };

      const mockInvoice = {
        id: 'in_123',
        status: 'open',
      };

      mockPrisma.payment_failures.findUnique.mockResolvedValue(mockFailure as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockStripe.invoices.pay.mockResolvedValue({} as any);
      mockPrisma.payment_failures.update.mockResolvedValue({} as any);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue(undefined);

      const result = await retryPayment('pf_123');

      expect(result.success).toBe(true);
      expect(result.resolved).toBe(true);
      expect(result.attemptCount).toBe(2);
      expect(mockStripe.invoices.pay).toHaveBeenCalledWith('in_123');
      expect(mockPrisma.payment_failures.update).toHaveBeenCalledWith({
        where: { id: 'pf_123' },
        data: {
          isResolved: true,
          updatedAt: expect.any(Date),
        },
      });
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it('should handle payment retry failure with max attempts reached', async () => {
      const mockFailure = {
        id: 'pf_123',
        isResolved: false,
        attemptCount: 2, // Already tried twice
        stripeInvoiceId: 'in_123',
        subscriptionId: 'sub_123',
        subscriptions: {
          id: 'sub_123',
          stripeSubscriptionId: 'stripe_sub_123',
          users: {
            email: 'fan@example.com',
            notificationPreferences: { billing: true },
          },
          tiers: {
            name: 'Premium',
            artistId: 'artist_123',
            users: { displayName: 'Test Artist' },
          },
        },
      };

      const mockInvoice = {
        id: 'in_123',
        status: 'open',
      };

      mockPrisma.payment_failures.findUnique.mockResolvedValue(mockFailure as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockStripe.invoices.pay.mockRejectedValue(new Error('Payment failed'));
      mockStripe.subscriptions.cancel.mockResolvedValue({} as any);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);
      mockPrisma.payment_failures.update.mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue(undefined);

      const result = await retryPayment('pf_123');

      expect(result.success).toBe(false);
      expect(result.resolved).toBe(true);
      expect(result.attemptCount).toBe(3);
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('stripe_sub_123');
      expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
        where: { id: 'sub_123' },
        data: { status: 'CANCELED' },
      });
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it('should handle payment retry failure with attempts remaining', async () => {
      const mockFailure = {
        id: 'pf_123',
        isResolved: false,
        attemptCount: 1, // First attempt
        stripeInvoiceId: 'in_123',
        subscriptionId: 'sub_123',
        subscriptions: {
          id: 'sub_123',
        },
      };

      const mockInvoice = {
        id: 'in_123',
        status: 'open',
      };

      mockPrisma.payment_failures.findUnique.mockResolvedValue(mockFailure as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockStripe.invoices.pay.mockRejectedValue(new Error('Payment failed'));
      mockPrisma.payment_failures.update.mockResolvedValue({} as any);

      const result = await retryPayment('pf_123');

      expect(result.success).toBe(false);
      expect(result.resolved).toBe(false);
      expect(result.attemptCount).toBe(2);
      expect(result.nextRetryAt).toBeInstanceOf(Date);
      expect(mockPrisma.payment_failures.update).toHaveBeenCalledWith({
        where: { id: 'pf_123' },
        data: {
          attemptCount: 2,
          nextRetryAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw error if payment failure not found', async () => {
      mockPrisma.payment_failures.findUnique.mockResolvedValue(null);

      await expect(retryPayment('nonexistent')).rejects.toThrow('Payment failure record not found');
    });
  });

  describe('getPaymentFailures', () => {
    it('should get payment failures for a subscription', async () => {
      const mockFailures = [
        { id: 'pf_1', subscriptionId: 'sub_123' },
        { id: 'pf_2', subscriptionId: 'sub_123' },
      ];

      mockPrisma.payment_failures.findMany.mockResolvedValue(mockFailures as any);

      const result = await getPaymentFailures('sub_123');

      expect(result).toEqual(mockFailures);
      expect(mockPrisma.payment_failures.findMany).toHaveBeenCalledWith({
        where: { subscriptionId: 'sub_123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle errors', async () => {
      mockPrisma.payment_failures.findMany.mockRejectedValue(new Error('Database error'));

      await expect(getPaymentFailures('sub_123')).rejects.toThrow('Failed to get payment failures');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getArtistPaymentFailures', () => {
    it('should get active payment failures for an artist', async () => {
      const mockFailures = [
        {
          id: 'pf_1',
          subscriptions: {
            users: { id: 'fan_1' },
            tiers: { name: 'Premium' },
          },
        },
      ];

      mockPrisma.payment_failures.findMany.mockResolvedValue(mockFailures as any);

      const result = await getArtistPaymentFailures('artist_123');

      expect(result).toEqual(mockFailures);
      expect(mockPrisma.payment_failures.findMany).toHaveBeenCalledWith({
        where: {
          isResolved: false,
          subscriptions: {
            artistId: 'artist_123',
          },
        },
        include: expect.any(Object),
        orderBy: { nextRetryAt: 'asc' },
      });
    });

    it('should handle errors', async () => {
      mockPrisma.payment_failures.findMany.mockRejectedValue(new Error('Database error'));

      await expect(getArtistPaymentFailures('artist_123')).rejects.toThrow(
        'Failed to get artist payment failures'
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
