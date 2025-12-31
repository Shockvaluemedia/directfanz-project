import { getRedisClient } from './redis-production';

interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

export class AuthSecurityManager {
  private redis = getRedisClient();

  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Remove old entries
      await this.redis.zremrangebyscore(key, 0, windowStart);
      
      // Count current attempts
      const currentAttempts = await this.redis.zcard(key);
      
      if (currentAttempts >= config.maxAttempts) {
        // Check if still blocked
        const oldestAttempt = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetTime = oldestAttempt.length > 0 
          ? parseInt(oldestAttempt[1]) + config.windowMs
          : now + config.windowMs;
        
        return {
          allowed: false,
          remaining: 0,
          resetTime,
        };
      }
      
      // Add current attempt
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      await this.redis.expire(key, Math.ceil(config.windowMs / 1000));
      
      return {
        allowed: true,
        remaining: config.maxAttempts - currentAttempts - 1,
        resetTime: now + config.windowMs,
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open for availability
      return { allowed: true, remaining: config.maxAttempts, resetTime: now + config.windowMs };
    }
  }

  async recordFailedLogin(identifier: string): Promise<void> {
    const key = `failed_login:${identifier}`;
    const attempts = await this.redis.incr(key);
    await this.redis.expire(key, 900); // 15 minutes
    
    if (attempts >= 5) {
      // Lock account temporarily
      await this.redis.set(`locked:${identifier}`, '1', 1800); // 30 minutes
    }
  }

  async isAccountLocked(identifier: string): Promise<boolean> {
    const locked = await this.redis.get(`locked:${identifier}`);
    return locked === '1';
  }

  async clearFailedAttempts(identifier: string): Promise<void> {
    await this.redis.del(`failed_login:${identifier}`);
    await this.redis.del(`locked:${identifier}`);
  }

  validatePasswordStrength(password: string): {
    valid: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 0;

    if (password.length < 8) {
      issues.push('Password must be at least 8 characters long');
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      issues.push('Password must contain lowercase letters');
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      issues.push('Password must contain uppercase letters');
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      issues.push('Password must contain numbers');
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      issues.push('Password must contain special characters');
    } else {
      score += 1;
    }

    return {
      valid: issues.length === 0,
      score,
      issues,
    };
  }

  // Rate limiting configurations
  static readonly RATE_LIMITS = {
    LOGIN: { windowMs: 900000, maxAttempts: 5, blockDurationMs: 1800000 }, // 15min window, 5 attempts, 30min block
    SIGNUP: { windowMs: 3600000, maxAttempts: 3, blockDurationMs: 3600000 }, // 1hr window, 3 attempts, 1hr block
    PASSWORD_RESET: { windowMs: 3600000, maxAttempts: 3, blockDurationMs: 3600000 },
    API_GENERAL: { windowMs: 60000, maxAttempts: 100, blockDurationMs: 300000 }, // 1min window, 100 requests, 5min block
  };
}

export const authSecurity = new AuthSecurityManager();