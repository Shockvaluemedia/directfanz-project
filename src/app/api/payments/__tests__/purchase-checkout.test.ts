jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/purchases', () => {
  const actual = jest.requireActual('@/lib/purchases');
  return { ...actual, createPurchaseCheckout: jest.fn() };
});

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { createPurchaseCheckout, PurchaseError } from '@/lib/purchases';
import { POST } from '../purchase-checkout/route';

const mockSession = getServerSession as jest.Mock;
const mockCheckout = createPurchaseCheckout as jest.Mock;
const db = prisma as any;

function request(body: unknown) {
  return { json: async () => body } as any;
}

describe('POST /api/payments/purchase-checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: 'fan_1' } });
    db.users.findUnique.mockResolvedValue({
      id: 'fan_1',
      role: 'FAN',
      email: 'fan@example.com',
      displayName: 'Fan',
    });
    mockCheckout.mockResolvedValue({ purchaseId: 'pur_1', checkoutUrl: 'https://checkout.test' });
  });

  it('returns a checkout URL for a fan', async () => {
    const res = await POST(request({ itemType: 'LIVE_STREAM_TICKET', itemId: 'stream_1' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      purchaseId: 'pur_1',
      checkoutUrl: 'https://checkout.test',
    });
    expect(mockCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        fan: { id: 'fan_1', email: 'fan@example.com', displayName: 'Fan' },
        itemType: 'LIVE_STREAM_TICKET',
        itemId: 'stream_1',
      })
    );
  });

  it('requires sign-in', async () => {
    mockSession.mockResolvedValue(null);

    const res = await POST(request({ itemType: 'LIVE_STREAM_TICKET', itemId: 'stream_1' }));
    expect(res.status).toBe(401);
  });

  it('only lets fans buy', async () => {
    db.users.findUnique.mockResolvedValue({ id: 'fan_1', role: 'ARTIST' });

    const res = await POST(request({ itemType: 'LIVE_STREAM_TICKET', itemId: 'stream_1' }));
    expect(res.status).toBe(403);
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('passes a pay-what-you-want amount to the server-side check in cents', async () => {
    const res = await POST(request({ itemType: 'DROP', itemId: 'drop_1', amount: 7.5 }));

    expect(res.status).toBe(200);
    expect(mockCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ itemType: 'DROP', itemId: 'drop_1', amountCents: 750 })
    );
  });

  it('rejects unknown item types, non-positive amounts and extra fields', async () => {
    const unknownType = await POST(request({ itemType: 'FREE_STUFF', itemId: 'x' }));
    const negative = await POST(request({ itemType: 'DROP', itemId: 'd', amount: -1 }));
    const extra = await POST(request({ itemType: 'DROP', itemId: 'd', artistId: 'a' }));

    expect(unknownType.status).toBe(400);
    expect(negative.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('passes purchase errors through with their status', async () => {
    mockCheckout.mockRejectedValue(new PurchaseError('You already own this', 409));

    const res = await POST(request({ itemType: 'LIVE_STREAM_TICKET', itemId: 'stream_1' }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'You already own this' });
  });

  it('hides unexpected errors', async () => {
    mockCheckout.mockRejectedValue(new Error('stripe exploded'));

    const res = await POST(request({ itemType: 'LIVE_STREAM_TICKET', itemId: 'stream_1' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to create checkout session' });
  });
});
