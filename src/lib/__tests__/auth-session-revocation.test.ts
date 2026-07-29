import { prisma } from '@/lib/prisma';

jest.unmock('@/lib/auth');

const { authOptions } = require('@/lib/auth');

const secret = 'test-next-auth-secret-with-enough-entropy';

async function encodeToken(sessionVersion?: number) {
  return authOptions.jwt!.encode!({
    secret,
    maxAge: 7200,
    token: {
      id: 'user-123',
      sub: 'user-123',
      role: 'FAN',
      ...(sessionVersion === undefined ? {} : { sessionVersion }),
    },
  });
}

async function decodeToken(token: string) {
  return authOptions.jwt!.decode!({
    secret,
    token,
  });
}

describe('auth session revocation', () => {
  beforeEach(() => {
    (prisma.users.findUnique as jest.Mock).mockReset();
  });

  it('accepts a JWT when its session version matches the user', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ sessionVersion: 2 });

    const token = await encodeToken(2);

    await expect(decodeToken(token)).resolves.toEqual(
      expect.objectContaining({
        id: 'user-123',
        sessionVersion: 2,
      })
    );
  });

  it('rejects a JWT after password reset increments the session version', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ sessionVersion: 3 });

    const token = await encodeToken(2);

    await expect(decodeToken(token)).resolves.toBeNull();
  });

  it('keeps pre-migration JWTs valid for users still on version zero', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ sessionVersion: 0 });

    const token = await encodeToken();

    await expect(decodeToken(token)).resolves.toEqual(
      expect.objectContaining({
        id: 'user-123',
      })
    );
  });
});
