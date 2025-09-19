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
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/fan/artists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/fan/artists');
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

      const request = new NextRequest('http://localhost:3000/api/fan/artists');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only fans can discover artists');
    });

    it('should return artists with pagination for authenticated fan', async () => {
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

      const mockArtists = [
        {
          id: 'artist-1',
          displayName: 'Test Artist',
          bio: 'Test bio',
          avatar: null,
          socialLinks: null,
          createdAt: new Date(),
          artists: {
            totalSubscribers: 10,
            totalEarnings: '100.00',
          },
          tiers: [
            {
              id: 'tier-1',
              name: 'Basic',
              description: 'Basic tier',
              minimumPrice: '5.00',
              subscriberCount: 5,
            },
          ],
          content: [
            {
              id: 'content-1',
              title: 'Test Song',
              type: 'AUDIO',
              thumbnailUrl: null,
              createdAt: new Date(),
            },
          ],
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockArtists);
      mockPrisma.user.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/fan/artists');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.artists).toHaveLength(1);
      expect(data.artists[0].displayName).toBe('Test Artist');
      expect(data.pagination.total).toBe(1);
      expect(data.pagination.hasMore).toBe(false);
    });

    it('should filter artists by search term', async () => {
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

      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/fan/artists?search=rock');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                displayName: {
                  contains: 'rock',
                  mode: 'insensitive',
                },
              },
              {
                bio: {
                  contains: 'rock',
                  mode: 'insensitive',
                },
              },
            ],
          }),
        })
      );
    });

    it('should handle pagination parameters', async () => {
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

      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/fan/artists?limit=10&offset=20');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('should return 400 for invalid pagination parameters', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/fan/artists?limit=100');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request parameters');
    });
  });
});
