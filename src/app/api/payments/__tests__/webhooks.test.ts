// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptions: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tiers: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    artists: {
      update: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment_failures: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

jest.mock('next/headers', () => ({
  headers: jest.fn(() => ({
    get: jest.fn(() => 'test-signature'),
  })),
}));

jest.mock('@/lib/notifications', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '../webhooks/route';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStripe = stripe as jest.Mocked<typeof stripe>;

// Helper function to create mock request
function createMockRequest(url: string, options: any = {}) {
  return new Request(url, options) as any;
}

describe('/api/payments/webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  describe('POST', () => {
    it('should handle checkout.session.completed event', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {
              fanId: 'fan123',
              artistId: 'artist123',
              tierId: 'tier123',
              amount: '10.00',
            },
            subscription: 'sub_test123',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscriptions.create.mockResolvedValue({} as any);
      mockPrisma.tiers.update.mockResolvedValue({} as any);
      mockPrisma.tiers.findUnique.mockResolvedValue({ id: 'tier123', name: 'Gold' } as any);
      mockPrisma.artists.update.mockResolvedValue({} as any);
      mockPrisma.users.findUnique.mockResolvedValue({ id: 'fan123', email: 'fan@test.com', displayName: 'Test Artist' } as any);

      const request = createMockRequest('http://localhost:3000/api/payments/webhooks', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockPrisma.subscriptions.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          fanId: 'fan123',
          artistId: 'artist123',
          tierId: 'tier123',
          stripeSubscriptionId: 'sub_test123',
          amount: 10.0,
          status: 'ACTIVE',
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle invoice.payment_succeeded event', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_test123',
            amount_paid: 1000, // $10.00 in cents
            period_start: 1640995200, // Jan 1, 2022
            period_end: 1643673600, // Feb 1, 2022
          },
        },
      };

      const mockSubscription = {
        id: 'subscription123',
        artistId: 'artist123',
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);
      mockPrisma.artists.update.mockResolvedValue({} as any);

      const request = createMockRequest('http://localhost:3000/api/payments/webhooks', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
        where: { id: 'subscription123' },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(1640995200 * 1000),
          currentPeriodEnd: new Date(1643673600 * 1000),
        },
      });
      expect(mockPrisma.artists.update).toHaveBeenCalledWith({
        where: { userId: 'artist123' },
        data: {
          totalEarnings: {
            increment: 9.5, // $10.00 - 5% platform fee
          },
        },
      });
    });

    it('should handle invoice.payment_failed event', async () => {
      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test123',
            subscription: 'sub_test123',
            amount_due: 1000,
            attempt_count: 2,
            next_payment_attempt: 1640995200,
            last_finalization_error: {
              message: 'Your card was declined.',
            },
          },
        },
      };

      const mockSubscription = {
        id: 'subscription123',
        users: { id: 'fan123', email: 'fan@test.com' },
        tiers: {
          name: 'Gold Tier',
          users: { id: 'artist123', displayName: 'Test Artist' },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);
      mockPrisma.payment_failures.create.mockResolvedValue({} as any);

      const request = createMockRequest('http://localhost:3000/api/payments/webhooks', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
        where: { id: 'subscription123' },
        data: { status: 'PAST_DUE' },
      });
      expect(mockPrisma.payment_failures.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          subscriptionId: 'subscription123',
          stripeInvoiceId: 'in_test123',
          amount: 10.0,
          attemptCount: 2,
          nextRetryAt: new Date(1640995200 * 1000),
          failureReason: 'Your card was declined.',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle customer.subscription.deleted event', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
          },
        },
      };

      const mockSubscription = {
        id: 'subscription123',
        tierId: 'tier123',
        artistId: 'artist123',
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscriptions.update.mockResolvedValue({} as any);
      mockPrisma.tiers.update.mockResolvedValue({} as any);
      mockPrisma.artists.update.mockResolvedValue({} as any);

      const request = createMockRequest('http://localhost:3000/api/payments/webhooks', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
        where: { id: 'subscription123' },
        data: { status: 'CANCELED' },
      });
      expect(mockPrisma.tiers.update).toHaveBeenCalledWith({
        where: { id: 'tier123' },
        data: {
          subscriberCount: {
            decrement: 1,
          },
        },
      });
    });

    it('should return 400 for missing signature', async () => {
      // Temporarily override the headers mock
      const originalMock = require('next/headers');
      jest.doMock('next/headers', () => ({
        headers: jest.fn(() => ({
          get: jest.fn(() => null),
        })),
      }));

      // Re-import the module to get the new mock
      jest.resetModules();
      const { POST: POSTWithoutSignature } = require('../webhooks/route');

      const request = createMockRequest('http://localhost:3000/api/payments/webhooks', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POSTWithoutSignature(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing stripe-signature header');

      // Restore original mock
      jest.doMock('next/headers', () => originalMock);
    });

    it('should return 400 for invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = createMockRequest('http://localhost:3000/api/payments/webhooks', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid signature');
    });

    it('should handle unrecognized event types gracefully', async () => {
      const mockEvent = {
        type: 'unknown.event.type',
        data: {
          object: {},
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const request = createMockRequest('http://localhost:3000/api/payments/webhooks', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });
  });
});
