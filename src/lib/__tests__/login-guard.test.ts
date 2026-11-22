/**
 * Sign-in rate limit and account lockout (src/lib/login-guard.ts).
 */
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), securityEvent: jest.fn() },
}));

import {
  LOGIN_LIMITS,
  LoginGuard,
  MemoryLoginGuardStore,
  RedisLoginGuardStore,
  clientIpFromHeaders,
  loginBlockedMessage,
} from '@/lib/login-guard';
import { logger } from '@/lib/logger';

/** In-memory stand-in for the ioredis calls the Redis store makes. */
function fakeRedis(now: () => number) {
  const data = new Map<string, { value: string; expiresAt: number | null }>();
  const live = (key: string) => {
    const entry = data.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now()) {
      data.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    data,
    incr: jest.fn(async (key: string) => {
      const entry = live(key);
      const value = entry ? Number(entry.value) + 1 : 1;
      data.set(key, { value: String(value), expiresAt: entry?.expiresAt ?? null });
      return value;
    }),
    expire: jest.fn(async (key: string, seconds: number) => {
      const entry = live(key);
      if (entry) entry.expiresAt = now() + seconds * 1000;
      return entry ? 1 : 0;
    }),
    ttl: jest.fn(async (key: string) => {
      const entry = live(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.ceil((entry.expiresAt - now()) / 1000);
    }),
    get: jest.fn(async (key: string) => live(key)?.value ?? null),
    set: jest.fn(async (key: string, value: string, _ex: 'EX', seconds: number) => {
      data.set(key, { value, expiresAt: now() + seconds * 1000 });
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      keys.forEach(key => data.delete(key));
      return keys.length;
    }),
  };
}

describe('login guard', () => {
  let clock: number;
  const now = () => clock;
  let guard: LoginGuard;

  beforeEach(() => {
    clock = 1_700_000_000_000;
    guard = new LoginGuard(null, new MemoryLoginGuardStore(now));
    jest.clearAllMocks();
  });

  const failTimes = async (n: number, email: string, ip: string | null = '203.0.113.7') => {
    for (let i = 0; i < n; i++) await guard.recordFailure(email, ip);
  };

  it('allows a fresh address', async () => {
    await expect(guard.check('fan@example.com', '203.0.113.7')).resolves.toEqual({ allowed: true });
  });

  it('locks an address after five wrong passwords, for fifteen minutes', async () => {
    await failTimes(LOGIN_LIMITS.ACCOUNT_MAX_FAILURES - 1, 'fan@example.com');
    await expect(guard.check('fan@example.com')).resolves.toEqual({ allowed: true });

    await expect(guard.recordFailure('fan@example.com', '203.0.113.7')).resolves.toBe(true);
    const locked = await guard.check('fan@example.com');
    expect(locked).toEqual({
      allowed: false,
      reason: 'account_locked',
      retryAfterSeconds: LOGIN_LIMITS.LOCK_SECONDS,
    });
    expect(logger.securityEvent).toHaveBeenCalledTimes(1);

    clock += LOGIN_LIMITS.LOCK_SECONDS * 1000;
    await expect(guard.check('fan@example.com')).resolves.toEqual({ allowed: true });
  });

  it('locks from any IP, so rotating IPs does not get around it', async () => {
    for (let i = 0; i < LOGIN_LIMITS.ACCOUNT_MAX_FAILURES; i++) {
      await guard.recordFailure('fan@example.com', `198.51.100.${i}`);
    }
    await expect(guard.check('fan@example.com', '192.0.2.99')).resolves.toMatchObject({
      allowed: false,
      reason: 'account_locked',
    });
  });

  it('treats the address case- and space-insensitively', async () => {
    await failTimes(LOGIN_LIMITS.ACCOUNT_MAX_FAILURES, ' Fan@Example.com ');
    await expect(guard.check('fan@example.com')).resolves.toMatchObject({ allowed: false });
  });

  it('counts unknown addresses the same way, so a lockout reveals nothing', async () => {
    await failTimes(LOGIN_LIMITS.ACCOUNT_MAX_FAILURES, 'nobody@example.com');
    await expect(guard.check('nobody@example.com')).resolves.toMatchObject({
      reason: 'account_locked',
    });
  });

  it('clears the failure count after a correct password', async () => {
    await failTimes(LOGIN_LIMITS.ACCOUNT_MAX_FAILURES - 1, 'fan@example.com');
    await guard.recordSuccess('fan@example.com');
    await failTimes(LOGIN_LIMITS.ACCOUNT_MAX_FAILURES - 1, 'fan@example.com');
    await expect(guard.check('fan@example.com')).resolves.toEqual({ allowed: true });
  });

  it('lets old failures age out of the window', async () => {
    await failTimes(LOGIN_LIMITS.ACCOUNT_MAX_FAILURES - 1, 'fan@example.com');
    clock += LOGIN_LIMITS.ACCOUNT_WINDOW_SECONDS * 1000;
    await failTimes(1, 'fan@example.com');
    await expect(guard.check('fan@example.com')).resolves.toEqual({ allowed: true });
  });

  it('limits one IP spraying many addresses', async () => {
    for (let i = 0; i < LOGIN_LIMITS.IP_MAX_FAILURES; i++) {
      await guard.recordFailure(`user${i}@example.com`, '203.0.113.7');
    }
    await expect(guard.check('someone-new@example.com', '203.0.113.7')).resolves.toMatchObject({
      allowed: false,
      reason: 'ip_limited',
    });
    // Another client is unaffected.
    await expect(guard.check('someone-new@example.com', '192.0.2.1')).resolves.toEqual({
      allowed: true,
    });
  });

  describe('with Redis', () => {
    it('keeps counts in Redis with expiries on every key', async () => {
      const redis = fakeRedis(now);
      const redisGuard = new LoginGuard(
        new RedisLoginGuardStore(redis as any),
        new MemoryLoginGuardStore(now)
      );

      for (let i = 0; i < LOGIN_LIMITS.ACCOUNT_MAX_FAILURES; i++) {
        await redisGuard.recordFailure('fan@example.com', '203.0.113.7');
      }
      await expect(redisGuard.check('fan@example.com')).resolves.toMatchObject({
        allowed: false,
        reason: 'account_locked',
      });

      for (const [key, entry] of redis.data) {
        expect(key).not.toContain('fan@example.com'); // addresses are hashed
        expect(entry.expiresAt).not.toBeNull();
      }
    });

    it('falls back to in-process limits when Redis errors', async () => {
      const broken = {
        incr: jest.fn().mockRejectedValue(new Error('connection refused')),
        get: jest.fn().mockRejectedValue(new Error('connection refused')),
        set: jest.fn().mockRejectedValue(new Error('connection refused')),
        ttl: jest.fn().mockRejectedValue(new Error('connection refused')),
        expire: jest.fn().mockRejectedValue(new Error('connection refused')),
        del: jest.fn().mockRejectedValue(new Error('connection refused')),
      };
      const fallbackGuard = new LoginGuard(
        new RedisLoginGuardStore(broken as any),
        new MemoryLoginGuardStore(now)
      );

      for (let i = 0; i < LOGIN_LIMITS.ACCOUNT_MAX_FAILURES; i++) {
        await fallbackGuard.recordFailure('fan@example.com', '203.0.113.7');
      }
      await expect(fallbackGuard.check('fan@example.com')).resolves.toMatchObject({
        allowed: false,
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

describe('clientIpFromHeaders', () => {
  it('reads the first X-Forwarded-For entry from a plain header object', () => {
    expect(clientIpFromHeaders({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7');
  });

  it('falls back to X-Real-IP, then to nothing', () => {
    expect(clientIpFromHeaders({ 'x-real-ip': '192.0.2.5' })).toBe('192.0.2.5');
    expect(clientIpFromHeaders({})).toBeNull();
    expect(clientIpFromHeaders(undefined)).toBeNull();
  });

  it('reads a Headers-like object', () => {
    const headers = { get: (name: string) => (name === 'x-forwarded-for' ? '198.51.100.2' : null) };
    expect(clientIpFromHeaders(headers as any)).toBe('198.51.100.2');
  });
});

describe('loginBlockedMessage', () => {
  it('rounds up to whole minutes', () => {
    expect(loginBlockedMessage(900)).toBe('Too many sign-in attempts. Try again in 15 minutes.');
    expect(loginBlockedMessage(30)).toBe('Too many sign-in attempts. Try again in 1 minute.');
  });
});
