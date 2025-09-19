import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { cacheService } from '@/lib/performance';

// Rate limiting strategies
export type RateLimitStrategy = 'fixed-window' | 'sliding-window' | 'token-bucket';

export interface RateLimitConfig {
  strategy: RateLimitStrategy;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextRequest) => string;
  skip?: (req: NextRequest) => boolean;
  onLimitReached?: (req: NextRequest, key: string) => void;
  message?: string;
  headers?: boolean;
}

export interface RateLimitResult {
  limited: boolean;
  response?: NextResponse;
  remainingRequests?: number;
  resetTime?: number;
}

// Default configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  // General API endpoints
  general: {
    strategy: 'sliding-window' as RateLimitStrategy,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    headers: true,
  },

  // Authentication endpoints
  auth: {
    strategy: 'fixed-window' as RateLimitStrategy,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    headers: true,
    skipSuccessfulRequests: true,
  },

  // Payment endpoints
  payment: {
    strategy: 'token-bucket' as RateLimitStrategy,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    headers: true,
  },

  // Content upload endpoints
  upload: {
    strategy: 'sliding-window' as RateLimitStrategy,
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    headers: true,
  },

  // Admin endpoints
  admin: {
    strategy: 'fixed-window' as RateLimitStrategy,
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50,
    headers: true,
  },

  // Webhook endpoints
  webhook: {
    strategy: 'sliding-window' as RateLimitStrategy,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    headers: false,
    skipFailedRequests: true,
  },
} as const;

