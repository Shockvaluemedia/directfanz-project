import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { DROP_STATUS, toPublicDrop } from '@/lib/drops';
import { listUpcomingParties, type PublicParty } from '@/lib/parties';

/**
 * One community: DirectFanz launches with a single curated group of artists.
 * Artists join by invite, the community's own order decides who headlines
 * (the lowest featuredRank), and the home page shows that community's
 * artists, drops and listening parties instead of open discovery.
 */

export class CommunityError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'CommunityError';
  }
}

export const createCommunitySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes')
      .max(60),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).nullish(),
  })
  .strict();

/** Admin: create a community. */
export async function createCommunity(input: z.infer<typeof createCommunitySchema>) {
  const existing = await prisma.communities.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) throw new CommunityError('A community with this slug already exists', 409);

  return prisma.communities.create({
    data: {
      id: crypto.randomUUID(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
    },
  });
}

export const placeArtistSchema = z
  .object({
    communityId: z.string().min(1).nullable().optional(),
    featuredRank: z.number().int().min(1).max(10_000).nullable().optional(),
  })
  .strict();

/** Admin: put an artist in a community and set their place (1 headlines). */
export async function placeArtist(artistUserId: string, input: z.infer<typeof placeArtistSchema>) {
  const artist = await prisma.artists.findUnique({
    where: { userId: artistUserId },
    select: { id: true },
  });
  if (!artist) throw new CommunityError('Artist not found', 404);

  if (input.communityId) {
    const community = await prisma.communities.findUnique({
      where: { id: input.communityId },
      select: { id: true },
    });
    if (!community) throw new CommunityError('Community not found', 404);
  }

  return prisma.artists.update({
    where: { userId: artistUserId },
    data: {
      ...(input.communityId !== undefined ? { communityId: input.communityId } : {}),
      ...(input.featuredRank !== undefined ? { featuredRank: input.featuredRank } : {}),
    },
    select: { userId: true, communityId: true, featuredRank: true },
  });
}

export interface CommunityArtist {
  id: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  featuredRank: number | null;
}

const HOME_DROP_LIMIT = 24;

/**
 * The community home: its artists in their set order (headliner first), and
 * their drops and listening parties that are on sale or coming up, also in
 * artist order. Uses COMMUNITY_SLUG, or the oldest community when unset.
 */
export async function getCommunityHome(
  slug: string | undefined = process.env.COMMUNITY_SLUG,
  now: Date = new Date()
) {
  const community = slug
    ? await prisma.communities.findUnique({ where: { slug } })
    : await prisma.communities.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!community) return null;

  const rows = await prisma.artists.findMany({
    where: { communityId: community.id, users: { status: 'ACTIVE' } },
    orderBy: [{ featuredRank: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: {
      featuredRank: true,
      users: { select: { id: true, displayName: true, avatar: true, bio: true } },
    },
  });

  const artists: CommunityArtist[] = rows.map(row => ({
    id: row.users.id,
    displayName: row.users.displayName,
    avatar: row.users.avatar,
    bio: row.users.bio,
    featuredRank: row.featuredRank,
  }));
  const order = new Map(artists.map((artist, index) => [artist.id, index]));
  const byArtist = (a: { artistId: string }, b: { artistId: string }) =>
    (order.get(a.artistId) ?? 0) - (order.get(b.artistId) ?? 0);
  const ids = artists.map(artist => artist.id);

  const [dropRows, parties] = ids.length
    ? await Promise.all([
        prisma.drops.findMany({
          where: {
            artistId: { in: ids },
            status: DROP_STATUS.PUBLISHED,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
          orderBy: { startsAt: 'asc' },
          take: HOME_DROP_LIMIT,
          include: { drop_content: { select: { contentId: true } } },
        }),
        listUpcomingParties(ids),
      ])
    : [[], [] as PublicParty[]];

  return {
    community: {
      slug: community.slug,
      name: community.name,
      description: community.description,
    },
    headliner: artists[0] ?? null,
    artists,
    drops: dropRows.map(toPublicDrop).sort(byArtist),
    parties: parties
      .map(party => ({ ...party, artistId: party.artist.id }))
      .sort(byArtist)
      .map(({ artistId: _artistId, ...party }) => party),
  };
}
