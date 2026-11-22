import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Drops: content an artist sells once (a single, an EP, a bundle), at a fixed
 * price or pay-what-you-want with a minimum. Buying a drop unlocks its content
 * for good. Payment goes through the one-time purchase path (src/lib/purchases.ts).
 */

export const DROP_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const DROP_PRICE_TYPES = ['FIXED', 'PAY_WHAT_YOU_WANT'] as const;
export type DropPriceType = (typeof DROP_PRICE_TYPES)[number];

/** Stripe's smallest card charge in USD. */
export const MIN_DROP_PRICE_CENTS = 50;
/** Upper bound on a single drop payment, so a typo can't charge a fan thousands. */
export const MAX_DROP_PAYMENT_CENTS = 100_000;

export class DropError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'DropError';
  }
}

export function toCents(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Math.round(parseFloat(value.toString()) * 100);
}

const priceDollars = z
  .number()
  .finite()
  .refine(v => Math.round(v * 100) >= MIN_DROP_PRICE_CENTS, {
    message: `Price must be at least $${(MIN_DROP_PRICE_CENTS / 100).toFixed(2)}`,
  })
  .refine(v => Math.round(v * 100) <= MAX_DROP_PAYMENT_CENTS, {
    message: `Price must be at most $${(MAX_DROP_PAYMENT_CENTS / 100).toFixed(2)}`,
  });

const dropFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  priceType: z.enum(DROP_PRICE_TYPES),
  price: priceDollars,
  startsAt: z.coerce.date(),
  presaleStartsAt: z.coerce.date().nullish(),
  memberDiscountPercent: z.number().int().min(1).max(90).nullish(),
  endsAt: z.coerce.date().nullish(),
  quantityLimit: z.number().int().min(1).max(1_000_000).nullish(),
  contentIds: z.array(z.string().min(1)).min(1).max(50),
  status: z.enum([DROP_STATUS.DRAFT, DROP_STATUS.PUBLISHED]).optional(),
};

export const createDropSchema = z
  .object(dropFields)
  .strict()
  .refine(d => !d.endsAt || d.endsAt > d.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .refine(d => !d.presaleStartsAt || d.presaleStartsAt < d.startsAt, {
    message: 'presaleStartsAt must be before startsAt',
    path: ['presaleStartsAt'],
  });

export const updateDropSchema = z
  .object({
    ...dropFields,
    status: z.enum([DROP_STATUS.DRAFT, DROP_STATUS.PUBLISHED, DROP_STATUS.ARCHIVED]),
  })
  .partial()
  .strict();

export type CreateDropInput = z.infer<typeof createDropSchema>;
export type UpdateDropInput = z.infer<typeof updateDropSchema>;

/** Content in a drop must be the artist's own, and not already free to everyone. */
async function assertSellableContent(artistId: string, contentIds: string[]): Promise<void> {
  const unique = Array.from(new Set(contentIds));
  const owned = await prisma.content.findMany({
    where: { id: { in: unique }, artistId },
    select: { id: true, visibility: true },
  });

  if (owned.length !== unique.length) {
    throw new DropError('Some content was not found', 400);
  }

  if (owned.some(c => c.visibility === 'PUBLIC')) {
    throw new DropError('Public content is already free; make it private before selling it', 400);
  }
}

export async function createDrop(artistId: string, input: CreateDropInput) {
  await assertSellableContent(artistId, input.contentIds);

  const id = crypto.randomUUID();
  return prisma.drops.create({
    data: {
      id,
      artistId,
      title: input.title,
      description: input.description ?? null,
      priceType: input.priceType,
      price: toCents(input.price) / 100,
      startsAt: input.startsAt,
      presaleStartsAt: input.presaleStartsAt ?? null,
      memberDiscountPercent: input.memberDiscountPercent ?? null,
      endsAt: input.endsAt ?? null,
      quantityLimit: input.quantityLimit ?? null,
      status: input.status ?? DROP_STATUS.DRAFT,
      drop_content: {
        create: Array.from(new Set(input.contentIds)).map(contentId => ({ contentId })),
      },
    },
    include: { drop_content: { select: { contentId: true } } },
  });
}

export async function updateDrop(artistId: string, dropId: string, input: UpdateDropInput) {
  const drop = await prisma.drops.findUnique({ where: { id: dropId } });
  if (!drop || drop.artistId !== artistId) {
    throw new DropError('Drop not found', 404);
  }

  // Once someone has paid, or is paying, what they buy must not change under them.
  const claimed = claimedUnits(drop);
  if (
    claimed > 0 &&
    (input.price !== undefined ||
      input.priceType !== undefined ||
      input.memberDiscountPercent !== undefined ||
      input.contentIds !== undefined)
  ) {
    throw new DropError('Price and content cannot change after the first sale', 409);
  }

  if (input.quantityLimit != null && input.quantityLimit < claimed) {
    throw new DropError(
      'Quantity limit cannot be below the number already sold or in checkout',
      400
    );
  }

  const startsAt = input.startsAt ?? drop.startsAt;
  const endsAt = input.endsAt === undefined ? drop.endsAt : input.endsAt;
  if (endsAt && endsAt <= startsAt) {
    throw new DropError('endsAt must be after startsAt', 400);
  }
  const presaleStartsAt =
    input.presaleStartsAt === undefined ? drop.presaleStartsAt : input.presaleStartsAt;
  if (presaleStartsAt && presaleStartsAt >= startsAt) {
    throw new DropError('presaleStartsAt must be before startsAt', 400);
  }

  if (input.contentIds) {
    await assertSellableContent(artistId, input.contentIds);
  }

  return prisma.drops.update({
    where: { id: dropId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.priceType !== undefined ? { priceType: input.priceType } : {}),
      ...(input.price !== undefined ? { price: toCents(input.price) / 100 } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.presaleStartsAt !== undefined
        ? { presaleStartsAt: input.presaleStartsAt ?? null }
        : {}),
      ...(input.memberDiscountPercent !== undefined
        ? { memberDiscountPercent: input.memberDiscountPercent ?? null }
        : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ?? null } : {}),
      ...(input.quantityLimit !== undefined ? { quantityLimit: input.quantityLimit ?? null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.contentIds
        ? {
            drop_content: {
              deleteMany: {},
              create: Array.from(new Set(input.contentIds)).map(contentId => ({ contentId })),
            },
          }
        : {}),
    },
    include: { drop_content: { select: { contentId: true } } },
  });
}

