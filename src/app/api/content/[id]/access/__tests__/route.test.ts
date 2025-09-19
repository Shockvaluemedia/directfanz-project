import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { checkContentAccess, generateAccessToken } from '@/lib/content-access';
import { prisma } from '@/lib/prisma';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/content-access', () => ({
  checkContentAccess: jest.fn(),
  generateAccessToken: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    content: {
      findUnique: jest.fn(),
    },
  },
}));

describe('/api/content/[id]/access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST - Generate Access Token', () => {
    it('should generate access token for authorized user', async () => {
      const mockSession = {
        user: { id: 'user-1', role: 'FAN' },
      };

      const mockAccessResult = {
        hasAccess: true,
        reason: 'subscription',
      };

      const mockContent = {
        id: 'content-1',
        title: 'Test Content',
        type: 'AUDIO',
        fileSize: 1024,
        duration: 180,
        format: 'mp3',
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession as any);
      (checkContentAccess as jest.Mock).mockResolvedValue(mockAccessResult);
      (generateAccessToken as jest.Mock).mockReturnValue('mock-access-token');
      (prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any);

      const request = new NextRequest('http://localhost/api/content/content-1/access', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'content-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBe('mock-access-token');
      expect(data.data.content).toEqual(mockContent);
      expect(data.data.expiresIn).toBe(3600);
    });

    it('should deny access for unauthorized user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/content/content-1/access', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'content-1' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should deny access when user has no subscription', async () => {
      const mockSession = {
        user: { id: 'user-1', role: 'FAN' },
      };

      const mockAccessResult = {
        hasAccess: false,
        reason: 'no_subscription',
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession as any);
      (checkContentAccess as jest.Mock).mockResolvedValue(mockAccessResult);

      const request = new NextRequest('http://localhost/api/content/content-1/access', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'content-1' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Subscription required to access this content');
      expect(data.reason).toBe('no_subscription');
    });

    it('should deny access for content not found', async () => {
      const mockSession = {
        user: { id: 'user-1', role: 'FAN' },
      };

      const mockAccessResult = {
        hasAccess: false,
        reason: 'not_found',
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession as any);
      (checkContentAccess as jest.Mock).mockResolvedValue(mockAccessResult);

      const request = new NextRequest('http://localhost/api/content/content-1/access', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'content-1' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Content not found');
      expect(data.reason).toBe('not_found');
    });
  });

  describe('GET - Check Access', () => {
    it('should return access information for authorized user', async () => {
      const mockSession = {
        user: { id: 'user-1', role: 'FAN' },
      };

      const mockAccessResult = {
        hasAccess: true,
        reason: 'subscription',
        subscription: {
          id: 'sub-1',
          tierId: 'tier-1',
          amount: 15,
          status: 'ACTIVE',
        },
      };

      const mockContent = {
        id: 'content-1',
        title: 'Test Content',
        type: 'AUDIO',
        isPublic: false,
        tiers: [
          {
            id: 'tier-1',
            name: 'Basic',
            minimumPrice: 10,
          },
        ],
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession as any);
      (checkContentAccess as jest.Mock).mockResolvedValue(mockAccessResult);
      (prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any);

      const request = new NextRequest('http://localhost/api/content/content-1/access');

      const response = await GET(request, { params: { id: 'content-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.hasAccess).toBe(true);
      expect(data.data.reason).toBe('subscription');
      expect(data.data.subscription).toEqual(mockAccessResult.subscription);
      expect(data.data.content).toEqual(mockContent);
    });

    it('should return no access for user without subscription', async () => {
      const mockSession = {
        user: { id: 'user-1', role: 'FAN' },
      };

      const mockAccessResult = {
        hasAccess: false,
        reason: 'no_subscription',
      };

      const mockContent = {
        id: 'content-1',
        title: 'Test Content',
        type: 'AUDIO',
        isPublic: false,
        tiers: [
          {
            id: 'tier-1',
            name: 'Basic',
            minimumPrice: 10,
          },
        ],
      };

      (getServerSession as jest.Mock).mockResolvedValue(mockSession as any);
      (checkContentAccess as jest.Mock).mockResolvedValue(mockAccessResult);
      (prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any);

      const request = new NextRequest('http://localhost/api/content/content-1/access');

      const response = await GET(request, { params: { id: 'content-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.hasAccess).toBe(false);
      expect(data.data.reason).toBe('no_subscription');
    });
  });
});
