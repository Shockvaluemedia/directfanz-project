jest.mock('@/lib/stripe', () => ({
  PLATFORM_FEE_RATE: 0.1,
  calculatePlatformFeeCents: (cents: number) => Math.round(cents * 0.1),
  createOrRetrieveCustomer: jest.fn(),
  createOneTimeCheckoutSession: jest.fn(),
}));

jest.mock('@/lib/fan-list', () => ({ joinFanList: jest.fn() }));

import { prisma } from '@/lib/prisma';
import { joinFanList } from '@/lib/fan-list';
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
      platformFee: 1.25,
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
    db.purchases.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      createPurchaseCheckout({
        fan,
        itemType: 'LIVE_STREAM_TICKET',
        itemId: 'stream_1',
        baseUrl: '',
      })
    ).rejects.toThrow('Failed to create checkout session');

    const id = db.purchases.create.mock.calls[0][0].data.id;
    expect(db.purchases.updateMany).toHaveBeenCalledWith({
      where: { id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    // A ticket holds no drop unit, so there is nothing to give back.
    expect(db.drops.updateMany).not.toHaveBeenCalled();
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

    expect(db.purchases.updateMany).toHaveBeenCalledTimes(1);
    expect(db.purchases.updateMany).toHaveBeenCalledWith({
      where: { id: 'pur_1', status: 'PENDING' },
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

  it('still records a payment that lands after its checkout failed or expired', async () => {
    db.purchases.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    await handlePurchaseCheckoutPaid(session());

    expect(db.purchases.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'pur_1', status: { in: ['FAILED', 'EXPIRED'] } },
      data: expect.objectContaining({ status: 'PAID' }),
    });
    expect(db.artists.update).toHaveBeenCalledTimes(1);
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

describe('drop purchases', () => {
  const now = Date.now();
  const drop = {
    id: 'drop_1',
    artistId: 'artist_1',
    title: 'Never More: first single',
    description: null,
    priceType: 'PAY_WHAT_YOU_WANT',
    price: { toString: () => '3' },
    currency: 'usd',
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 86_400_000),
    quantityLimit: null,
    soldCount: 0,
    status: 'PUBLISHED',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db.$executeRaw.mockResolvedValue(1);
    db.drops.updateMany.mockResolvedValue({ count: 1 });
    db.drops.findUnique.mockResolvedValue(drop);
    db.artists.findUnique.mockResolvedValue({
      userId: 'artist_1',
      stripeAccountId: 'acct_artist',
      isStripeOnboarded: true,
    });
    db.purchases.findFirst.mockResolvedValue(null);
    db.purchases.create.mockResolvedValue({});
    db.purchases.update.mockResolvedValue({});
    mockCustomer.mockResolvedValue('cus_1');
    mockCreateSession.mockResolvedValue({ id: 'cs_drop', url: 'https://checkout.test/cs_drop' });
  });

  it('charges the amount the fan chose above the minimum', async () => {
    await createPurchaseCheckout({
      fan,
      itemType: 'DROP',
      itemId: 'drop_1',
      amountCents: 1000,
      baseUrl: 'https://app.test',
    });

    expect(db.purchases.create.mock.calls[0][0].data).toMatchObject({
      itemType: 'DROP',
      amount: 10,
      platformFee: 1,
    });
    expect(mockCreateSession.mock.calls[0][0]).toMatchObject({
      amountCents: 1000,
      title: 'Never More: first single',
    });
  });

  it('adds the buyer to the artist’s fan list only when they ticked the box', async () => {
    const join = joinFanList as jest.Mock;
    join.mockResolvedValue({});

    await createPurchaseCheckout({ fan, itemType: 'DROP', itemId: 'drop_1', baseUrl: '' });
    expect(join).not.toHaveBeenCalled();

    await createPurchaseCheckout({
      fan,
      itemType: 'DROP',
      itemId: 'drop_1',
      joinFanList: true,
      baseUrl: '',
    });
    expect(join).toHaveBeenCalledWith('artist_1', 'fan_1', 'PURCHASE');
  });

  it('still opens checkout if adding the buyer to the fan list fails', async () => {
    (joinFanList as jest.Mock).mockRejectedValue(new Error('db down'));

    await expect(
      createPurchaseCheckout({
        fan,
        itemType: 'DROP',
        itemId: 'drop_1',
        joinFanList: true,
        baseUrl: '',
      })
    ).resolves.toMatchObject({ checkoutUrl: 'https://checkout.test/cs_drop' });
  });

  it('charges the minimum when the fan names no amount', async () => {
    await createPurchaseCheckout({ fan, itemType: 'DROP', itemId: 'drop_1', baseUrl: '' });

    expect(mockCreateSession.mock.calls[0][0].amountCents).toBe(300);
  });

  it('refuses an amount under the minimum', async () => {
    await expect(
      createPurchaseCheckout({
        fan,
        itemType: 'DROP',
        itemId: 'drop_1',
        amountCents: 100,
        baseUrl: '',
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(db.purchases.create).not.toHaveBeenCalled();
  });

  it.each([
    ['not on sale yet', { startsAt: new Date(now + 60_000) }, 400],
    ['sold out', { quantityLimit: 5, soldCount: 5 }, 400],
    ['a draft', { status: 'DRAFT' }, 404],
  ])('refuses a drop that is %s', async (_label, change, status) => {
    db.drops.findUnique.mockResolvedValue({ ...drop, ...change });

    await expect(
      createPurchaseCheckout({ fan, itemType: 'DROP', itemId: 'drop_1', baseUrl: '' })
    ).rejects.toMatchObject({ status });
  });

  it('refuses a fan-chosen amount on a fixed-price ticket', async () => {
    await expect(
      createPurchaseCheckout({
        fan,
        itemType: 'LIVE_STREAM_TICKET',
        itemId: 'stream_1',
        amountCents: 100,
        baseUrl: '',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('holds a unit of the drop for the checkout and expires the checkout after 31 minutes', async () => {
    await createPurchaseCheckout({ fan, itemType: 'DROP', itemId: 'drop_1', baseUrl: '' });

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const sql = (db.$executeRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain('"reservedCount" = "reservedCount" + 1');
    expect(sql).toContain('"soldCount" + "reservedCount" < "quantityLimit"');
    expect(db.$executeRaw.mock.calls[0][1]).toBe('drop_1');

    const expiresAt = mockCreateSession.mock.calls[0][0].expiresAt as Date;
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(30 * 60 * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(31 * 60 * 1000);
  });

  it('refuses the checkout when the last unit is already sold or held', async () => {
    db.$executeRaw.mockResolvedValue(0);

    await expect(
      createPurchaseCheckout({ fan, itemType: 'DROP', itemId: 'drop_1', baseUrl: '' })
    ).rejects.toMatchObject({ status: 409, message: 'This drop is sold out' });
    expect(db.purchases.create).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('sells the last unit to only one of two fans checking out at once', async () => {
    // One unit left: the first conditional UPDATE takes it, the second finds none.
    db.drops.findUnique.mockResolvedValue({ ...drop, quantityLimit: 1 });
    db.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const results = await Promise.allSettled([
      createPurchaseCheckout({ fan, itemType: 'DROP', itemId: 'drop_1', baseUrl: '' }),
      createPurchaseCheckout({
        fan: { ...fan, id: 'fan_2' },
        itemType: 'DROP',
        itemId: 'drop_1',
        baseUrl: '',
      }),
    ]);

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  it('gives the unit back when Stripe checkout cannot be created', async () => {
    mockCreateSession.mockRejectedValue(new Error('Failed to create checkout session'));
    db.purchases.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      createPurchaseCheckout({ fan, itemType: 'DROP', itemId: 'drop_1', baseUrl: '' })
    ).rejects.toThrow('Failed to create checkout session');

    expect(db.drops.updateMany).toHaveBeenCalledWith({
      where: { id: 'drop_1', reservedCount: { gt: 0 } },
      data: { reservedCount: { decrement: 1 } },
    });
  });

  it.each([
    ['fails', handlePurchaseCheckoutFailed],
    ['expires', handlePurchaseCheckoutExpired],
  ])('gives the unit back when the checkout %s', async (_label, handler) => {
    db.purchases.findUnique.mockResolvedValue({ ...purchase, itemType: 'DROP', itemId: 'drop_1' });
    db.purchases.updateMany.mockResolvedValue({ count: 1 });

    await handler(session());

    expect(db.drops.updateMany).toHaveBeenCalledWith({
      where: { id: 'drop_1', reservedCount: { gt: 0 } },
      data: { reservedCount: { decrement: 1 } },
    });
  });

  it('does not give a unit back twice for a repeated expiry', async () => {
    db.purchases.findUnique.mockResolvedValue({
      ...purchase,
      itemType: 'DROP',
      itemId: 'drop_1',
      status: 'EXPIRED',
    });
    db.purchases.updateMany.mockResolvedValue({ count: 0 });

    await handlePurchaseCheckoutExpired(session());

    expect(db.drops.updateMany).not.toHaveBeenCalled();
  });

  it('counts a sale when a drop purchase is paid, and gives it back on refund', async () => {
    const dropPurchase = { ...purchase, itemType: 'DROP', itemId: 'drop_1' };
    db.purchases.findUnique.mockResolvedValue(dropPurchase);
    db.purchases.updateMany.mockResolvedValue({ count: 1 });
    db.artists.update.mockResolvedValue({});
    db.drops.update.mockResolvedValue({});
    db.drops.updateMany.mockResolvedValue({ count: 1 });

    await handlePurchaseCheckoutPaid(session());
    // The held unit becomes the sale in one statement.
    const sql = (db.$executeRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain('"soldCount" = "soldCount" + 1');
    expect(sql).toContain('"reservedCount" = GREATEST("reservedCount" - 1, 0)');
    expect(db.drops.update).not.toHaveBeenCalled();

    db.purchases.findUnique.mockResolvedValue({ ...dropPurchase, status: 'PAID' });
    await handlePurchaseChargeRefunded({ refunded: true, payment_intent: 'pi_test_1' } as any);
    expect(db.drops.updateMany).toHaveBeenCalledWith({
      where: { id: 'drop_1', soldCount: { gt: 0 } },
      data: { soldCount: { decrement: 1 } },
    });
  });
});

describe('late drop payment', () => {
  it('counts a drop paid after its checkout expired without touching held units', async () => {
    jest.clearAllMocks();
    db.purchases.findUnique.mockResolvedValue({
      ...purchase,
      itemType: 'DROP',
      itemId: 'drop_1',
      status: 'EXPIRED',
    });
    db.purchases.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    db.artists.update.mockResolvedValue({});
    db.drops.update.mockResolvedValue({});

    await handlePurchaseCheckoutPaid(session());

    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(db.drops.update).toHaveBeenCalledWith({
      where: { id: 'drop_1' },
      data: { soldCount: { increment: 1 } },
    });
  });
});
