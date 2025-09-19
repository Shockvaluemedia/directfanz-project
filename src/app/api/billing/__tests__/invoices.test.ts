// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: {
      list: jest.fn(),
    },
  },
}));

jest.mock('@/lib/billing', () => ({
  generateInvoiceData: jest.fn(),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { GET } from '../invoices/route';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { generateInvoiceData } from '@/lib/billing';
import { getServerSession } from 'next-auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockGenerateInvoiceData = generateInvoiceData as jest.MockedFunction<
  typeof generateInvoiceData
>;
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

// Helper function to create mock request
function createMockRequest(url: string) {
  return new Request(url) as any;
}

describe('/api/billing/invoices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return invoices for valid subscription', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      const mockSubscription = {
        id: 'sub123',
        stripeSubscriptionId: 'stripe_sub123',
        fanId: 'fan123',
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
        items: [],
      };

      const mockInvoiceData2 = {
        id: 'in_test2',
        subscriptionId: 'stripe_sub123',
        amount: 10.0,
        status: 'paid',
        dueDate: new Date('2022-02-01'),
        items: [],
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list.mockResolvedValue(mockStripeInvoices as any);
      mockGenerateInvoiceData
        .mockResolvedValueOnce(mockInvoiceData1 as any)
        .mockResolvedValueOnce(mockInvoiceData2 as any);

      const request = createMockRequest(
        'http://localhost:3000/api/billing/invoices?subscriptionId=sub123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invoices).toHaveLength(2);
      expect(data.invoices[0].id).toBe('in_test1');
      expect(data.invoices[1].id).toBe('in_test2');
      expect(data.hasMore).toBe(false);

      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        subscription: 'stripe_sub123',
        limit: 10,
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/billing/invoices?subscriptionId=sub123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for missing subscriptionId', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockRequest('http://localhost:3000/api/billing/invoices');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing subscriptionId parameter');
    });

    it('should return 404 for subscription not found', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/billing/invoices?subscriptionId=sub123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Subscription not found');
    });

    it('should handle invoice generation errors gracefully', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      const mockSubscription = {
        id: 'sub123',
        stripeSubscriptionId: 'stripe_sub123',
        fanId: 'fan123',
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
        items: [],
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.list.mockResolvedValue(mockStripeInvoices as any);
      mockGenerateInvoiceData
        .mockResolvedValueOnce(mockInvoiceData1 as any)
        .mockRejectedValueOnce(new Error('Invoice generation failed'));

      const request = createMockRequest(
        'http://localhost:3000/api/billing/invoices?subscriptionId=sub123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invoices).toHaveLength(1); // Only successful one
      expect(data.invoices[0].id).toBe('in_test1');
    });

    it('should return 500 for server errors', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscription.findUnique.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest(
        'http://localhost:3000/api/billing/invoices?subscriptionId=sub123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to retrieve invoices');
    });
  });
});
