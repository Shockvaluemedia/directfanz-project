import { prisma } from '@/lib/prisma';
import {
  artistSignupIsOpen,
  createArtistInvite,
  hashInviteCode,
  InviteError,
  redeemArtistInvite,
} from '@/lib/artist-invites';

const db = prisma as any;
const now = new Date('2026-11-22T12:00:00Z');

const invite = {
  id: 'inv-1',
  communityId: 'com-1',
  email: null as string | null,
  expiresAt: new Date('2026-12-01T00:00:00Z'),
  usedAt: null as Date | null,
};

beforeEach(() => {
  jest.clearAllMocks();
  db.artist_invites.updateMany.mockResolvedValue({ count: 1 });
});

describe('making an invite', () => {
  it('stores only the code’s hash and returns the code once', async () => {
    db.communities.findUnique.mockResolvedValue({ id: 'com-1' });
    db.artist_invites.create.mockImplementation(({ data }: any) => ({
      id: data.id,
      communityId: data.communityId,
      email: data.email,
      expiresAt: data.expiresAt,
    }));

    const result = await createArtistInvite(
      { communityId: 'com-1', email: 'nahvee@example.com' },
      'admin-1',
      now
    );

    const data = db.artist_invites.create.mock.calls[0][0].data;
    expect(result.code.length).toBeGreaterThanOrEqual(20);
    expect(data.codeHash).toBe(hashInviteCode(result.code));
    expect(JSON.stringify(data)).not.toContain(result.code);
    expect(data).toMatchObject({ email: 'nahvee@example.com', createdBy: 'admin-1' });
    expect(data.expiresAt).toEqual(new Date('2026-12-06T12:00:00Z'));
  });

  it('refuses an unknown community', async () => {
    db.communities.findUnique.mockResolvedValue(null);

    await expect(createArtistInvite({ communityId: 'nope' }, 'admin-1')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('using an invite at sign-up', () => {
  it('claims the invite and returns its community', async () => {
    db.artist_invites.findUnique.mockResolvedValue(invite);

    await expect(
      redeemArtistInvite(db, ' code-1 ', 'artist@example.com', 'user-1', now)
    ).resolves.toEqual({ communityId: 'com-1', featuredRank: null });
    expect(db.artist_invites.findUnique.mock.calls[0][0].where).toEqual({
      codeHash: hashInviteCode('code-1'),
    });
    expect(db.artist_invites.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', usedAt: null },
      data: { usedAt: now, usedByUserId: 'user-1' },
    });
  });

  it.each([
    ['no code', undefined, invite, 'by invite only'],
    ['an unknown code', 'code-1', null, 'not valid'],
    ['a used code', 'code-1', { ...invite, usedAt: now }, 'not valid'],
    ['an expired code', 'code-1', { ...invite, expiresAt: now }, 'not valid'],
    [
      'a code for another email',
      'code-1',
      { ...invite, email: 'someone@example.com' },
      'another email',
    ],
  ])('refuses %s', async (_label, code, row, message) => {
    db.artist_invites.findUnique.mockResolvedValue(row);

    const error = await redeemArtistInvite(db, code, 'artist@example.com', 'user-1', now).catch(
      e => e
    );
    expect(error).toBeInstanceOf(InviteError);
    expect(error.status).toBe(403);
    expect(error.message).toContain(message);
    expect(db.artist_invites.updateMany).not.toHaveBeenCalled();
  });

  it('matches the invite email regardless of case', async () => {
    db.artist_invites.findUnique.mockResolvedValue({ ...invite, email: 'nahvee@example.com' });

    await expect(
      redeemArtistInvite(db, 'code-1', 'Nahvee@Example.com', 'user-1', now)
    ).resolves.toEqual({ communityId: 'com-1', featuredRank: null });
  });

  it('lets only one of two sign-ups use the same code', async () => {
    db.artist_invites.findUnique.mockResolvedValue(invite);
    db.artist_invites.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      redeemArtistInvite(db, 'code-1', 'artist@example.com', 'user-2', now)
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('artistSignupIsOpen', () => {
  it('is invite-only unless ARTIST_SIGNUP=open', () => {
    expect(artistSignupIsOpen({} as NodeJS.ProcessEnv)).toBe(false);
    expect(artistSignupIsOpen({ ARTIST_SIGNUP: 'yes' } as any)).toBe(false);
    expect(artistSignupIsOpen({ ARTIST_SIGNUP: 'open' } as any)).toBe(true);
  });
});