/**
 * presale: in the members-only window before startsAt. Members may buy;
 * everyone else sees it as coming soon.
 */
export type DropAvailability =
  | 'on_sale'
  | 'presale'
  | 'not_started'
  | 'ended'
  | 'sold_out'
  | 'unavailable';

/** Units paid for plus units held by checkouts still in progress. */
export function claimedUnits(drop: { soldCount: number; reservedCount?: number | null }): number {
  return drop.soldCount + (drop.reservedCount ?? 0);
}

export function getDropAvailability(
  drop: {
    status: string;
    startsAt: Date;
    presaleStartsAt?: Date | null;
    endsAt: Date | null;
    quantityLimit: number | null;
    soldCount: number;
    reservedCount?: number | null;
  },
  now: Date = new Date()
): DropAvailability {
  if (drop.status !== DROP_STATUS.PUBLISHED) return 'unavailable';
  const inPresale = Boolean(drop.presaleStartsAt && now >= drop.presaleStartsAt);
  if (now < drop.startsAt && !inPresale) return 'not_started';
  if (drop.endsAt && now >= drop.endsAt) return 'ended';
  if (drop.quantityLimit != null && claimedUnits(drop) >= drop.quantityLimit) return 'sold_out';
  return now < drop.startsAt ? 'presale' : 'on_sale';
}

/** A fan with an active membership (any tier) of the artist: who may buy in a presale. */
export async function isActiveMember(fanId: string, artistId: string): Promise<boolean> {
  const membership = await prisma.subscriptions.findFirst({
    where: { fanId, artistId, status: 'ACTIVE' },
    select: { id: true },
  });
  return Boolean(membership);
}

/**
 * The amount a fan pays for a drop, in cents. A fixed drop takes no amount from
 * the fan; a pay-what-you-want drop takes any amount from the minimum up to
 * MAX_DROP_PAYMENT_CENTS, defaulting to the minimum.
 */
/**
 * The drop's price (or pay-what-you-want minimum) for a member: the member
 * discount off, never under Stripe's minimum charge.
 */
export function memberPriceCents(drop: {
  price: { toString(): string };
  memberDiscountPercent?: number | null;
}): number {
  const priceCents = toCents(drop.price);
  const discount = drop.memberDiscountPercent ?? 0;
  if (discount <= 0) return priceCents;
  return Math.max(MIN_DROP_PRICE_CENTS, Math.round((priceCents * (100 - discount)) / 100));
}

/**
 * What the fan pays: the fixed price, or their chosen amount at or above the
 * minimum. A member gets the member price (see memberPriceCents) instead.
 */
