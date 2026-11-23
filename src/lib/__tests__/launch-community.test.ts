jest.mock('@/lib/prisma', () => ({
  prisma: {
    communities: { findUnique: jest.fn(), create: jest.fn() },
    artists: { findMany: jest.fn() },
    artist_invites: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { hashInviteCode } from '@/lib/artist-invites';
import {
  getLaunchSetupStatus,
  LAUNCH_LINEUP,
  launchSetupSchema,
  setupLaunchCommunity,
} from '@/lib/launch-community';
import { inviteSignupUrl, readInviteFromHash } from '@/lib/invite-link';

const db = prisma as any;
const now = new Date('2026-11-23T12:00:00Z');
const community = { id: 'com-1', slug: 'launch', name: 'Launch community' };
const input = launchSetupSchema.parse({ slug: 'launch', name: 'Launch community' });

beforeEach(() => {
  jest.resetAllMocks();
  // No community until this run creates it; invites then find it.
  db.communities.findUnique.mockResolvedValueOnce(null).mockResolvedValue(community);
  db.communities.create.mockResolvedValue(community);
  db.artists.findMany.mockResolvedValue([]);
  db.artist_invites.findMany.mockResolvedValue([]);
  db.artist_invites.updateMany.mockResolvedValue({ count: 1 });
  db.artist_invites.create.mockImplementation(({ data }: any) =>
    Promise.resolve({
      id: data.id,
      communityId: data.communityId,
      email: data.email,
      label: data.label,
      featuredRank: data.featuredRank,
      expiresAt: data.expiresAt,
    })
  );
});

describe('LAUNCH_LINEUP', () => {
  it('puts Nahvee first and Never More second', () => {
    expect(LAUNCH_LINEUP).toEqual([
      { label: 'Nahvee', featuredRank: 1 },
      { label: 'Never More', featuredRank: 2 },
    ]);
  });
});

describe('setupLaunchCommunity', () => {
  it('creates the community and one invite per slot, in lineup order', async () => {
    const result = await setupLaunchCommunity(input, 'admin-1', {
      now,
      appUrl: 'https://www.directfanz.io/',
    });

    expect(result.community).toEqual({ ...community, created: true });
    expect(result.slots.map(slot => [slot.label, slot.featuredRank, slot.status])).toEqual([
      ['Nahvee', 1, 'invite_created'],
      ['Never More', 2, 'invite_created'],
    ]);

    const created = db.artist_invites.create.mock.calls.map((call: any) => call[0].data);
    expect(created.map((data: any) => [data.label, data.featuredRank])).toEqual([
      ['Nahvee', 1],
      ['Never More', 2],
    ]);

    // Only the hash is stored; the code is returned once, in a link fragment.
    const slot = result.slots[0];
    expect(created[0].codeHash).toBe(hashInviteCode(slot.invite!.code!));
    expect(slot.invite!.signupUrl).toBe(
      `https://www.directfanz.io/auth/signup#invite=${encodeURIComponent(slot.invite!.code!)}`
    );
  });

  it('locks an invite to the email the admin gives for that slot', async () => {
    await setupLaunchCommunity(
      launchSetupSchema.parse({
        slug: 'launch',
        name: 'Launch community',
        artists: [{ label: 'never more', email: 'Team@Example.com' }],
      }),
      'admin-1',
      { now }
    );

    const created = db.artist_invites.create.mock.calls.map((call: any) => call[0].data);
    expect(created[0].email).toBeNull();
    expect(created[1].email).toBe('team@example.com');
  });

  it('is safe to run again: keeps the community, joined artists and open invites', async () => {
    db.communities.findUnique.mockReset().mockResolvedValue(community);
    db.artists.findMany.mockResolvedValue([{ userId: 'user-nahvee', featuredRank: 1 }]);
    db.artist_invites.findMany.mockResolvedValue([
      { id: 'inv-2', label: 'Never More', email: null, expiresAt: new Date('2026-12-01') },
    ]);

    const result = await setupLaunchCommunity(input, 'admin-1', { now });

    expect(db.communities.create).not.toHaveBeenCalled();
    expect(db.artist_invites.create).not.toHaveBeenCalled();
    expect(result.community.created).toBe(false);
    expect(result.slots[0]).toMatchObject({ status: 'joined', artistUserId: 'user-nahvee' });
    expect(result.slots[1]).toMatchObject({ status: 'invite_pending', invite: { id: 'inv-2' } });
    expect(result.slots[1].invite!.code).toBeUndefined();
  });

  it('replaces an open invite when asked, ending the old code first', async () => {
    db.communities.findUnique.mockReset().mockResolvedValue(community);
    db.artist_invites.findMany.mockResolvedValue([
      { id: 'inv-1', label: 'Nahvee', email: 'n@example.com', expiresAt: new Date('2026-12-01') },
    ]);

    const result = await setupLaunchCommunity(
      launchSetupSchema.parse({ slug: 'launch', name: 'Launch community', reissue: ['Nahvee'] }),
      'admin-1',
      { now }
    );

    expect(db.artist_invites.updateMany).toHaveBeenCalledWith({
      where: {
        communityId: 'com-1',
        label: 'Nahvee',
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { expiresAt: now },
    });
    expect(result.slots[0].status).toBe('invite_created');
    // The new invite keeps the old email lock.
    expect(db.artist_invites.create.mock.calls[0][0].data.email).toBe('n@example.com');
  });

  it('refuses a name that is not in the lineup', async () => {
    await expect(
      setupLaunchCommunity(
        launchSetupSchema.parse({
          slug: 'launch',
          name: 'Launch community',
          artists: [{ label: 'Somebody', email: 'x@example.com' }],
        }),
        'admin-1',
        { now }
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(db.communities.create).not.toHaveBeenCalled();
  });

  it('uses the community another run created a moment ago', async () => {
    db.communities.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));

    const result = await setupLaunchCommunity(input, 'admin-1', { now });

    expect(result.community).toEqual({ ...community, created: false });
  });
});

describe('getLaunchSetupStatus', () => {
  it('reports each slot without changing anything or showing codes', async () => {
    db.communities.findUnique.mockReset().mockResolvedValue(community);
    db.artist_invites.findMany.mockResolvedValue([
      { id: 'inv-1', label: 'Nahvee', email: null, expiresAt: new Date('2026-12-01') },
    ]);

    const status = await getLaunchSetupStatus('launch', now);

    expect(status!.slots.map(slot => slot.status)).toEqual(['invite_pending', 'not_invited']);
    expect(db.artist_invites.create).not.toHaveBeenCalled();
    expect(JSON.stringify(status)).not.toContain('code');
  });

  it('returns null for an unknown community', async () => {
    db.communities.findUnique.mockReset().mockResolvedValue(null);
    expect(await getLaunchSetupStatus('nope', now)).toBeNull();
  });
});

describe('invite links', () => {
  it('round-trips a code through the link fragment', () => {
    const url = inviteSignupUrl('ab-c_1', 'https://app.example.com')!;
    expect(readInviteFromHash(new URL(url).hash)).toBe('ab-c_1');
  });

  it('gives no link without an app URL and ignores fragments without a code', () => {
    expect(inviteSignupUrl('abc', undefined)).toBeUndefined();
    expect(readInviteFromHash('')).toBeNull();
    expect(readInviteFromHash('#other=1')).toBeNull();
    expect(readInviteFromHash(`#invite=${'x'.repeat(201)}`)).toBeNull();
  });
});
