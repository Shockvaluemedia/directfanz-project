const decode = jest.fn();
jest.mock('@/lib/auth', () => ({ authOptions: { jwt: { decode: (...args: unknown[]) => decode(...args) } } }));

import { prisma } from '@/lib/prisma';
import { authenticateSocket, sessionTokenFrom } from '@/lib/socket-auth';

const db = prisma as any;
const original = process.env.NEXTAUTH_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXTAUTH_SECRET = 'test-secret';
  decode.mockResolvedValue({ id: 'user_1' });
  db.users.findUnique.mockResolvedValue({ id: 'user_1', displayName: 'Nahvee', role: 'ARTIST', status: 'ACTIVE' });
});

afterAll(() => {
  if (original === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = original;
});

describe('sessionTokenFrom', () => {
  it('reads the NextAuth session cookie, secure name first', () => {
    expect(sessionTokenFrom({ headers: { cookie: 'a=1; next-auth.session-token=plain' } })).toBe('plain');
    expect(
      sessionTokenFrom({
        headers: { cookie: 'next-auth.session-token=plain; __Secure-next-auth.session-token=secure' },
      })
    ).toBe('secure');
  });

  it('falls back to an explicit auth token, and to nothing', () => {
    expect(sessionTokenFrom({ headers: {}, auth: { token: 'tok' } })).toBe('tok');
    expect(sessionTokenFrom({ headers: { cookie: 'other=1' } })).toBeNull();
  });
});

describe('authenticateSocket', () => {
  const handshake = { headers: { cookie: 'next-auth.session-token=signed.jwt' } };

  it('returns the real signed-in user', async () => {
    await expect(authenticateSocket(handshake)).resolves.toEqual({
      id: 'user_1',
      name: 'Nahvee',
      role: 'ARTIST',
    });
    expect(decode).toHaveBeenCalledWith({ token: 'signed.jwt', secret: 'test-secret' });
  });

  it('refuses a handshake without a session', async () => {
    await expect(authenticateSocket({ headers: {} })).resolves.toBeNull();
    expect(decode).not.toHaveBeenCalled();
  });

  it('refuses a token that does not verify', async () => {
    decode.mockResolvedValue(null);
    await expect(authenticateSocket(handshake)).resolves.toBeNull();
    decode.mockRejectedValue(new Error('bad signature'));
    await expect(authenticateSocket(handshake)).resolves.toBeNull();
  });

  it('refuses deleted and banned accounts', async () => {
    db.users.findUnique.mockResolvedValue(null);
    await expect(authenticateSocket(handshake)).resolves.toBeNull();
    db.users.findUnique.mockResolvedValue({ id: 'user_1', displayName: 'X', role: 'FAN', status: 'BANNED' });
    await expect(authenticateSocket(handshake)).resolves.toBeNull();
  });

  it('refuses everything when NEXTAUTH_SECRET is missing', async () => {
    delete process.env.NEXTAUTH_SECRET;
    await expect(authenticateSocket(handshake)).resolves.toBeNull();
  });

  it('takes the role from the account, not the token', async () => {
    decode.mockResolvedValue({ id: 'user_1', role: 'ADMIN' });
    db.users.findUnique.mockResolvedValue({ id: 'user_1', displayName: 'Fan', role: 'FAN', status: 'ACTIVE' });
    await expect(authenticateSocket(handshake)).resolves.toMatchObject({ role: 'FAN' });
  });
});