export class AdvancedRateLimiter {
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      strategy: 'sliding-window',
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      headers: true,
      keyGenerator: this.defaultKeyGenerator,
      ...config,
    };
  }

  async checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
    // Skip if configured to skip
    if (this.config.skip && this.config.skip(request)) {
      return { limited: false };
    }

    const key = this.config.keyGenerator!(request);

    switch (this.config.strategy) {
      case 'fixed-window':
        return await this.fixedWindowCheck(request, key);
      case 'sliding-window':
        return await this.slidingWindowCheck(request, key);
      case 'token-bucket':
        return await this.tokenBucketCheck(request, key);
      default:
        return await this.fixedWindowCheck(request, key);
    }
  }

  private defaultKeyGenerator(request: NextRequest): string {
    const ip = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const endpoint = request.nextUrl.pathname;

    // Create a hash to avoid storing full user agents
    const hash = require('crypto')
      .createHash('md5')
      .update(`${ip}:${userAgent}`)
      .digest('hex')
      .substring(0, 8);

    return `rate_limit:${endpoint}:${hash}`;
  }

  private getClientIP(request: NextRequest): string {
    return (
      request.ip ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-client-ip') ||
      'unknown'
    );
  }

  // Fixed window rate limiting
  private async fixedWindowCheck(request: NextRequest, key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const windowKey = `${key}:${windowStart}`;

    try {
      const current = (await cacheService.get<number>(windowKey)) || 0;
      const newCount = current + 1;

      if (newCount > this.config.maxRequests) {
        await this.onLimitReached(request, key);

        const resetTime = windowStart + this.config.windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        return {
          limited: true,
          response: this.createRateLimitResponse(request, 0, resetTime, retryAfter),
        };
      }

      // Store the new count with TTL
      const ttl = Math.ceil((windowStart + this.config.windowMs - now) / 1000);
      await cacheService.set(windowKey, newCount, ttl);

      const remainingRequests = Math.max(0, this.config.maxRequests - newCount);
      const resetTime = windowStart + this.config.windowMs;

      return {
        limited: false,
        remainingRequests,
        resetTime,
      };
    } catch (error) {
      logger.error('Fixed window rate limit check failed', { key }, error as Error);
      return { limited: false }; // Fail open
    }
  }

  // Sliding window rate limiting
  private async slidingWindowCheck(request: NextRequest, key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Get existing requests in the sliding window
      const requests = (await cacheService.get<number[]>(`${key}:requests`)) || [];

      // Filter requests within the current window
      const validRequests = requests.filter(timestamp => timestamp > windowStart);

      if (validRequests.length >= this.config.maxRequests) {
        await this.onLimitReached(request, key);

        const oldestRequest = Math.min(...validRequests);
        const resetTime = oldestRequest + this.config.windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        return {
          limited: true,
          response: this.createRateLimitResponse(request, 0, resetTime, retryAfter),
        };
      }

      // Add current request timestamp
      validRequests.push(now);

      // Store updated requests with TTL
      const ttl = Math.ceil(this.config.windowMs / 1000);
      await cacheService.set(`${key}:requests`, validRequests, ttl);

      const remainingRequests = Math.max(0, this.config.maxRequests - validRequests.length);
      const resetTime = now + this.config.windowMs;

      return {
        limited: false,
        remainingRequests,
        resetTime,
      };
    } catch (error) {
      logger.error('Sliding window rate limit check failed', { key }, error as Error);
      return { limited: false }; // Fail open
    }
  }

  // Token bucket rate limiting
  private async tokenBucketCheck(request: NextRequest, key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucketKey = `${key}:bucket`;

    try {
      const bucket = (await cacheService.get<{ tokens: number; lastRefill: number }>(
        bucketKey
      )) || {
        tokens: this.config.maxRequests,
        lastRefill: now,
      };

      // Calculate tokens to add based on time elapsed
      const timePassed = now - bucket.lastRefill;
      const tokensToAdd = Math.floor((timePassed / this.config.windowMs) * this.config.maxRequests);

      bucket.tokens = Math.min(this.config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;

      if (bucket.tokens < 1) {
        await this.onLimitReached(request, key);

        const resetTime = now + this.config.windowMs;
        const retryAfter = Math.ceil(this.config.windowMs / 1000);

        return {
          limited: true,
          response: this.createRateLimitResponse(request, 0, resetTime, retryAfter),
        };
      }

      // Consume a token
      bucket.tokens -= 1;

      // Store updated bucket
      const ttl = Math.ceil((this.config.windowMs * 2) / 1000); // Keep bucket longer
      await cacheService.set(bucketKey, bucket, ttl);

      const resetTime = now + this.config.windowMs;

      return {
        limited: false,
        remainingRequests: bucket.tokens,
        resetTime,
      };
    } catch (error) {
      logger.error('Token bucket rate limit check failed', { key }, error as Error);
      return { limited: false }; // Fail open
    }
  }

  private async onLimitReached(request: NextRequest, key: string): Promise<void> {
    const ip = this.getClientIP(request);

    logger.warn('Rate limit exceeded', {
      key,
      ip,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      strategy: this.config.strategy,
      limit: this.config.maxRequests,
      windowMs: this.config.windowMs,
    });

    // Call custom handler if provided
    if (this.config.onLimitReached) {
      try {
        this.config.onLimitReached(request, key);
      } catch (error) {
        logger.error('Rate limit handler failed', { key }, error as Error);
      }
    }

    // Track suspicious activity
    await this.trackSuspiciousActivity(request, key);
  }

  private async trackSuspiciousActivity(request: NextRequest, key: string): Promise<void> {
    const suspiciousKey = `suspicious:${key}`;
    const current = (await cacheService.get<number>(suspiciousKey)) || 0;
    const newCount = current + 1;

    // Store for 24 hours
    await cacheService.set(suspiciousKey, newCount, 24 * 60 * 60);

    // If too many rate limit violations, flag as potential attack
    if (newCount > 10) {
      const ip = this.getClientIP(request);
      logger.error('Potential attack detected', {
        ip,
        violations: newCount,
        endpoint: request.nextUrl.pathname,
        userAgent: request.headers.get('user-agent'),
      });
    }
  }

  private createRateLimitResponse(
    request: NextRequest,
    remaining: number,
    resetTime: number,
    retryAfter: number
  ): NextResponse {
    const response = new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: this.config.message || 'Rate limit exceeded. Please try again later.',
        retryAfter,
        resetTime,
      }),
      { status: 429 }
    );

    response.headers.set('Content-Type', 'application/json');

    if (this.config.headers) {
      response.headers.set('X-RateLimit-Limit', this.config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
      response.headers.set('Retry-After', retryAfter.toString());
    }

    return response;
  }
}

// Convenience functions for common rate limiting scenarios
export const createAuthRateLimiter = () => new AdvancedRateLimiter(RATE_LIMIT_CONFIGS.auth);

export const createPaymentRateLimiter = () => new AdvancedRateLimiter(RATE_LIMIT_CONFIGS.payment);

export const createUploadRateLimiter = () => new AdvancedRateLimiter(RATE_LIMIT_CONFIGS.upload);

export const createAdminRateLimiter = () => new AdvancedRateLimiter(RATE_LIMIT_CONFIGS.admin);

export const createWebhookRateLimiter = () => new AdvancedRateLimiter(RATE_LIMIT_CONFIGS.webhook);

export const createGeneralRateLimiter = () => new AdvancedRateLimiter(RATE_LIMIT_CONFIGS.general);

// Export default general rate limiter
export const rateLimiter = createGeneralRateLimiter();
