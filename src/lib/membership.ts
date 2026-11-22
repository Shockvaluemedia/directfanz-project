import { prisma } from '@/lib/prisma';

/**
 * Membership: one cheap monthly tier per artist (about $3), giving early
 * access to drops (presales) and a member discount on drops. It reuses the
 * tiers and subscriptions tables and the existing subscription checkout.
 */

export class MembershipError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'MembershipError';
  }
}

/**
 * An artist has one active membership tier. Refuses opening (or reactivating)
 * another while one is active. Older extra tiers stay as they are.
 */
export async function assertNoOtherActiveTier(artistId: string, exceptTierId?: string) {
  const active = await prisma.tiers.findFirst({
    where: {
      artistId,
      isActive: true,
      ...(exceptTierId ? { id: { not: exceptTierId } } : {}),
    },
    select: { id: true },
  });
  if (active) {
    throw new MembershipError(
      'You already have an active membership. Edit it, or turn it off before adding another.',
      409
    );
  }
}

/**
 * The Stripe account whose billing portal a fan may open for an artist: read
 * from our database, never from the request, and only when the fan has (or
 * had) a membership with that artist.
 */
export async function getMemberPortalAccount(fanId: string, artistId: string): Promise<string> {
  const membership = await prisma.subscriptions.findFirst({
    where: { fanId, artistId },
    select: { id: true },
  });
  if (!membership) {
    throw new MembershipError('No membership with this artist', 404);
  }

  const artist = await prisma.artists.findUnique({
    where: { userId: artistId },
    select: { stripeAccountId: true },
  });
  if (!artist?.stripeAccountId) {
    throw new MembershipError('This artist is not set up for payments', 400);
  }
  return artist.stripeAccountId;
}
