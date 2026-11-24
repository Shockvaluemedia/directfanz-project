jest.mock('@/lib/validations', () => jest.requireActual('@/lib/validations'));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashInviteCode } from '@/lib/artist-invites';
import { POST as register } from '../register/route';

const db = prisma as any;

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const artist = {
  email: 'nahvee@example.com',
  password: 'a-long-password',
  displayName: 'Nahvee',
  role: 'ARTIST',
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ARTIST_SIGNUP;
  db.$transaction.mockImplementation((callback: any) => callback(db));
  db.users.findUnique.mockResolvedValue(null);
  db.users.create.mockImplementation(({ data }: any) => ({ ...data, avatar: null }));
  db.artists.create.mockResolvedValue({});
  db.artist_invites.updateMany.mockResolvedValue({ count: 1 });
});

describe('invite-only artist sign-up', () => {
  it('refuses an artist without an invite, before creating anything', async () => {
    const res = await register(request(artist));

    expect(res.status).toBe(403);
    expect(db.users.create).not.toHaveBeenCalled();
    expect(db.artists.create).not.toHaveBeenCalled();
  });

  it('refuses an artist with a code that is not valid', async () => {
    db.artist_invites.findUnique.mockResolvedValue(null);

    const res = await register(request({ ...artist, inviteCode: 'wrong' }));

    expect(res.status).toBe(403);
    expect(db.artists.create).not.toHaveBeenCalled();
  });

  it('signs up an invited artist into the invite’s community', async () => {
    db.artist_invites.findUnique.mockResolvedValue({
      id: 'inv-1',
      communityId: 'com-1',
      email: 'nahvee@example.com',
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
    });

    const res = await register(request({ ...artist, inviteCode: 'code-1' }));

    expect(res.status).toBe(200);
    expect(db.artist_invites.findUnique.mock.calls[0][0].where).toEqual({
      codeHash: hashInviteCode('code-1'),
    });
    expect(db.artists.create.mock.calls[0][0].data).toMatchObject({
      communityId: 'com-1',
      featuredRank: null,
    });
  });

  it('gives the artist the home-page place their invite names', async () => {
    db.artist_invites.findUnique.mockResolvedValue({
      id: 'inv-1',
      communityId: 'com-1',
      email: null,
      featuredRank: 1,
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
    });

    const res = await register(request({ ...artist, inviteCode: 'code-1' }));

    expect(res.status).toBe(200);
    expect(db.artists.create.mock.calls[0][0].data).toMatchObject({
      communityId: 'com-1',
      featuredRank: 1,
    });
  });

  it('still lets fans sign up without an invite', async () => {
    const res = await register(request({ ...artist, role: 'FAN', displayName: 'A fan' }));

    expect(res.status).toBe(200);
    expect(db.users.create).toHaveBeenCalled();
    expect(db.artists.create).not.toHaveBeenCalled();
  });

  it('allows open artist sign-up when ARTIST_SIGNUP=open', async () => {
    process.env.ARTIST_SIGNUP = 'open';

    const res = await register(request(artist));

    expect(res.status).toBe(200);
    expect(db.artists.create.mock.calls[0][0].data).toMatchObject({ communityId: null });
    delete process.env.ARTIST_SIGNUP;
  });
});
