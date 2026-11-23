import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isActiveMember, toPublicDrop } from '@/lib/drops';
import type { StageDrop, StageTier, StageViewer } from './types';

/**
 * Read-only helpers that turn existing library results into stage view
 * models. No prices or access rules are decided here; those stay in
 * src/lib (drops.ts, purchases.ts, stream-access.ts).
 */

type PublicDrop = ReturnType<typeof toPublicDrop>;

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

export function toStageDrop(
  drop: PublicDrop,
  artistName: string,
  artwork: string | null,
  /** The cap, when the caller has the raw row (the public shape leaves it out). */
  quantityLimit: number | null = null
): StageDrop {
  return {
    id: drop.id,
    artistId: drop.artistId,
    artistName,
    title: drop.title,
    description: drop.description,
    priceType: drop.priceType,
    price: drop.price,
    memberPrice: drop.memberPrice,
    memberDiscountPercent: drop.memberDiscountPercent,
    startsAt: iso(drop.startsAt) ?? new Date(0).toISOString(),
    presaleStartsAt: iso(drop.presaleStartsAt),
    endsAt: iso(drop.endsAt),
    quantityLimit,
    remaining: drop.remaining,
    itemCount: drop.itemCount,
    availability: drop.availability,
    artwork,
  };
}

/** The artist's active membership tier (the first, if more than one is active). */
export async function getActiveTier(artistId: string): Promise<StageTier | null> {
  const tier = await prisma.tiers.findFirst({
    where: { artistId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, description: true, minimumPrice: true },
  });
  if (!tier) return null;
  return {
    id: tier.id,
    name: tier.name,
    description: tier.description,
    price: Number(tier.minimumPrice.toString()),
  };
}

export async function getViewer(): Promise<StageViewer & { userId: string | null }> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  return {
    userId,
    signedIn: Boolean(userId),
    isFan: session?.user?.role === 'FAN',
  };
}

export async function viewerIsMember(userId: string | null, artistId: string): Promise<boolean> {
  return userId ? isActiveMember(userId, artistId) : false;
}
