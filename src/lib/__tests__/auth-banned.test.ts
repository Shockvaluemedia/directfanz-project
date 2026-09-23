/**
 * A ban has to mean something at sign-in. The credentials provider's
 * `authorize` must refuse BANNED accounts, and only after the password check so
 * an unauthenticated caller can't tell a banned account from a wrong password.
 * `@/lib/auth` is mocked globally, so the real module is loaded here.
 */
import { prisma } from '@/lib/prisma';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const { authOptions } = jest.requireActual('@/lib/auth');

// NextAuth's CredentialsProvider keeps the user-supplied callbacks on `options`.
const authorize = (authOptions.providers[0] as any).options.authorize as (
  credentials: { email: string; password: string }
) => Promise<unknown>;

const account = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'user@example.com',
  password: 'hashed',
  displayName: 'User One',
  avatar: null,
  role: 'FAN',
  status: 'ACTIVE',
  ...overrides,
});

describe('credentials authorize() and banned accounts', () => {
  beforeEach(() => {
    (prisma.users.findUnique as jest.Mock).mockReset();
    (bcrypt.compare as jest.Mock).mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  it('signs an active account in', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(account());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(authorize({ email: 'user@example.com', password: 'pw' })).resolves.toEqual({
      id: 'u1',
      email: 'user@example.com',
      name: 'User One',
      image: null,
      role: 'FAN',
    });
  });

  it('refuses a banned account even with the correct password', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(account({ status: 'BANNED' }));
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(authorize({ email: 'user@example.com', password: 'pw' })).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Sign-in refused for banned account',
      expect.objectContaining({ userId: 'u1' })
    );
  });

  it('checks the password before the ban status', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(account({ status: 'BANNED' }));
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(authorize({ email: 'user@example.com', password: 'wrong' })).resolves.toBeNull();
    // Same outcome as any wrong password: the ban is never mentioned.
    expect(console.warn).not.toHaveBeenCalled();
  });
});
