// Mock dependencies first
jest.mock('next-auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    artist: {
      upsert: jest.fn(),
    },
  },
}));
jest.mock('@/lib/stripe');

import { POST } from '../onboard/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { createStripeConnectAccount, createAccountLink } from '@/lib/stripe';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreateStripeConnectAccount = createStripeConnectAccount as jest.MockedFunction<typeof createStripeConnectAccount>;
const mockCreateAccountLink = createAccountLink as jest.MockedFunction<typeof createAccountLink>;

// Helper function to create mock request
function createMockRequest(url: string, options: any = {}) {
  return new Request(url, options) as any;
}

describe('/api/artist/stripe/onboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('POST', () => {
    it('should create Stripe Connect account and onboarding link for artist', async () => {
      const mockSession = {
        user: { id: 'user123' },
      };

      const mockUser = {
        id: 'user123',
        email: 'artist@example.com',
        displayName: 'Test Artist',
        role: 'ARTIST',
        artistProfile: null,
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockCreateStripeConnectAccount.mockResolvedValue('acct_test123');
      mockPrisma.artist.upsert.mockResolvedValue({} as any);
      mockCreateAccountLink.mockResolvedValue('https://connect.stripe.com/setup/test');

      const request = createMockRequest('http://localhost:3000/api/artist/stripe/onboard', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.onboardingUrl).toBe('https://connect.stripe.com/setup/test');
      expect(data.stripeAccountId).toBe('acct_test123');

      expect(mockCreateStripeConnectAccount).toHaveBeenCalledWith(
        'artist@example.com',
        'Test Artist'
      );

      expect(mockPrisma.artist.upsert).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        create: {
          userId: 'user123',
          stripeAccountId: 'acct_test123',
          isStripeOnboarded: false,
        },
        update: {
          stripeAccountId: 'acct_test123',
          isStripeOnboarded: false,
        },
      });

      expect(mockCreateAccountLink).toHaveBeenCalledWith(
        'acct_test123',
        'http://localhost:3000/dashboard/artist/stripe/onboard',
        'http://localhost:3000/dashboard/artist/stripe/complete'
      );
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/artist/stripe/onboard', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for non-artist user', async () => {
      const mockSession = {
        user: { id: 'user123' },
      };

      const mockUser = {
        id: 'user123',
        role: 'FAN',
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const request = createMockRequest('http://localhost:3000/api/artist/stripe/onboard', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only artists can onboard with Stripe');
    });

    it('should return 400 if artist already has Stripe account', async () => {
      const mockSession = {
        user: { id: 'user123' },
      };

      const mockUser = {
        id: 'user123',
        role: 'ARTIST',
        artistProfile: {
          stripeAccountId: 'acct_existing123',
        },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const request = createMockRequest('http://localhost:3000/api/artist/stripe/onboard', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Artist already has a Stripe account');
    });

    it('should handle Stripe Connect account creation failure', async () => {
      const mockSession = {
        user: { id: 'user123' },
      };

      const mockUser = {
        id: 'user123',
        email: 'artist@example.com',
        displayName: 'Test Artist',
        role: 'ARTIST',
        artistProfile: null,
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockCreateStripeConnectAccount.mockRejectedValue(new Error('Stripe error'));

      const request = createMockRequest('http://localhost:3000/api/artist/stripe/onboard', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to start Stripe onboarding');
    });
  });
});