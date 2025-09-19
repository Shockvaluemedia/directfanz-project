import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
jest.mock('next-auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    subscription: {
      findMany: jest.fn(),
    },
  },
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/fan/subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/fan/subscriptions');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user is not a fan', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'ARTIST' },
        expires: '2024-01-01',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'ARTIST',
        displayName: 'Test Artist',
        bio: null,
        avatar: null,
        socialLinks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/fan/subscriptions');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only fans can view subscriptions');
    });

    it('should return fan subscriptions', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'fan-1', email: 'fan@example.com', role: 'FAN' },
        expires: '2024-01-01',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'fan-1',
        email: 'fan@example.com',
        role: 'FAN',
        displayName: 'Test Fan',
        bio: null,
        avatar: null,
        socialLinks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockSubscriptions = [
        {
          id: 'sub-1',
          fanId: 'fan-1',
          artistId: 'artist-1',
          tierId: 'tier-1',
          stripeSubscriptionId: 'sub_stripe123',
          amount: 10.0,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          tier: {
            id: 'tier-1',
            name: 'Basic',
            description: 'Basic tier',
            minimumPrice: 5.0,
            artist: {
              id: 'artist-1',
              displayName: 'Test Artist',
              avatar: null,
            },
          },
        },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions);

      const request = new NextRequest('http://localhost:3000/api/fan/subscriptions');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.subscriptions).toHaveLength(1);
      expect(data.data.subscriptions[0].id).toBe('sub-1');
      expect(data.data.subscriptions[0].users.displayName).toBe('Test Artist');
    });

    it('should return empty array if fan has no subscriptions', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'fan-1', email: 'fan@example.com', role: 'FAN' },
        expires: '2024-01-01',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'fan-1',
        email: 'fan@example.com',
        role: 'FAN',
        displayName: 'Test Fan',
        bio: null,
        avatar: null,
        socialLinks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/fan/subscriptions');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.subscriptions).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'fan-1', email: 'fan@example.com', role: 'FAN' },
        expires: '2024-01-01',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'fan-1',
        email: 'fan@example.com',
        role: 'FAN',
        displayName: 'Test Fan',
        bio: null,
        avatar: null,
        socialLinks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.subscription.findMany.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/fan/subscriptions');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch subscriptions');
    });
  });
});
