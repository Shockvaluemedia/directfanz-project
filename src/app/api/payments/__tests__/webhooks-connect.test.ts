/**
 * Stripe Connect webhook: payments are direct charges on the artist's
 * connected account, so their events come from a Connect endpoint with its own
 * signing secret and carry `event.account`.
 */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptions: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    tiers: { update: jest.fn(), findUnique: jest.fn() },
    artists: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    users: { findUnique: jest.fn() },
    stripe_webhook_events: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/stripe', () => ({
  PLATFORM_FEE_RATE: 0.1,
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));

jest.mock('next/headers', () => ({
  headers: jest.fn(() => ({ get: jest.fn(() => 'test-signature') })),
}));

jest.mock('@/lib/notifications', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/marketing-events', () => ({ emitMarketingEvent: jest.fn() }));

jest.mock('@/lib/purchases', () => ({
  isPurchaseCheckoutSession: jest.fn(
    (session: any) => session.mode === 'payment' && Boolean(session.metadata?.purchaseId)
  ),
  handlePurchaseCheckoutPaid: jest.fn(),
  handlePurchaseCheckoutFailed: jest.fn(),
  handlePurchaseCheckoutExpired: jest.fn(),
  handlePurchaseChargeRefunded: jest.fn(),
}));

import { POST } from '../webhooks/route';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { handlePurchaseChargeRefunded, handlePurchaseCheckoutPaid } from '@/lib/purchases';

const db = prisma as any;
const constructEvent = stripe.webhooks.constructEvent as jest.Mock;

const PLATFORM_SECRET = 'whsec_platform_test';
const CONNECT_SECRET = 'whsec_connect_test';

function post() {
  return POST(
    new Request('http://localhost:3000/api/payments/webhooks', {
      method: 'POST',
      body: '{}',
    }) as any
  );
}

/** Make Stripe's verifier accept only `secret`, returning `event`. */
function signedWith(secret: string, event: Record<string, unknown>) {
  constructEvent.mockImplementation((_body: string, _sig: string, given: string) => {
    if (given !== secret) throw new Error('No signatures found matching the expected signature');
    return { id: 'evt_1', ...event };
  });
}

describe('/api/payments/webhooks with a Connect endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = PLATFORM_SECRET;
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = CONNECT_SECRET;
    db.stripe_webhook_events.create.mockResolvedValue({});
    db.stripe_webhook_events.update.mockResolvedValue({});
    db.artists.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  });

  it('accepts a purchase event signed with the Connect secret and passes the account on', async () => {
    const session = {
      id: 'cs_1',
      mode: 'payment',
      metadata: { kind: 'purchase', purchaseId: 'pur_1' },
    };
    signedWith(CONNECT_SECRET, {
      type: 'checkout.session.completed',
      account: 'acct_nahvee',
      data: { object: session },
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(handlePurchaseCheckoutPaid).toHaveBeenCalledWith(session, 'acct_nahvee');
  });

  it('passes the account on for refunds', async () => {
    const charge = { id: 'ch_1', refunded: true, payment_intent: 'pi_1' };
    signedWith(CONNECT_SECRET, {
      type: 'charge.refunded',
      account: 'acct_nahvee',
      data: { object: charge },
    });

    expect((await post()).status).toBe(200);
    expect(handlePurchaseChargeRefunded).toHaveBeenCalledWith(charge, 'acct_nahvee');
  });

  it('works with only the Connect secret set', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    signedWith(CONNECT_SECRET, {
      type: 'checkout.session.completed',
      account: 'acct_nahvee',
      data: { object: { id: 'cs_1', mode: 'payment', metadata: { purchaseId: 'pur_1' } } },
    });

    expect((await post()).status).toBe(200);
    expect(handlePurchaseCheckoutPaid).toHaveBeenCalled();
  });

  it('still accepts platform-signed events', async () => {
    signedWith(PLATFORM_SECRET, { type: 'some.other.event', data: { object: {} } });

    expect((await post()).status).toBe(200);
  });

  it('rejects a signature that neither secret verifies', async () => {
    signedWith('whsec_someone_else', { type: 'checkout.session.completed', data: { object: {} } });

    const res = await post();

    expect(res.status).toBe(400);
    expect(db.stripe_webhook_events.create).not.toHaveBeenCalled();
  });

  it('rejects a Connect-signed event with no account', async () => {
    signedWith(CONNECT_SECRET, { type: 'checkout.session.completed', data: { object: {} } });

    const res = await post();

    expect(res.status).toBe(400);
    expect(handlePurchaseCheckoutPaid).not.toHaveBeenCalled();
  });

  it('is switched off when no secret is set', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

    expect((await post()).status).toBe(500);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it('marks the artist ready for payments when Stripe enables charges', async () => {
    signedWith(CONNECT_SECRET, {
      type: 'account.updated',
      account: 'acct_nahvee',
      data: {
        object: { id: 'acct_nahvee', details_submitted: true, charges_enabled: true },
      },
    });

    expect((await post()).status).toBe(200);
    expect(db.artists.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: 'acct_nahvee', isStripeOnboarded: false },
      data: { isStripeOnboarded: true },
    });
  });

  it('stops payments when Stripe disables charges', async () => {
    signedWith(CONNECT_SECRET, {
      type: 'account.updated',
      account: 'acct_nahvee',
      data: {
        object: { id: 'acct_nahvee', details_submitted: true, charges_enabled: false },
      },
    });

    expect((await post()).status).toBe(200);
    expect(db.artists.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: 'acct_nahvee', isStripeOnboarded: true },
      data: { isStripeOnboarded: false },
    });
  });

  it('ignores an account.updated about a different account than the sender', async () => {
    signedWith(CONNECT_SECRET, {
      type: 'account.updated',
      account: 'acct_nahvee',
      data: { object: { id: 'acct_other', details_submitted: true, charges_enabled: true } },
    });

    expect((await post()).status).toBe(200);
    expect(db.artists.updateMany).not.toHaveBeenCalled();
  });

  it('stops payments when the artist disconnects from the platform', async () => {
    signedWith(CONNECT_SECRET, {
      type: 'account.application.deauthorized',
      account: 'acct_nahvee',
      data: { object: { id: 'ca_1' } },
    });

    expect((await post()).status).toBe(200);
    expect(db.artists.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: 'acct_nahvee' },
      data: { isStripeOnboarded: false },
    });
  });

  describe('subscription checkout', () => {
    const session = {
      id: 'cs_sub',
      mode: 'subscription',
      subscription: 'sub_1',
      metadata: { fanId: 'fan_1', artistId: 'artist_user_1', tierId: 'tier_1', amount: '3.00' },
    };

    it('creates the membership when the event comes from that artist’s account', async () => {
      db.artists.findUnique.mockResolvedValue({ stripeAccountId: 'acct_nahvee' });
      db.subscriptions.findUnique.mockResolvedValue(null);
      db.subscriptions.create.mockResolvedValue({});
      db.tiers.update.mockResolvedValue({});
      db.artists.update.mockResolvedValue({});
      db.tiers.findUnique.mockResolvedValue({ id: 'tier_1', name: 'Members' });
      db.users.findUnique.mockResolvedValue({ id: 'fan_1', email: 'fan@example.com' });
      signedWith(CONNECT_SECRET, {
        type: 'checkout.session.completed',
        account: 'acct_nahvee',
        data: { object: session },
      });

      expect((await post()).status).toBe(200);
      expect(db.artists.findUnique).toHaveBeenCalledWith({
        where: { userId: 'artist_user_1' },
        select: { stripeAccountId: true },
      });
      expect(db.subscriptions.create).toHaveBeenCalled();
    });

    it('ignores a membership checkout from another artist’s account', async () => {
      db.artists.findUnique.mockResolvedValue({ stripeAccountId: 'acct_nahvee' });
      signedWith(CONNECT_SECRET, {
        type: 'checkout.session.completed',
        account: 'acct_someone_else',
        data: { object: session },
      });

      expect((await post()).status).toBe(200);
      expect(db.subscriptions.create).not.toHaveBeenCalled();
      expect(db.subscriptions.update).not.toHaveBeenCalled();
    });
  });
});
