/**
 * The NextAuth credentials provider must enforce the sign-in guard: after five
 * wrong passwords the address is refused, even with the right password, and
 * the refusal happens before the database or bcrypt are touched.
 * `@/lib/auth` is mocked globally, so the real module is loaded here.
 */
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), securityEvent: jest.fn() },
}));

import { prisma } from '@/lib/prisma';
import {
  LOGIN_BLOCKED_ERROR,
  LOGIN_LIMITS,
  LoginGuard,
  MemoryLoginGuardStore,
  setLoginGuardForTests,
} from '@/lib/login-guard';

const bcrypt = require('bcryptjs');
const { authOptions } = jest.requireActual('@/lib/auth');

const authorize = (authOptions.providers[0] as any).options.authorize as (
  credentials: { email: string; password: string },
  req?: { headers?: Record<string, string> }
) => Promise<unknown>;

const req = { headers: { 'x-forwarded-for': '203.0.113.7' } };
const user = {
  id: 'u1',
  email: 'fan@example.com',
  password: 'hashed',
  displayName: 'Fan',
  avatar: null,
  role: 'FAN',
  status: 'ACTIVE',
};

describe('credentials authorize() lockout', () => {
  beforeEach(() => {
    setLoginGuardForTests(new LoginGuard(null, new MemoryLoginGuardStore()));
    (prisma.users.findUnique as jest.Mock).mockReset().mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockReset();
  });

  afterAll(() => setLoginGuardForTests(null));

  it('refuses the right password once the address is locked, without checking it', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    for (let i = 0; i < LOGIN_LIMITS.ACCOUNT_MAX_FAILURES; i++) {
      await expect(authorize({ email: user.email, password: 'wrong' }, req)).resolves.toBeNull();
    }

    (bcrypt.compare as jest.Mock).mockReset().mockResolvedValue(true);
    (prisma.users.findUnique as jest.Mock).mockClear();
    await expect(authorize({ email: user.email, password: 'right' }, req)).rejects.toThrow(
      LOGIN_BLOCKED_ERROR
    );
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('counts unknown addresses toward a lockout too', async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);
    for (let i = 0; i < LOGIN_LIMITS.ACCOUNT_MAX_FAILURES; i++) {
      await authorize({ email: 'nobody@example.com', password: 'x' }, req);
    }
    await expect(authorize({ email: 'nobody@example.com', password: 'x' }, req)).rejects.toThrow(
      LOGIN_BLOCKED_ERROR
    );
  });

  it('resets the count after a successful sign-in', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    for (let i = 0; i < LOGIN_LIMITS.ACCOUNT_MAX_FAILURES - 1; i++) {
      await authorize({ email: user.email, password: 'wrong' }, req);
    }
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await expect(authorize({ email: user.email, password: 'right' }, req)).resolves.toMatchObject({
      id: 'u1',
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    for (let i = 0; i < LOGIN_LIMITS.ACCOUNT_MAX_FAILURES - 1; i++) {
      await authorize({ email: user.email, password: 'wrong' }, req);
    }
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await expect(authorize({ email: user.email, password: 'right' }, req)).resolves.toMatchObject({
      id: 'u1',
    });
  });
});
