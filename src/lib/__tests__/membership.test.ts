import { prisma } from '@/lib/prisma';
import { assertNoOtherActiveTier, getMemberPortalAccount, MembershipError } from '@/lib/membership';

const db = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('one membership per artist', () => {
  it('allows the first membership', async () => {
    db.tiers.findFirst.mockResolvedValue(null);

    await expect(assertNoOtherActiveTier('artist-1')).resolves.toBeUndefined();
    expect(db.tiers.findFirst.mock.calls[0][0].where).toEqual({
      artistId: 'artist-1',
      isActive: true,
    });
  });

  it('refuses a second active one', async () => {
    db.tiers.findFirst.mockResolvedValue({ id: 'tier-1' });

    await expect(assertNoOtherActiveTier('artist-1')).rejects.toMatchObject({ status: 409 });
  });

  it('ignores the tier being turned back on', async () => {
    db.tiers.findFirst.mockResolvedValue(null);

    await assertNoOtherActiveTier('artist-1', 'tier-2');
    expect(db.tiers.findFirst.mock.calls[0][0].where).toEqual({
      artistId: 'artist-1',
      isActive: true,
      id: { not: 'tier-2' },
    });
  });
});

describe('billing portal account', () => {
  it('uses the artist’s Stripe account from the database', async () => {
    db.subscriptions.findFirst.mockResolvedValue({ id: 'sub-1' });
    db.artists.findUnique.mockResolvedValue({ stripeAccountId: 'acct_artist' });

    await expect(getMemberPortalAccount('fan-1', 'artist-1')).resolves.toBe('acct_artist');
    expect(db.subscriptions.findFirst.mock.calls[0][0].where).toEqual({
      fanId: 'fan-1',
      artistId: 'artist-1',
    });
    expect(db.artists.findUnique.mock.calls[0][0].where).toEqual({ userId: 'artist-1' });
  });

  it('refuses a fan with no membership of that artist', async () => {
    db.subscriptions.findFirst.mockResolvedValue(null);

    const error = await getMemberPortalAccount('fan-1', 'artist-1').catch(e => e);
    expect(error).toBeInstanceOf(MembershipError);
    expect(error.status).toBe(404);
    expect(db.artists.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an artist without a Stripe account', async () => {
    db.subscriptions.findFirst.mockResolvedValue({ id: 'sub-1' });
    db.artists.findUnique.mockResolvedValue({ stripeAccountId: null });

    await expect(getMemberPortalAccount('fan-1', 'artist-1')).rejects.toMatchObject({
      status: 400,
    });
  });
});
