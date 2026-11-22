/**
 * Sign-in rate limit and account lockout, shared by every place that checks a
 * password (the NextAuth credentials provider and POST /api/auth/login).
 *
 * Counts live in Redis so they hold across server instances and restarts. If
 * Redis is not configured or a Redis call fails, the guard falls back to an
 * in-process store: still a limit per instance, never no limit at all.
 *
 * Two limits apply:
 * - Per account: after ACCOUNT_MAX_FAILURES wrong passwords inside the window,
 *   the address is locked for LOCK_SECONDS. Unknown addresses are counted the
 *   same way, so a lockout never reveals whether an account exists.
 * - Per client IP: after IP_MAX_FAILURES failures inside the window, that IP
 *   is refused for the rest of the window, which slows password spraying across
 *   many addresses.
 */
import { createHash } from 'crypto';
import { getRedisClient } from './redis';
import { logger } from './logger';

export const LOGIN_LIMITS = {
  ACCOUNT_MAX_FAILURES: 5,
  ACCOUNT_WINDOW_SECONDS: 15 * 60,
  LOCK_SECONDS: 15 * 60,
  IP_MAX_FAILURES: 20,
  IP_WINDOW_SECONDS: 15 * 60,
} as const;

export type LoginCheck =
  | { allowed: true }
  | { allowed: false; reason: 'account_locked' | 'ip_limited'; retryAfterSeconds: number };

/** Minimal key-value operations the guard needs; Redis or in-memory. */
export interface LoginGuardStore {
  /** Increment a counter, starting its expiry on the first increment. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttlSeconds: number): Promise<void>;
  /** Seconds left before the key expires, or 0 when it is missing. */
  ttl(key: string): Promise<number>;
  del(...keys: string[]): Promise<void>;
}

export class MemoryLoginGuardStore implements LoginGuardStore {
  private entries = new Map<string, { value: number; expiresAt: number }>();

  constructor(private now: () => number = Date.now) {}

  private live(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  async incr(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    if (entry) {
      entry.value += 1;
      return entry.value;
    }
    this.entries.set(key, { value: 1, expiresAt: this.now() + ttlSeconds * 1000 });
    return 1;
  }

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: number, ttlSeconds: number) {
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async ttl(key: string) {
    const entry = this.live(key);
    return entry ? Math.max(1, Math.ceil((entry.expiresAt - this.now()) / 1000)) : 0;
  }

  async del(...keys: string[]) {
    keys.forEach(key => this.entries.delete(key));
  }
}

type RedisLike = NonNullable<ReturnType<typeof getRedisClient>>;

export class RedisLoginGuardStore implements LoginGuardStore {
  constructor(private redis: RedisLike) {}

  async incr(key: string, ttlSeconds: number) {
    const value = await this.redis.incr(key);
    // Only the first increment starts the window, so failures can't keep
    // extending it, and a key never ends up without an expiry.
    if (value === 1 || (await this.redis.ttl(key)) < 0) {
      await this.redis.expire(key, ttlSeconds);
    }
    return value;
  }

  async get(key: string) {
    const value = await this.redis.get(key);
    return value === null ? null : Number(value);
  }

  async set(key: string, value: number, ttlSeconds: number) {
    await this.redis.set(key, String(value), 'EX', ttlSeconds);
  }

  async ttl(key: string) {
    const seconds = await this.redis.ttl(key);
    return seconds > 0 ? seconds : 0;
  }

  async del(...keys: string[]) {
    if (keys.length > 0) await this.redis.del(...keys);
  }
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32);

/** Matches how registration and password reset normalise addresses. */
export const normalizeLoginEmail = (email: string) => email.trim().toLowerCase();

const accountFailuresKey = (email: string) => `login:fail:acct:${hash(normalizeLoginEmail(email))}`;
const accountLockKey = (email: string) => `login:lock:acct:${hash(normalizeLoginEmail(email))}`;
const ipFailuresKey = (ip: string) => `login:fail:ip:${hash(ip)}`;

/**
 * Client IP from proxy headers. The first X-Forwarded-For entry is only as
 * trustworthy as the proxy in front of the app; the account lockout does not
 * depend on it.
 */
export function clientIpFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined> | undefined
): string | null {
  if (!headers) return null;
  const read = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name) ?? undefined;
    }
    const value = (headers as Record<string, string | string[] | undefined>)[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const forwarded = read('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : read('x-real-ip')?.trim();
  return ip || null;
}

export class LoginGuard {
  constructor(private primary: LoginGuardStore | null, private fallback: LoginGuardStore) {}

  /** Run against Redis, dropping to the in-process store if Redis errors. */
  private async run<T>(op: (store: LoginGuardStore) => Promise<T>): Promise<T> {
    if (this.primary) {
      try {
        return await op(this.primary);
      } catch (error) {
        logger.error('Login guard: Redis unavailable, using in-process limits', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return op(this.fallback);
  }

  async check(email: string, ip?: string | null): Promise<LoginCheck> {
    return this.run(async store => {
      const lockSeconds = await store.ttl(accountLockKey(email));
      if (lockSeconds > 0) {
        return { allowed: false, reason: 'account_locked', retryAfterSeconds: lockSeconds };
      }
      if (ip) {
        const ipFailures = (await store.get(ipFailuresKey(ip))) ?? 0;
        if (ipFailures >= LOGIN_LIMITS.IP_MAX_FAILURES) {
          const retryAfterSeconds = (await store.ttl(ipFailuresKey(ip))) || LOGIN_LIMITS.IP_WINDOW_SECONDS;
          return { allowed: false, reason: 'ip_limited', retryAfterSeconds };
        }
      }
      return { allowed: true };
    });
  }

  /** Count a wrong password (or unknown address). Returns true if this locked the account. */
  async recordFailure(email: string, ip?: string | null): Promise<boolean> {
    return this.run(async store => {
      if (ip) await store.incr(ipFailuresKey(ip), LOGIN_LIMITS.IP_WINDOW_SECONDS);
      const failures = await store.incr(accountFailuresKey(email), LOGIN_LIMITS.ACCOUNT_WINDOW_SECONDS);
      if (failures >= LOGIN_LIMITS.ACCOUNT_MAX_FAILURES) {
        await store.set(accountLockKey(email), 1, LOGIN_LIMITS.LOCK_SECONDS);
        await store.del(accountFailuresKey(email));
        logger.securityEvent('Account locked after repeated failed sign-ins', 'medium', {
          account: hash(normalizeLoginEmail(email)),
          lockSeconds: LOGIN_LIMITS.LOCK_SECONDS,
        });
        return true;
      }
      return false;
    });
  }

  /** A correct password clears the account's failure count. */
  async recordSuccess(email: string): Promise<void> {
    await this.run(store => store.del(accountFailuresKey(email)));
  }
}

let sharedGuard: LoginGuard | null = null;

export function getLoginGuard(): LoginGuard {
  if (!sharedGuard) {
    const redis = getRedisClient();
    if (!redis && process.env.NODE_ENV === 'production') {
      logger.warn('Login guard: REDIS_URL is not set, sign-in limits are per server instance only');
    }
    sharedGuard = new LoginGuard(redis ? new RedisLoginGuardStore(redis) : null, new MemoryLoginGuardStore());
  }
  return sharedGuard;
}

/** Test hook: swap in a guard built on a store the test controls. */
export function setLoginGuardForTests(guard: LoginGuard | null) {
  sharedGuard = guard;
}

/** Plain-language message for a refused sign-in; same for known and unknown addresses. */
export function loginBlockedMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export { LOGIN_BLOCKED_ERROR } from './login-blocked';
