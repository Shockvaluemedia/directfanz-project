import crypto from 'crypto';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  calculatePlatformFeeCents,
  createOneTimeCheckoutSession,
  createOrRetrieveCustomer,
} from '@/lib/stripe';
import {
  confirmDropUnit,
  DropError,
  getDropAvailability,
  releaseDropUnit,
  reserveDropUnit,
  resolveDropAmountCents,
} from '@/lib/drops';
import { joinFanList } from '@/lib/fan-list';
import { emitMarketingEvent, type MarketingEventType } from '@/lib/marketing-events';

/**
 * One-time purchases: a fan pays once for an item (a drop, a presale, a
 * listening-party ticket) on the artist's Stripe Connect account.
 *
 * The price always comes from the server (an item resolver), never from the
 * client. New item types (drops, presales) register a resolver below.
 */

export const PURCHASE_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  REFUNDED: 'REFUNDED',
} as const;

/** Marks a Checkout Session / PaymentIntent as belonging to a purchase. */
export const PURCHASE_METADATA_KIND = 'one_time_purchase';

export const PURCHASE_ITEM_TYPES = ['DROP', 'LIVE_STREAM_TICKET'] as const;
export type PurchaseItemType = (typeof PURCHASE_ITEM_TYPES)[number];

export interface ResolvedPurchaseItem {
  artistId: string;
  title: string;
  description?: string;
  amountCents: number;
  currency: string;
  /** Where the fan returns to if they cancel checkout. */
  cancelPath: string;
}

/**
 * How long a fan has to finish paying. Stripe's minimum is 30 minutes; a
 * minute more absorbs clock drift. A drop checkout holds a unit for this long.
 */
export const CHECKOUT_EXPIRY_MS = 31 * 60 * 1000;

export class PurchaseError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'PurchaseError';
  }
}

function decimalToCents(value: { toString(): string } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Math.round(parseFloat(value.toString()) * 100);
}

export interface ResolveItemOptions {
  /** Amount the fan chose, in cents. Only pay-what-you-want items accept one. */
  amountCents?: number;
}

type ItemResolver = (itemId: string, options: ResolveItemOptions) => Promise<ResolvedPurchaseItem>;

const DROP_UNAVAILABLE_MESSAGES = {
  not_started: 'This drop is not on sale yet',
  ended: 'This drop is no longer on sale',
  sold_out: 'This drop is sold out',
  unavailable: 'Item not found',
} as const;

const itemResolvers: Record<PurchaseItemType, ItemResolver> = {
  // A drop: fixed price, or pay-what-you-want at or above its minimum.
  async DROP(itemId, { amountCents }) {
    const drop = await prisma.drops.findUnique({ where: { id: itemId } });
    if (!drop) {
      throw new PurchaseError('Item not found', 404);
    }

    const availability = getDropAvailability(drop);
    if (availability !== 'on_sale') {
      throw new PurchaseError(
        DROP_UNAVAILABLE_MESSAGES[availability],
        availability === 'unavailable' ? 404 : 400
      );
    }

    let resolvedCents: number;
    try {
      resolvedCents = resolveDropAmountCents(drop, amountCents);
    } catch (error) {
      if (error instanceof DropError) {
        throw new PurchaseError(error.message, error.status);
      }
      throw error;
    }

    return {
      artistId: drop.artistId,
      title: drop.title,
      description: drop.description ?? undefined,
      amountCents: resolvedCents,
      currency: drop.currency,
      cancelPath: `/artist/${drop.artistId}?canceled=true`,
    };
  },

  // A ticket to a paid scheduled live stream (listening party). Stream access
  // is not yet gated on the ticket; that is a later change.
  async LIVE_STREAM_TICKET(itemId, { amountCents: requested }) {
    if (requested !== undefined) {
      throw new PurchaseError('This item has a fixed price', 400);
    }

    const stream = await prisma.live_streams.findUnique({ where: { id: itemId } });

    if (!stream) {
      throw new PurchaseError('Item not found', 404);
    }
    if (stream.status === 'ENDED' || stream.status === 'CANCELED') {
      throw new PurchaseError('This event is no longer on sale', 400);
    }

    const amountCents = decimalToCents(stream.paymentAmount);
    if (!stream.requiresPayment || amountCents <= 0) {
      throw new PurchaseError('This event does not sell tickets', 400);
    }

    return {
      artistId: stream.artistId,
      title: `Ticket: ${stream.title}`,
      description: stream.description ?? undefined,
      amountCents,
      currency: 'usd',
      cancelPath: `/artist/${stream.artistId}?canceled=true`,
    };
  },
};

