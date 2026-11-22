jest.mock('@/lib/stripe', () => ({
  PLATFORM_FEE_RATE: 0.05,
  calculatePlatformFeeCents: (cents: number) => Math.round(cents * 0.05),
  createOrRetrieveCustomer: jest.fn(),
  createOneTimeCheckoutSession: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { createOneTimeCheckoutSession, createOrRetrieveCustomer } from '@/lib/stripe';
import {
  createPurchaseCheckout,
  handlePurchaseChargeRefunded,
  handlePurchaseCheckoutExpired,
  handlePurchaseCheckoutFailed,
  handlePurchaseCheckoutPaid,
  isPurchaseCheckoutSession,
  PURCHASE_METADATA_KIND,
  PurchaseError,
} from '@/lib/purchases';

const db = prisma as any;
const mockCreateSession = createOneTimeCheckoutSession as jest.Mock;
const mockCustomer = createOrRetrieveCustomer as jest.Mock;

const fan = { id: 'fan_1', email: 'fan@example.com', displayName: 'Fan' };

const stream = {
  id: 'stream_1',
  artistId: 'artist_1',
  title: 'Album listening party',
  description: 'First listen',
  status: 'SCHEDULED',
  requiresPayment: true,
  paymentAmount: { toString: () => '12.50' },
};

const purchase = {
  id: 'pur_1',
  fanId: 'fan_1',
  artistId: 'artist_1',
  amount: { toString: () => '12.5' },
  platformFee: { toString: () => '0.63' },
  status: 'PENDING',
  stripeCheckoutSessionId: 'cs_test_1',
  stripePaymentIntentId: null,
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_1',
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 1250,
    payment_intent: 'pi_test_1',
    metadata: { kind: PURCHASE_METADATA_KIND, purchaseId: 'pur_1' },
    ...overrides,
  } as any;
}

describe('createPurchaseCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.live_streams.findUnique.mockResolvedValue(stream);
    db.artists.findUnique.mockResolvedValue({
      userId: 'artist_1',
      stripeAccountId: 'acct_artist',
      isStripeOnboarded: true,
    });
    db.purchases.findFirst.mockResolvedValue(null);
    db.purchases.create.mockResolvedValue({});
    db.purchases.update.mockResolvedValue({});
    mockCustomer.mockResolvedValue('cus_1');
    mockCreateSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.test/cs_test_1',
    });
  });

  it('creates a pending purchase priced by the server and a one-off checkout', async () => {
    const result = await createPurchaseCheckout({
      fan,
      itemType: 'LIVE_STREAM_TICKET',
      itemId: 'stream_1',
      baseUrl: 'https://app.test',
    });

    expect(result.checkoutUrl).toBe('https://checkout.test/cs_test_1');

    const created = db.purchases.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      fanId: 'fan_1',
      artistId: 'artist_1',
      itemType: 'LIVE_STREAM_TICKET',
      itemId: 'stream_1',
      amount: 12.5,
      platformFee: 0.63,
      status: 'PENDING',
      stripeAccountId: 'acct_artist',
    });

    const params = mockCreateSession.mock.calls[0][0];
    expect(params).toMatchObject({
      purchaseId: created.id,
      amountCents: 1250,
      currency: 'usd',
      customerId: 'cus_1',
      stripeAccountId: 'acct_artist',
      cancelUrl: 'https://app.test/artist/artist_1?canceled=true',
    });
    expect(params.metadata).toEqual({
      kind: PURCHASE_METADATA_KIND,
      purchaseId: created.id,
      fanId: 'fan_1',
      artistId: 'artist_1',
      itemType: 'LIVE_STREAM_TICKET',
      itemId: 'stream_1',
    });

    expect(db.purchases.update).toHaveBeenCalledWith({
      where: { id: created.id },
      data: { stripeCheckoutSessionId: 'cs_test_1' },
    });
  });

  it('refuses an item the fan already owns', async () => {
    db.purchases.findFirst.mockResolvedValue({ id: 'pur_old' });

    await expect(
      createPurchaseCheckout({
        fan,
        itemType: 'LIVE_STREAM_TICKET',
        itemId: 'stream_1',
        baseUrl: '',
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('refuses when the artist cannot take payments', async () => {
    db.artists.findUnique.mockResolvedValue({ stripeAccountId: null, isStripeOnboarded: false });

    await expect(
      createPurchaseCheckout({
        fan,
        itemType: 'LIVE_STREAM_TICKET',
        itemId: 'stream_1',
        baseUrl: '',
      })
    ).rejects.toBeInstanceOf(PurchaseError);
    expect(db.purchases.create).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null, 404],
    ['free', { ...stream, requiresPayment: false }, 400],
    ['ended', { ...stream, status: 'ENDED' }, 400],
    ['zero priced', { ...stream, paymentAmount: { toString: () => '0' } }, 400],
  ])('refuses a %s stream', async (_label, value, status) => {
    db.live_streams.findUnique.mockResolvedValue(value);

    await expect(
      createPurchaseCheckout({
        fan,
        itemType: 'LIVE_STREAM_TICKET',
        itemId: 'stream_1',
        baseUrl: '',
      })
    ).rejects.toMatchObject({ status });
  });

  it('refuses an artist buying their own item', async () => {
    await expect(
      createPurchaseCheckout({
        fan: { ...fan, id: 'artist_1' },
        itemType: 'LIVE_STREAM_TICKET',
        itemId: 'stream_1',
        baseUrl: '',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('marks the purchase failed when Stripe checkout cannot be created', async () => {
    mockCreateSession.mockRejectedValue(new Error('Failed to create checkout session'));

    await expect(
      createPurchaseCheckout({
        fan,
        itemType: 'LIVE_STREAM_TICKET',
        itemId: 'stream_1',
        baseUrl: '',
      })
    ).rejects.toThrow('Failed to create checkout session');

    const id = db.purchases.create.mock.calls[0][0].data.id;
    expect(db.purchases.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: 'FAILED' },
    });
  });
});

describe('purchase webhook handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.purchases.findUnique.mockResolvedValue(purchase);
    db.purchases.updateMany.mockResolvedValue({ count: 1 });
    db.artists.update.mockResolvedValue({});
  });

  it('recognises only our payment-mode sessions', () => {
    expect(isPurchaseCheckoutSession(session())).toBe(true);
    expect(isPurchaseCheckoutSession(session({ mode: 'subscription' }))).toBe(false);
    expect(isPurchaseCheckoutSession(session({ metadata: { purchaseId: 'pur_1' } }))).toBe(false);
  });

  it('marks a paid purchase PAID and credits the artist net of the fee', async () => {
    await handlePurchaseCheckoutPaid(session());

    expect(db.purchases.updateMany).toHaveBeenCalledWith({
      where: { id: 'pur_1', status: { in: ['PENDING', 'FAILED', 'EXPIRED'] } },
      data: {
        status: 'PAID',
        stripeCheckoutSessionId: 'cs_test_1',
        stripePaymentIntentId: 'pi_test_1',
        paidAt: expect.any(Date),
      },
    });
    expect(db.artists.update).toHaveBeenCalledWith({
      where: { userId: 'artist_1' },
      data: { totalEarnings: { increment: 11.87 } },
    });
  });

  it('does not credit the artist twice when the purchase is already paid', async () => {
    db.purchases.updateMany.mockResolvedValue({ count: 0 });

    await handlePurchaseCheckoutPaid(session());

    expect(db.artists.update).not.toHaveBeenCalled();
  });

  it('waits for async payment when the session is not paid yet', async () => {
    await handlePurchaseCheckoutPaid(session({ payment_status: 'unpaid' }));

    expect(db.purchases.updateMany).not.toHaveBeenCalled();
  });

  it('ignores a session that does not match the stored checkout session', async () => {
    await handlePurchaseCheckoutPaid(session({ id: 'cs_other' }));

    expect(db.purchases.updateMany).not.toHaveBeenCalled();
  });

  it('marks failed and expired sessions only while pending', async () => {
    await handlePurchaseCheckoutFailed(session());
    await handlePurchaseCheckoutExpired(session());

    expect(db.purchases.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'pur_1', status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    expect(db.purchases.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'pur_1', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
  });

  it('marks a fully refunded purchase REFUNDED and reverses the artist earnings', async () => {
    await handlePurchaseChargeRefunded({ refunded: true, payment_intent: 'pi_test_1' } as any);

    expect(db.purchases.findUnique).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_test_1' },
    });
    expect(db.purchases.updateMany).toHaveBeenCalledWith({
      where: { id: 'pur_1', status: 'PAID' },
      data: { status: 'REFUNDED', refundedAt: expect.any(Date) },
    });
    expect(db.artists.update).toHaveBeenCalledWith({
      where: { userId: 'artist_1' },
      data: { totalEarnings: { decrement: 11.87 } },
    });
  });

  it('leaves a partially refunded purchase as it is', async () => {
    await handlePurchaseChargeRefunded({ refunded: false, payment_intent: 'pi_test_1' } as any);

    expect(db.purchases.updateMany).not.toHaveBeenCalled();
  });
});
