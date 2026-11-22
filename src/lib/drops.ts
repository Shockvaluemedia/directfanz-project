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

  // Once someone has paid, what they bought must not change under them.
  const sold = drop.soldCount > 0;
  if (
    sold &&
    (input.price !== undefined || input.priceType !== undefined || input.contentIds !== undefined)
  ) {
    throw new DropError('Price and content cannot change after the first sale', 409);
  }

  if (input.quantityLimit != null && input.quantityLimit < drop.soldCount) {
    throw new DropError('Quantity limit cannot be below the number already sold', 400);
  }

  const startsAt = input.startsAt ?? drop.startsAt;
  const endsAt = input.endsAt === undefined ? drop.endsAt : input.endsAt;
  if (endsAt && endsAt <= startsAt) {
    throw new DropError('endsAt must be after startsAt', 400);
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

export type DropAvailability = 'on_sale' | 'not_started' | 'ended' | 'sold_out' | 'unavailable';

export function getDropAvailability(
  drop: {
    status: string;
    startsAt: Date;
    endsAt: Date | null;
    quantityLimit: number | null;
    soldCount: number;
  },
  now: Date = new Date()
): DropAvailability {
  if (drop.status !== DROP_STATUS.PUBLISHED) return 'unavailable';
  if (now < drop.startsAt) return 'not_started';
  if (drop.endsAt && now >= drop.endsAt) return 'ended';
  if (drop.quantityLimit != null && drop.soldCount >= drop.quantityLimit) return 'sold_out';
  return 'on_sale';
}

/**
 * The amount a fan pays for a drop, in cents. A fixed drop takes no amount from
 * the fan; a pay-what-you-want drop takes any amount from the minimum up to
 * MAX_DROP_PAYMENT_CENTS, defaulting to the minimum.
 */
export function resolveDropAmountCents(
  drop: { priceType: string; price: { toString(): string } },
  requestedCents?: number
): number {
  const priceCents = toCents(drop.price);

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
  endsAt: Date | null;
  quantityLimit: number | null;
  soldCount: number;
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
    endsAt: drop.endsAt,
    remaining: drop.quantityLimit != null ? Math.max(drop.quantityLimit - drop.soldCount, 0) : null,
    itemCount: drop.drop_content?.length ?? 0,
    availability: getDropAvailability(drop),
  };
}
