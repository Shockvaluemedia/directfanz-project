import { prisma } from '@/lib/prisma';
import { createCommunity, getCommunityHome, placeArtist } from '@/lib/community';

const db = prisma as any;
const now = new Date('2026-11-22T12:00:00Z');

const community = {
  id: 'com-1',
  slug: 'shock-value',
  name: 'Shock Value',
  description: 'Our artists',
  createdAt: now,
};

const artistRow = (id: string, displayName: string, featuredRank: number | null) => ({
  featuredRank,
  users: { id, displayName, avatar: null, bio: null },
});

const dropRow = (id: string, artistId: string, startsAt: string) => ({
  id,
  artistId,
  title: id,
  description: null,
  priceType: 'FIXED',
  price: { toString: () => '5' },
  currency: 'usd',
  startsAt: new Date(startsAt),
  endsAt: null,
  quantityLimit: null,
  soldCount: 0,
  status: 'PUBLISHED',
  drop_content: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  db.communities.findUnique.mockResolvedValue(community);
  db.communities.findFirst.mockResolvedValue(community);
  db.artists.findMany.mockResolvedValue([
    artistRow('nahvee', 'Nahvee', 1),
    artistRow('never-more', 'Never More', 2),
    artistRow('new-artist', 'New Artist', null),
  ]);
  db.drops.findMany.mockResolvedValue([
    dropRow('nm-single', 'never-more', '2026-11-20T00:00:00Z'),
    dropRow('nahvee-ep', 'nahvee', '2026-11-25T00:00:00Z'),
  ]);
  db.live_streams.findMany.mockResolvedValue([]);
});

describe('community home', () => {
  it('puts the headliner first, then the rest in their set order', async () => {
    const home = await getCommunityHome('shock-value', now);

    expect(home?.headliner).toMatchObject({ id: 'nahvee', displayName: 'Nahvee' });
    expect(home?.artists.map(a => a.id)).toEqual(['nahvee', 'never-more', 'new-artist']);
    expect(db.artists.findMany.mock.calls[0][0]).toMatchObject({
      where: { communityId: 'com-1', users: { status: 'ACTIVE' } },
      orderBy: [{ featuredRank: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
  });

  it('shows the headliner’s drops first, and only current ones from this community', async () => {
    const home = await getCommunityHome('shock-value', now);

    expect(home?.drops.map(d => d.id)).toEqual(['nahvee-ep', 'nm-single']);
    expect(db.drops.findMany.mock.calls[0][0].where).toEqual({
      artistId: { in: ['nahvee', 'never-more', 'new-artist'] },
      status: 'PUBLISHED',
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    });
    expect(db.live_streams.findMany.mock.calls[0][0].where.artistId).toEqual({
      in: ['nahvee', 'never-more', 'new-artist'],
    });
  });

  it('uses the oldest community when no slug is set', async () => {
    await getCommunityHome(undefined, now);

    expect(db.communities.findFirst).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
  });

  it('is null when there is no community yet', async () => {
    db.communities.findUnique.mockResolvedValue(null);

    await expect(getCommunityHome('nope', now)).resolves.toBeNull();
  });
});

describe('admin setup', () => {
  it('creates a community, refusing a slug already in use', async () => {
    db.communities.findUnique.mockResolvedValueOnce(null);
    db.communities.create.mockImplementation(({ data }: any) => data);

    await expect(
      createCommunity({ slug: 'shock-value', name: 'Shock Value' })
    ).resolves.toMatchObject({ slug: 'shock-value', name: 'Shock Value', description: null });

    db.communities.findUnique.mockResolvedValueOnce({ id: 'com-1' });
    await expect(createCommunity({ slug: 'shock-value', name: 'Again' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('places an artist in the community as headliner', async () => {
    db.artists.findUnique.mockResolvedValue({ id: 'a-1' });
    db.artists.update.mockResolvedValue({});

    await placeArtist('nahvee', { communityId: 'com-1', featuredRank: 1 });

    expect(db.artists.update).toHaveBeenCalledWith({
      where: { userId: 'nahvee' },
      data: { communityId: 'com-1', featuredRank: 1 },
      select: { userId: true, communityId: true, featuredRank: true },
    });
  });

  it('refuses an unknown artist', async () => {
    db.artists.findUnique.mockResolvedValue(null);

    await expect(placeArtist('nobody', { featuredRank: 1 })).rejects.toMatchObject({
      status: 404,
    });
  });
});
