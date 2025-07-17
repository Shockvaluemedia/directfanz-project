// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
    },
    paymentFailure: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/payment-retry', () => ({
  retryPayment: jest.fn(),
  getPaymentFailures: jest.fn(),
  getArtistPaymentFailures: jest.fn(),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { GET, POST } from '../retry/route';
import { prisma } from '@/lib/prisma';
import { 
  retryPayment, 
  getPaymentFailures,
  getArtistPaymentFailures
} from '@/lib/payment-retry';
import { getServerSession } from 'next-auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRetryPayment = retryPayment as jest.MockedFunction<typeof retryPayment>;
const mockGetPaymentFailures = getPaymentFailures as jest.MockedFunction<typeof getPaymentFailures>;
const mockGetArtistPaymentFailures = getArtistPaymentFailures as jest.MockedFunction<typeof getArtistPaymentFailures>;
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

// Helper functions to create mock requests
function createMockGetRequest(url: string) {
  return new Request(url) as any;
}

function createMockPostRequest(url: string, body: any) {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any;
}

describe('/api/payments/retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should get payment failures for a subscription', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      const mockSubscription = {
        id: 'sub123',
        fanId: 'user123',
      };

      const mockFailures = [
        { id: 'pf_1', subscriptionId: 'sub123' },
        { id: 'pf_2', subscriptionId: 'sub123' },
      ];

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);
      mockGetPaymentFailures.mockResolvedValue(mockFailures as any);

      const request = createMockGetRequest('http://localhost:3000/api/payments/retry?subscriptionId=sub123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.failures).toEqual(mockFailures);
      expect(mockGetPaymentFailures).toHaveBeenCalledWith('sub123');
    });

    it('should get payment failures for an artist', async () => {
      const mockSession = {
        user: { id: 'artist123', role: 'ARTIST' },
      };

      const mockFailures = [
        { id: 'pf_1', subscription: { fanId: 'fan1' } },
        { id: 'pf_2', subscription: { fanId: 'fan2' } },
      ];

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockGetArtistPaymentFailures.mockResolvedValue(mockFailures as any);

      const request = createMockGetRequest('http://localhost:3000/api/payments/retry?artistId=artist123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.failures).toEqual(mockFailures);
      expect(mockGetArtistPaymentFailures).toHaveBeenCalledWith('artist123');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockGetRequest('http://localhost:3000/api/payments/retry?subscriptionId=sub123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for missing parameters', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockGetRequest('http://localhost:3000/api/payments/retry');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing subscriptionId or artistId parameter');
    });

    it('should return 404 for subscription not found', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const request = createMockGetRequest('http://localhost:3000/api/payments/retry?subscriptionId=sub123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Subscription not found');
    });

    it('should return 403 for unauthorized artist access', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockGetRequest('http://localhost:3000/api/payments/retry?artistId=artist123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('POST', () => {
    it('should retry payment successfully', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      const mockFailure = {
        id: 'pf_123',
        subscription: {
          fanId: 'user123',
          artistId: 'artist123',
        },
      };

      const mockRetryResult = {
        success: true,
        resolved: true,
        attemptCount: 2,
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.paymentFailure.findUnique.mockResolvedValue(mockFailure as any);
      mockRetryPayment.mockResolvedValue(mockRetryResult as any);

      const request = createMockPostRequest('http://localhost:3000/api/payments/retry', {
        paymentFailureId: 'pf_123',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.resolved).toBe(true);
      expect(data.attemptCount).toBe(2);
      expect(data.message).toBe('Payment processed successfully');
      expect(mockRetryPayment).toHaveBeenCalledWith('pf_123');
    });

    it('should handle failed payment retry', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      const mockFailure = {
        id: 'pf_123',
        subscription: {
          fanId: 'user123',
          artistId: 'artist123',
        },
      };

      const mockRetryResult = {
        success: false,
        resolved: false,
        nextRetryAt: new Date('2022-01-01'),
        attemptCount: 2,
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.paymentFailure.findUnique.mockResolvedValue(mockFailure as any);
      mockRetryPayment.mockResolvedValue(mockRetryResult as any);

      const request = createMockPostRequest('http://localhost:3000/api/payments/retry', {
        paymentFailureId: 'pf_123',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.resolved).toBe(false);
      expect(data.nextRetryAt).toEqual('2022-01-01T00:00:00.000Z');
      expect(data.message).toBe('Payment retry failed, will try again later');
    });

    it('should handle subscription cancellation due to repeated failures', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      const mockFailure = {
        id: 'pf_123',
        subscription: {
          fanId: 'user123',
          artistId: 'artist123',
        },
      };

      const mockRetryResult = {
        success: false,
        resolved: true,
        attemptCount: 3,
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.paymentFailure.findUnique.mockResolvedValue(mockFailure as any);
      mockRetryPayment.mockResolvedValue(mockRetryResult as any);

      const request = createMockPostRequest('http://localhost:3000/api/payments/retry', {
        paymentFailureId: 'pf_123',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.resolved).toBe(true);
      expect(data.message).toBe('Subscription canceled due to repeated payment failures');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockPostRequest('http://localhost:3000/api/payments/retry', {
        paymentFailureId: 'pf_123',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for missing paymentFailureId', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockPostRequest('http://localhost:3000/api/payments/retry', {});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing paymentFailureId parameter');
    });

    it('should return 404 for payment failure not found', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.paymentFailure.findUnique.mockResolvedValue(null);

      const request = createMockPostRequest('http://localhost:3000/api/payments/retry', {
        paymentFailureId: 'pf_123',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Payment failure not found');
    });

    it('should return 403 for unauthorized access', async () => {
      const mockSession = {
        user: { id: 'user123', role: 'FAN' },
      };

      const mockFailure = {
        id: 'pf_123',
        subscription: {
          fanId: 'other_user',
          artistId: 'other_artist',
        },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.paymentFailure.findUnique.mockResolvedValue(mockFailure as any);

      const request = createMockPostRequest('http://localhost:3000/api/payments/retry', {
        paymentFailureId: 'pf_123',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });
  });
});