export async function resolvePurchaseItem(
  itemType: PurchaseItemType,
  itemId: string,
  options: ResolveItemOptions = {}
): Promise<ResolvedPurchaseItem> {
  const resolver = itemResolvers[itemType];
  if (!resolver) {
    throw new PurchaseError('Unsupported item type', 400);
  }
  return resolver(itemId, options);
}

/** True when the fan has a paid, unrefunded purchase of the item. */
export async function hasPaidPurchase(
  fanId: string,
  itemType: PurchaseItemType,
  itemId: string
): Promise<boolean> {
  const paid = await prisma.purchases.findFirst({
    where: { fanId, itemType, itemId, status: PURCHASE_STATUS.PAID },
    select: { id: true },
  });
  return Boolean(paid);
}

export interface CreatePurchaseCheckoutInput {
  fan: { id: string; email: string; displayName: string };
  itemType: PurchaseItemType;
  itemId: string;
  /** Pay-what-you-want amount in cents; omit for fixed-price items. */
  amountCents?: number;
  /** The fan ticked "join the artist's fan list" at checkout. */
  joinFanList?: boolean;
  baseUrl: string;
}

/**
 * Create a PENDING purchase and a Stripe Checkout Session for it.
 * Returns the URL to send the fan to.
 */
export async function createPurchaseCheckout(
  input: CreatePurchaseCheckoutInput
): Promise<{ purchaseId: string; checkoutUrl: string }> {
  const { fan, itemType, itemId, baseUrl } = input;
  const item = await resolvePurchaseItem(itemType, itemId, { amountCents: input.amountCents });

  if (item.artistId === fan.id) {
    throw new PurchaseError('You cannot buy your own item', 400);
  }

  const artist = await prisma.artists.findUnique({ where: { userId: item.artistId } });
  if (!artist?.stripeAccountId || !artist.isStripeOnboarded) {
    throw new PurchaseError('Artist is not set up to receive payments', 400);
  }

  if (await hasPaidPurchase(fan.id, itemType, itemId)) {
    throw new PurchaseError('You already own this', 409);
  }

  // A drop checkout holds one unit until it is paid, fails or expires, so the
  // last unit of a capped drop can't be sold twice.
  const holdsDropUnit = itemType === 'DROP';
  if (holdsDropUnit && !(await reserveDropUnit(itemId))) {
    throw new PurchaseError('This drop is sold out', 409);
  }

  const purchaseId = crypto.randomUUID();
  const platformFeeCents = calculatePlatformFeeCents(item.amountCents);

  const releaseHold = async () => {
    if (!holdsDropUnit) return;
    await releaseDropUnit(itemId).catch(releaseError =>
      console.error('Failed to release drop unit:', releaseError)
    );
  };

  try {
    await prisma.purchases.create({
      data: {
        id: purchaseId,
        fanId: fan.id,
        artistId: item.artistId,
        itemType,
        itemId,
        title: item.title,
        amount: item.amountCents / 100,
        currency: item.currency,
        platformFee: platformFeeCents / 100,
        status: PURCHASE_STATUS.PENDING,
        stripeAccountId: artist.stripeAccountId,
      },
    });
  } catch (error) {
    await releaseHold();
    throw error;
  }

  try {
    const customerId = await createOrRetrieveCustomer(
      fan.email,
      fan.displayName,
      artist.stripeAccountId
    );

    const session = await createOneTimeCheckoutSession({
      purchaseId,
      title: item.title,
      description: item.description,
      amountCents: item.amountCents,
      currency: item.currency,
      customerId,
      stripeAccountId: artist.stripeAccountId,
      successUrl: `${baseUrl}/dashboard/fan?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}${item.cancelPath}`,
      expiresAt: new Date(Date.now() + CHECKOUT_EXPIRY_MS),
      metadata: {
        kind: PURCHASE_METADATA_KIND,
        purchaseId,
        fanId: fan.id,
        artistId: item.artistId,
        itemType,
        itemId,
      },
    });

    await prisma.purchases.update({
      where: { id: purchaseId },
      data: { stripeCheckoutSessionId: session.id },
    });

    if (input.joinFanList) {
      // The fan opted in; a failure here must not block their checkout.
      await joinFanList(item.artistId, fan.id, 'PURCHASE').catch(joinError =>
        console.error('Failed to add buyer to fan list:', joinError)
      );
    }

    return { purchaseId, checkoutUrl: session.url };
  } catch (error) {
    const failed = await prisma.purchases
      .updateMany({
        where: { id: purchaseId, status: PURCHASE_STATUS.PENDING },
        data: { status: PURCHASE_STATUS.FAILED },
      })
      .catch(updateError => {
        console.error('Failed to mark purchase failed:', updateError);
        return { count: 0 };
      });
    if (failed.count === 1) {
      await releaseHold();
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Webhook handling. Each handler is safe to run more than once for the same
// event: state changes are guarded on the current status.
// ---------------------------------------------------------------------------

export function isPurchaseCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return (
    session.mode === 'payment' &&
    session.metadata?.kind === PURCHASE_METADATA_KIND &&
    Boolean(session.metadata?.purchaseId)
  );
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === 'string' ? pi : pi.id;
}

async function findPurchaseForSession(session: Stripe.Checkout.Session) {
  const purchaseId = session.metadata?.purchaseId;
  if (!purchaseId) return null;

  const purchase = await prisma.purchases.findUnique({ where: { id: purchaseId } });
  if (!purchase) {
    // Our own metadata points at a row we don't have: retrying won't help.
    console.error(`Purchase ${purchaseId} from checkout session ${session.id} not found`);
    return null;
  }

  if (purchase.stripeCheckoutSessionId && purchase.stripeCheckoutSessionId !== session.id) {
    console.error(`Checkout session ${session.id} does not match purchase ${purchaseId}; ignoring`);
    return null;
  }

  return purchase;
}

/** checkout.session.completed / checkout.session.async_payment_succeeded */
export async function handlePurchaseCheckoutPaid(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') {
    // Delayed payment method: wait for checkout.session.async_payment_succeeded.
    return;
  }

  const purchase = await findPurchaseForSession(session);
  if (!purchase) return;

  const amountCents = session.amount_total ?? decimalToCents(purchase.amount);
  if (amountCents !== decimalToCents(purchase.amount)) {
    console.error(
      `Checkout session ${session.id} total ${amountCents} differs from purchase ${purchase.id}`
    );
  }

  // Only the first transition into PAID counts, so a duplicate or out-of-order
  // event can't credit the artist twice. A purchase still PENDING holds its
  // drop unit; one that already failed or expired gave it back.
  const paidData = {
    status: PURCHASE_STATUS.PAID,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId(session),
    paidAt: new Date(),
  };

  let heldUnit = true;
  let transitioned = await prisma.purchases.updateMany({
    where: { id: purchase.id, status: PURCHASE_STATUS.PENDING },
    data: paidData,
  });

  if (transitioned.count !== 1) {
    heldUnit = false;
    transitioned = await prisma.purchases.updateMany({
      where: {
        id: purchase.id,
        status: { in: [PURCHASE_STATUS.FAILED, PURCHASE_STATUS.EXPIRED] },
      },
      data: paidData,
    });
  }

  if (transitioned.count !== 1) {
    return;
  }

  const artistEarnings =
    (decimalToCents(purchase.amount) - decimalToCents(purchase.platformFee)) / 100;

  await prisma.artists.update({
    where: { userId: purchase.artistId },
    data: { totalEarnings: { increment: artistEarnings } },
  });

  if (purchase.itemType === 'DROP') {
    if (!heldUnit) {
      console.warn(
        `Purchase ${purchase.id} was paid after its checkout ended; counting it without a held unit`
      );
    }
    await confirmDropUnit(purchase.itemId, heldUnit);
  }

  await emitMarketingEvent({
    type: purchaseEventType(purchase.itemType),
    artistId: purchase.artistId,
    fanId: purchase.fanId,
    data: {
      purchaseId: purchase.id,
      itemType: purchase.itemType,
      itemId: purchase.itemId,
      title: purchase.title,
      amount: purchase.amount.toString(),
      currency: purchase.currency,
    },
  });
}

/** The marketing feed event for a paid purchase of this kind of item. */
function purchaseEventType(itemType: string): MarketingEventType {
  if (itemType === 'DROP') return 'drop.purchased';
  if (itemType === 'LIVE_STREAM_TICKET') return 'ticket.purchased';
  return 'purchase.completed';
}

async function endPendingPurchase(
  session: Stripe.Checkout.Session,
  status: typeof PURCHASE_STATUS.FAILED | typeof PURCHASE_STATUS.EXPIRED
): Promise<void> {
  const purchase = await findPurchaseForSession(session);
  if (!purchase) return;

  const transitioned = await prisma.purchases.updateMany({
    where: { id: purchase.id, status: PURCHASE_STATUS.PENDING },
    data: { status },
  });

  if (transitioned.count === 1 && purchase.itemType === 'DROP') {
    await releaseDropUnit(purchase.itemId);
  }
}

/** checkout.session.async_payment_failed */
export async function handlePurchaseCheckoutFailed(
  session: Stripe.Checkout.Session
): Promise<void> {
  await endPendingPurchase(session, PURCHASE_STATUS.FAILED);
}

/** checkout.session.expired */
export async function handlePurchaseCheckoutExpired(
  session: Stripe.Checkout.Session
): Promise<void> {
  await endPendingPurchase(session, PURCHASE_STATUS.EXPIRED);
}

/** charge.refunded: a full refund takes the item back. */
export async function handlePurchaseChargeRefunded(charge: Stripe.Charge): Promise<void> {
  if (!charge.refunded) {
    // Partial refund: the fan keeps the item.
    return;
  }

  const pi = charge.payment_intent;
  const piId = typeof pi === 'string' ? pi : pi?.id;
  if (!piId) return;

  const purchase = await prisma.purchases.findUnique({ where: { stripePaymentIntentId: piId } });
  if (!purchase) return;

  const transitioned = await prisma.purchases.updateMany({
    where: { id: purchase.id, status: PURCHASE_STATUS.PAID },
    data: { status: PURCHASE_STATUS.REFUNDED, refundedAt: new Date() },
  });

  if (transitioned.count !== 1) return;

  const artistEarnings =
    (decimalToCents(purchase.amount) - decimalToCents(purchase.platformFee)) / 100;

  await prisma.artists.update({
    where: { userId: purchase.artistId },
    data: { totalEarnings: { decrement: artistEarnings } },
  });

  if (purchase.itemType === 'DROP') {
    await prisma.drops.updateMany({
      where: { id: purchase.itemId, soldCount: { gt: 0 } },
      data: { soldCount: { decrement: 1 } },
    });
  }
}
