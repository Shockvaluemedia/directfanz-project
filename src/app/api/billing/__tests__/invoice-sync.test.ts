// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/billing', () => ({
  syncInvoices: jest.fn(),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { POST } from '../invoices/sync/route';
import { prisma } from '@/lib/prisma';
import { syncInvoices } from '@/lib/billing';
import { getServerSession } from 'next-auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockSyncInvoices = syncInvoices as jest.MockedFunction<typeof syncInvoices>;
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

// Helper function to create mock request
function createMockRequest(body: any) {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as any;
}

describe('/api/billing/invoices/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should sync invoices for valid subscription', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      const mockSubscription = {
        id: 'sub123',
        fanId: 'fan123',
      };

      const mockSyncResult = {
        created: 2,
        updated: 1,
        total: 3,
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockSyncInvoices.mockResolvedValue(mockSyncResult);

      const request = createMockRequest({ subscriptionId: 'sub123' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Invoices synced successfully');
      expect(data.result).toEqual(mockSyncResult);
      expect(mockSyncInvoices).toHaveBeenCalledWith('sub123');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest({ subscriptionId: 'sub123' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for missing subscriptionId', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockRequest({});
      const response = await POST(request);
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

      const request = createMockRequest({ subscriptionId: 'sub123' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Subscription not found');
    });

    it('should return 500 for server errors', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      const mockSubscription = {
        id: 'sub123',
        fanId: 'fan123',
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockSyncInvoices.mockRejectedValue(new Error('Sync failed'));

      const request = createMockRequest({ subscriptionId: 'sub123' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to sync invoices');
    });
  });
});