export function resolveDropAmountCents(
  drop: {
    priceType: string;
    price: { toString(): string };
    memberDiscountPercent?: number | null;
  },
  requestedCents?: number,
  options: { member?: boolean } = {}
): number {
  const priceCents = options.member ? memberPriceCents(drop) : toCents(drop.price);

  if (drop.priceType !== 'PAY_WHAT_YOU_WANT') {
    if (requestedCents !== undefined) {
      throw new DropError('This drop has a fixed price', 400);
    }
    return priceCents;
  }

  if (requestedCents === undefined) return priceCents;

  if (!Number.isInteger(requestedCents)) {
    throw new DropError('Amount must be in whole cents', 400);
  }
  if (requestedCents < priceCents) {
    throw new DropError(`Amount must be at least $${(priceCents / 100).toFixed(2)}`, 400);
  }
  if (requestedCents > MAX_DROP_PAYMENT_CENTS) {
    throw new DropError(
      `Amount must be at most $${(MAX_DROP_PAYMENT_CENTS / 100).toFixed(2)}`,
      400
    );
  }
  return requestedCents;
}

/** What a fan may see of a drop before buying it: no file URLs. */
export function toPublicDrop(drop: {
  id: string;
  artistId: string;
  title: string;
  description: string | null;
  priceType: string;
  price: { toString(): string };
  currency: string;
  startsAt: Date;
  presaleStartsAt?: Date | null;
  memberDiscountPercent?: number | null;
  endsAt: Date | null;
  quantityLimit: number | null;
  soldCount: number;
  reservedCount?: number | null;
  status: string;
  drop_content?: Array<{ contentId: string }>;
}) {
  return {
    id: drop.id,
    artistId: drop.artistId,
    title: drop.title,
    description: drop.description,
    priceType: drop.priceType,
    price: toCents(drop.price) / 100,
    currency: drop.currency,
    startsAt: drop.startsAt,
    presaleStartsAt: drop.presaleStartsAt ?? null,
    memberDiscountPercent: drop.memberDiscountPercent ?? null,
    memberPrice: drop.memberDiscountPercent ? memberPriceCents(drop) / 100 : null,
    endsAt: drop.endsAt,
    remaining:
      drop.quantityLimit != null ? Math.max(drop.quantityLimit - claimedUnits(drop), 0) : null,
    itemCount: drop.drop_content?.length ?? 0,
    availability: getDropAvailability(drop),
  };
}

// ---------------------------------------------------------------------------
// Stock. A checkout holds one unit (reservedCount) from the moment it is
// created until it is paid (moves to soldCount) or fails or expires (released).
// The hold is taken with one conditional UPDATE, so two fans can never both
// get the last unit of a capped drop.
// ---------------------------------------------------------------------------

/**
 * Hold one unit of a drop for a checkout. Returns false when the drop is not
 * on sale or every unit is already sold or held. `presale` lets the hold be
 * taken in the presale window; the caller has already checked the fan is a
 * member.
 */
export async function reserveDropUnit(dropId: string, presale = false): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "drops"
    SET "reservedCount" = "reservedCount" + 1, "updatedAt" = NOW()
    WHERE "id" = ${dropId}
      AND "status" = 'PUBLISHED'
      AND ("startsAt" <= NOW()
        OR (${presale} AND "presaleStartsAt" IS NOT NULL AND "presaleStartsAt" <= NOW()))
      AND ("endsAt" IS NULL OR "endsAt" > NOW())
      AND ("quantityLimit" IS NULL OR "soldCount" + "reservedCount" < "quantityLimit")
  `;
  return updated === 1;
}

/** Give back a unit held by a checkout that failed or expired. */
export async function releaseDropUnit(dropId: string): Promise<void> {
  await prisma.drops.updateMany({
    where: { id: dropId, reservedCount: { gt: 0 } },
    data: { reservedCount: { decrement: 1 } },
  });
}

/**
 * Count a paid unit as sold. When the checkout still held its unit, the hold
 * becomes the sale. A payment that lands after its checkout already failed or
 * expired had no hold; it is counted anyway, because the fan has paid.
 */
export async function confirmDropUnit(dropId: string, heldUnit: boolean): Promise<void> {
  if (heldUnit) {
    await prisma.$executeRaw`
      UPDATE "drops"
      SET "soldCount" = "soldCount" + 1,
          "reservedCount" = GREATEST("reservedCount" - 1, 0),
          "updatedAt" = NOW()
      WHERE "id" = ${dropId}
    `;
    return;
  }

  await prisma.drops.update({
    where: { id: dropId },
    data: { soldCount: { increment: 1 } },
  });
}
