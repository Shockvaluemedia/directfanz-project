import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { logger } from './logger';

// Redis client for rate limiting
let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
}

// In-memory fallback for rate limiting when Redis is unavailable
const inMemoryStore = new Map<string, { count: number; expiresAt: number }>();

function inMemoryIncr(key: string, windowMs: number): number {
  const now = Date.now();
  const entry = inMemoryStore.get(key);

  if (!entry || entry.expiresAt <= now) {
    inMemoryStore.set(key, { count: 1, expiresAt: now + windowMs });
    return 1;
  }

  entry.count++;
  return entry.count;
}

// Periodically clean expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inMemoryStore) {
    if (entry.expiresAt <= now) {
      inMemoryStore.delete(key);
    }
  }
}, 60_000);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Default configurations for different endpoint types
export const RateLimits = {
  // Authentication endpoints (strict)
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },

  // API endpoints (moderate)
  API: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },

  // File upload endpoints (strict)
  UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
  },

  // Payment endpoints (very strict)
  PAYMENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3, // 3 payment attempts per minute
  },

  // Public endpoints (lenient)
  PUBLIC: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 requests per minute
  },
};

// Generate rate limit key
function generateKey(request: NextRequest, prefix: string): string {
  // Try to get user ID from session/token first
  const userId = request.headers.get('x-user-id');
  if (userId) {
    return `rate_limit:${prefix}:user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || '127.0.0.1';

  return `rate_limit:${prefix}:ip:${ip}`;
}

// Rate limiting middleware
export function createRateLimiter(config: RateLimitConfig, prefix: string = 'default') {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      const key = config.keyGenerator ? config.keyGenerator(request) : generateKey(request, prefix);

      let current: number;
      let ttl: number = config.windowMs;

      if (redis) {
        // Use Redis for distributed rate limiting
        current = await redis.incr(key);

        if (current === 1) {
          await redis.pexpire(key, config.windowMs);
        }

        if (current > config.maxRequests) {
          ttl = await redis.pttl(key);
        }
      } else {
        // In-memory fallback
        current = inMemoryIncr(key, config.windowMs);
      }

      // Check if limit exceeded
      if (current > config.maxRequests) {
        const retryAfter = Math.ceil(ttl / 1000);

        logger.warn('Rate limit exceeded', {
          key,
          current,
          limit: config.maxRequests,
          windowMs: config.windowMs,
          userAgent: request.headers.get('user-agent'),
        });

        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'RATE_LIMIT_ERROR',
              message: 'Too many requests',
              retryAfter,
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': Math.max(0, config.maxRequests - current).toString(),
              'X-RateLimit-Reset': new Date(Date.now() + ttl).toISOString(),
            },
          }
        );
      }

      // Add rate limit headers to successful requests
      const remaining = Math.max(0, config.maxRequests - current);
      const resetTime = new Date(Date.now() + config.windowMs);

      // These headers will be added by the middleware wrapper
      (request as any).rateLimitHeaders = {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toISOString(),
      };

      return null; // Continue to next middleware/handler
    } catch (error) {
      logger.error('Rate limiting error', { prefix, error });
      // Don't block requests if rate limiting fails
      return null;
    }
  };
}

// Convenience functions for common rate limits
export const authRateLimiter = createRateLimiter(RateLimits.AUTH, 'auth');
export const apiRateLimiter = createRateLimiter(RateLimits.API, 'api');
export const uploadRateLimiter = createRateLimiter(RateLimits.UPLOAD, 'upload');
export const paymentRateLimiter = createRateLimiter(RateLimits.PAYMENT, 'payment');
export const publicRateLimiter = createRateLimiter(RateLimits.PUBLIC, 'public');

// Middleware wrapper to apply rate limiting
export function withRateLimit(rateLimiter: (req: NextRequest) => Promise<NextResponse | null>) {
  return function <T extends any[]>(handler: (...args: T) => Promise<NextResponse>) {
    return async (...args: T): Promise<NextResponse> => {
      const request = args[0] as NextRequest;

      // Apply rate limiting
      const rateLimitResponse = await rateLimiter(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      // Execute original handler
      const response = await handler(...args);

      // Add rate limit headers if available
      const rateLimitHeaders = (request as any).rateLimitHeaders;
      if (rateLimitHeaders) {
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value as string);
        });
      }

      return response;
    };
  };
}

// Clean up expired keys (call this periodically)
export async function cleanupRateLimitKeys() {
  if (!redis) return;

  try {
    const keys = await redis.keys('rate_limit:*');
    const pipeline = redis.pipeline();

    keys.forEach(key => {
      pipeline.ttl(key);
    });

    const ttls = await pipeline.exec();
    const expiredKeys = keys.filter((_, index) => {
      const ttl = ttls?.[index]?.[1] as number;
      return ttl === -1; // No expiration set
    });

    if (expiredKeys.length > 0) {
      await redis.del(...expiredKeys);
      logger.info('Cleaned up rate limit keys', { count: expiredKeys.length });
    }
  } catch (error) {
    logger.error('Rate limit cleanup error', { error });
  }
}

// Advanced rate limiting for burst traffic
export function createSlidingWindowRateLimiter(
  config: RateLimitConfig,
  prefix: string = 'sliding'
) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      const key = generateKey(request, prefix);

      if (!redis) {
        // Fall back to simple in-memory rate limiting
        const current = inMemoryIncr(key, config.windowMs);
        if (current > config.maxRequests) {
          return NextResponse.json(
            { success: false, error: { type: 'RATE_LIMIT_ERROR', message: 'Too many requests', retryAfter: Math.ceil(config.windowMs / 1000) } },
            { status: 429, headers: { 'Retry-After': Math.ceil(config.windowMs / 1000).toString() } }
          );
        }
        return null;
      }
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Use sorted set to track requests with timestamps
      const pipeline = redis.pipeline();

      // Remove old entries
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Add current request with cryptographically secure random component
      const randomComponent = require('crypto').randomBytes(4).toString('hex');
      pipeline.zadd(key, now, `${now}-${randomComponent}`);

      // Count current requests
      pipeline.zcard(key);

      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await pipeline.exec();
      const currentCount = results?.[2]?.[1] as number;

      if (currentCount > config.maxRequests) {
        const retryAfter = Math.ceil(config.windowMs / 1000);

        logger.warn('Sliding window rate limit exceeded', {
          key,
          currentCount,
          limit: config.maxRequests,
        });

        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'RATE_LIMIT_ERROR',
              message: 'Too many requests',
              retryAfter,
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': Math.max(0, config.maxRequests - currentCount).toString(),
            },
          }
        );
      }

      return null;
    } catch (error) {
      logger.error('Sliding window rate limiting error', { prefix, error });
      return null;
    }
  };
}
