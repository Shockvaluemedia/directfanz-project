// Mock NextRequest at the top
global.fetch = jest.fn();
global.Request = class Request {
  constructor(public url: string, public init?: RequestInit) {}
  headers = new Map();
  method = 'GET';
  body = null;
  json = jest.fn();
  text = jest.fn();
} as any;

import { NextRequest } from 'next/server';
import { POST } from '../create-checkout/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { 
  createStripeProduct, 
  createStripePrice, 
  createCheckoutSession, 
  createOrRetrieveCustomer 
} from '@/lib/stripe';

// Mock dependencies
jest.mock('next-auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    tier: {
      findUnique: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('@/lib/stripe');

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreateStripeProduct = createStripeProduct as jest.MockedFunction<typeof createStripeProduct>;
const mockCreateStripePrice = createStripePrice as jest.MockedFunction<typeof createStripePrice>;
const mockCreateCheckoutSession = createCheckoutSession as jest.MockedFunction<typeof createCheckoutSession>;
const mockCreateOrRetrieveCustomer = createOrRetrieveCustomer as jest.MockedFunction<typeof createOrRetrieveCustomer>;

describe('/api/payments/create-checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('POST', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: 10 }),
      });
      const response = await POST(request);

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

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: 10 }),
      });
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only fans can create subscriptions');
    });

    it('should return 404 if tier is not found', async () => {
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

      mockPrisma.tier.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: 10 }),
      });
      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Tier not found');
    });

    it('should return 400 if tier is not active', async () => {
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

      mockPrisma.tier.findUnique.mockResolvedValue({
        id: 'tier-1',
        artistId: 'artist-1',
        name: 'Basic',
        description: 'Basic tier',
        minimumPrice: 5.00,
        isActive: false,
        subscriberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        artist: {
          id: 'artist-1',
          email: 'artist@example.com',
          role: 'ARTIST',
          displayName: 'Test Artist',
          bio: null,
          avatar: null,
          socialLinks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          artistProfile: {
            id: 'profile-1',
            userId: 'artist-1',
            stripeAccountId: 'acct_123',
            isStripeOnboarded: true,
            totalSubscribers: 0,
            totalEarnings: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: 10 }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Tier is not active');
    });

    it('should return 400 if amount is below minimum price', async () => {
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

      mockPrisma.tier.findUnique.mockResolvedValue({
        id: 'tier-1',
        artistId: 'artist-1',
        name: 'Basic',
        description: 'Basic tier',
        minimumPrice: 10.00,
        isActive: true,
        subscriberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        artist: {
          id: 'artist-1',
          email: 'artist@example.com',
          role: 'ARTIST',
          displayName: 'Test Artist',
          bio: null,
          avatar: null,
          socialLinks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          artistProfile: {
            id: 'profile-1',
            userId: 'artist-1',
            stripeAccountId: 'acct_123',
            isStripeOnboarded: true,
            totalSubscribers: 0,
            totalEarnings: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: 5 }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Amount is below minimum price');
    });

    it('should return 400 if artist is not onboarded with Stripe', async () => {
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

      mockPrisma.tier.findUnique.mockResolvedValue({
        id: 'tier-1',
        artistId: 'artist-1',
        name: 'Basic',
        description: 'Basic tier',
        minimumPrice: 5.00,
        isActive: true,
        subscriberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        artist: {
          id: 'artist-1',
          email: 'artist@example.com',
          role: 'ARTIST',
          displayName: 'Test Artist',
          bio: null,
          avatar: null,
          socialLinks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          artistProfile: {
            id: 'profile-1',
            userId: 'artist-1',
            stripeAccountId: null,
            isStripeOnboarded: false,
            totalSubscribers: 0,
            totalEarnings: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: 10 }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Artist is not set up to receive payments');
    });

    it('should return 400 if fan is already subscribed to tier', async () => {
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

      mockPrisma.tier.findUnique.mockResolvedValue({
        id: 'tier-1',
        artistId: 'artist-1',
        name: 'Basic',
        description: 'Basic tier',
        minimumPrice: 5.00,
        isActive: true,
        subscriberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        artist: {
          id: 'artist-1',
          email: 'artist@example.com',
          role: 'ARTIST',
          displayName: 'Test Artist',
          bio: null,
          avatar: null,
          socialLinks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          artistProfile: {
            id: 'profile-1',
            userId: 'artist-1',
            stripeAccountId: 'acct_123',
            isStripeOnboarded: true,
            totalSubscribers: 0,
            totalEarnings: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });

      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        fanId: 'fan-1',
        artistId: 'artist-1',
        tierId: 'tier-1',
        stripeSubscriptionId: 'sub_123',
        amount: 10.00,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: 10 }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Already subscribed to this tier');
    });

    it('should create checkout session successfully', async () => {
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

      mockPrisma.tier.findUnique.mockResolvedValue({
        id: 'tier-1',
        artistId: 'artist-1',
        name: 'Basic',
        description: 'Basic tier',
        minimumPrice: 5.00,
        isActive: true,
        subscriberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        artist: {
          id: 'artist-1',
          email: 'artist@example.com',
          role: 'ARTIST',
          displayName: 'Test Artist',
          bio: null,
          avatar: null,
          socialLinks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          artistProfile: {
            id: 'profile-1',
            userId: 'artist-1',
            stripeAccountId: 'acct_123',
            isStripeOnboarded: true,
            totalSubscribers: 0,
            totalEarnings: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });

      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      mockCreateOrRetrieveCustomer.mockResolvedValue('cus_123');
      mockCreateStripeProduct.mockResolvedValue('prod_123');
      mockCreateStripePrice.mockResolvedValue('price_123');
      mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/session123');

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: 10 }),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.checkoutUrl).toBe('https://checkout.stripe.com/session123');

      expect(mockCreateOrRetrieveCustomer).toHaveBeenCalledWith(
        'fan@example.com',
        'Test Fan',
        'acct_123'
      );
      expect(mockCreateStripeProduct).toHaveBeenCalledWith(
        'Basic',
        'Basic tier',
        'acct_123'
      );
      expect(mockCreateStripePrice).toHaveBeenCalledWith(
        'prod_123',
        10,
        'acct_123'
      );
    });

    it('should return 400 for invalid request data', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'fan-1', email: 'fan@example.com', role: 'FAN' },
        expires: '2024-01-01',
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tierId: 'tier-1', amount: -5 }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });
  });
});