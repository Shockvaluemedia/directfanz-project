jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/stripe', () => ({
  createOrRetrieveCustomer: jest.fn(),
  createCustomerPortalSession: jest.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { createCustomerPortalSession, createOrRetrieveCustomer } from '@/lib/stripe';
import { POST } from '../portal/route';

const db = prisma as any;
const mockSession = getServerSession as jest.Mock;
const mockPortal = createCustomerPortalSession as jest.Mock;
const mockCustomer = createOrRetrieveCustomer as jest.Mock;

const request = (body: unknown) => ({ json: async () => body }) as any;

describe('POST /api/payments/portal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: 'fan-1' } });
    db.users.findUnique.mockResolvedValue({
      id: 'fan-1',
      role: 'FAN',
      email: 'fan@example.com',
      displayName: 'Fan',
    });
    db.subscriptions.findFirst.mockResolvedValue({ id: 'sub-1' });
    db.artists.findUnique.mockResolvedValue({ stripeAccountId: 'acct_artist' });
    mockCustomer.mockResolvedValue('cus_1');
    mockPortal.mockResolvedValue('https://billing.test/session');
  });

  it('opens the portal on the artist’s own Stripe account', async () => {
    const res = await POST(request({ artistId: 'artist-1' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ portalUrl: 'https://billing.test/session' });
    expect(mockCustomer).toHaveBeenCalledWith('fan@example.com', 'Fan', 'acct_artist');
    expect(mockPortal).toHaveBeenCalledWith('cus_1', expect.any(String), 'acct_artist');
  });

  it('no longer accepts a Stripe account from the request', async () => {
    const res = await POST(request({ artistId: 'artist-1', stripeAccountId: 'acct_other' }));

    expect(res.status).toBe(400);
    expect(mockPortal).not.toHaveBeenCalled();
  });

  it('refuses a fan who is not a member of that artist', async () => {
    db.subscriptions.findFirst.mockResolvedValue(null);

    const res = await POST(request({ artistId: 'artist-1' }));

    expect(res.status).toBe(404);
    expect(mockCustomer).not.toHaveBeenCalled();
    expect(mockPortal).not.toHaveBeenCalled();
  });

  it('requires sign-in', async () => {
    mockSession.mockResolvedValue(null);

    const res = await POST(request({ artistId: 'artist-1' }));
    expect(res.status).toBe(401);
  });
});
