import { NextRequest } from 'next/server';
import { logger } from './logger';
import { createRateLimitResponse } from './error-handler';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  violations: number;
  lastViolation: number;
  firstRequest: number;
}

interface BlockedIP {
  until: number;
  reason: string;
  violations: number;
}

interface SuspiciousActivity {
  score: number;
  lastUpdate: number;
  reasons: string[];
}

interface AdaptiveRateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  adaptiveRateLimiting?: boolean;
  burstProtection?: boolean;
  skipIpRanges?: string[];
  blockDuration?: number;
  maxViolations?: number;
  decayRate?: number; // Points per minute to decay suspicion score
}

export class AdaptiveRateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private blockedIps = new Map<string, BlockedIP>();
  private suspiciousActivity = new Map<string, SuspiciousActivity>();
  private options: Required<AdaptiveRateLimiterOptions>;

  constructor(options: AdaptiveRateLimiterOptions) {
    this.options = {
      adaptiveRateLimiting: true,
      burstProtection: true,
      skipIpRanges: [],
      blockDuration: 300000, // 5 minutes default
      maxViolations: 3,
      decayRate: 1, // 1 point per minute
      ...options
    };

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  checkRequest(request: NextRequest): { limited: boolean; response?: any; suspicionScore?: number; remaining?: number } {
    const ip = this.getClientIP(request);
    const now = Date.now();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const path = request.nextUrl.pathname;

    // Check if IP should be skipped (CDNs, trusted proxies)
    if (this.shouldSkipIP(ip)) {
      return { limited: false, suspicionScore: 0, remaining: this.options.maxRequests };
    }

    // Check if IP is currently blocked
    const blockStatus = this.checkBlocked(ip);
    if (blockStatus.blocked) {
      return {
        limited: true,
        response: this.createBlockedResponse(blockStatus.until!, blockStatus.reason!),
        suspicionScore: this.getSuspicionScore(ip),
        remaining: 0
      };
    }

    // Get or create request entry
    const entry = this.getOrCreateEntry(ip, now);
    
    // Calculate effective rate limit based on suspicious activity
    const effectiveMaxRequests = this.calculateEffectiveLimit(ip);
    
    // Increment request count
    entry.count++;
    this.requests.set(ip, entry);

    // Check for burst patterns
    if (this.options.burstProtection) {
      this.detectBurstPattern(ip, entry, now);
    }

    // Check if rate limit is exceeded
    if (entry.count > effectiveMaxRequests) {
      return this.handleRateLimitExceeded(ip, entry, now, userAgent, path, effectiveMaxRequests);
    }

    // Log suspicious patterns even if not rate limited
    this.detectSuspiciousPatterns(request, ip);

    const suspicionScore = this.getSuspicionScore(ip);
    const remaining = Math.max(0, effectiveMaxRequests - entry.count);
    
    return { 
      limited: false, 
      suspicionScore, 
      remaining 
    };
  }

  private getClientIP(request: NextRequest): string {
    return request.ip || 
           request.headers.get('cf-connecting-ip') ||
           request.headers.get('x-forwarded-for')?.split(',')[0] ||
           request.headers.get('x-real-ip') ||
           'unknown';
  }

  private shouldSkipIP(ip: string): boolean {
    return this.options.skipIpRanges.some(range => ip.includes(range));
  }

  private checkBlocked(ip: string): { blocked: boolean; until?: number; reason?: string } {
    const blocked = this.blockedIps.get(ip);
    if (!blocked) {
      return { blocked: false };
    }

    const now = Date.now();
    if (now >= blocked.until) {
      this.blockedIps.delete(ip);
      logger.info('IP unblocked after timeout', { ip, reason: blocked.reason });
      return { blocked: false };
    }

    return { 
      blocked: true, 
      until: blocked.until, 
      reason: blocked.reason 
    };
  }

  private getOrCreateEntry(ip: string, now: number): RateLimitEntry {
    const existing = this.requests.get(ip);
    
    if (!existing || now > existing.resetTime) {
      return {
        count: 0,
        resetTime: now + this.options.windowMs,
        violations: existing?.violations || 0,
        lastViolation: existing?.lastViolation || 0,
        firstRequest: now
      };
    }

    return existing;
  }

  private calculateEffectiveLimit(ip: string): number {
    if (!this.options.adaptiveRateLimiting) {
      return this.options.maxRequests;
    }

    const suspicion = this.getSuspicionScore(ip);
    
    if (suspicion > 75) {
      return Math.max(1, Math.floor(this.options.maxRequests * 0.25));
    } else if (suspicion > 50) {
      return Math.max(2, Math.floor(this.options.maxRequests * 0.5));
    } else if (suspicion > 25) {
      return Math.floor(this.options.maxRequests * 0.75);
    }

    return this.options.maxRequests;
  }

  private detectBurstPattern(ip: string, entry: RateLimitEntry, now: number): void {
    const timeSinceFirst = now - entry.firstRequest;
    const requestRate = entry.count / (timeSinceFirst / 1000); // requests per second

    // If making more than 10 requests per second, consider it a burst
    if (requestRate > 10) {
      this.increaseSuspicionScore(ip, 15, 'burst_pattern_detected');
      
      logger.warn('Burst pattern detected', {
        ip,
        requestRate: requestRate.toFixed(2),
        requests: entry.count,
        timeSpan: timeSinceFirst
      });
    }

    // Detect rapid successive requests
    const avgTimeBetweenRequests = timeSinceFirst / entry.count;
    if (avgTimeBetweenRequests < 50) { // Less than 50ms between requests on average
      this.increaseSuspicionScore(ip, 10, 'rapid_successive_requests');
    }
  }

  private handleRateLimitExceeded(
    ip: string, 
    entry: RateLimitEntry, 
    now: number, 
    userAgent: string, 
    path: string,
    effectiveLimit: number
  ): { limited: boolean; response: any } {
    // Increment violations
    entry.violations++;
    entry.lastViolation = now;
    
    // Increase suspicion score
    this.increaseSuspicionScore(ip, 10, 'rate_limit_exceeded');
    
    // Check if IP should be temporarily blocked
    if (entry.violations >= this.options.maxViolations) {
      this.blockIP(ip, entry.violations, 'repeated_rate_limit_violations');
    }

    logger.warn('Rate limit exceeded', {
      ip,
      userAgent,
      path,
      violations: entry.violations,
      effectiveLimit,
      actualRequests: entry.count,
      suspicionScore: this.getSuspicionScore(ip)
    });

    return {
      limited: true,
      response: this.createRateLimitResponse(entry.resetTime - now, effectiveLimit, entry)
    };
  }

  private detectSuspiciousPatterns(request: NextRequest, ip: string): void {
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const path = request.nextUrl.pathname;

    // Check for bot-like user agents
    const botPatterns = [/bot/i, /crawl/i, /spider/i, /scrape/i];
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      this.increaseSuspicionScore(ip, 5, 'bot_user_agent');
    }

    // Check for missing or very short user agent
    if (!userAgent || userAgent.length < 10) {
      this.increaseSuspicionScore(ip, 8, 'suspicious_user_agent');
    }

    // Check for unusual request patterns
    if (path.includes('admin') || path.includes('wp-') || path.includes('.php')) {
      this.increaseSuspicionScore(ip, 20, 'scanning_attempt');
    }

    // Check for requests without typical browser headers
    const hasAcceptLanguage = request.headers.has('accept-language');
    const hasAccept = request.headers.has('accept');
    
    if (!hasAcceptLanguage && !hasAccept) {
      this.increaseSuspicionScore(ip, 10, 'missing_browser_headers');
    }
  }

  private blockIP(ip: string, violations: number, reason: string): void {
    const blockDuration = Math.min(
      this.options.blockDuration * Math.pow(2, violations - this.options.maxViolations),
      24 * 60 * 60 * 1000 // Max 24 hours
    );

    const until = Date.now() + blockDuration;
    
    this.blockedIps.set(ip, {
      until,
      reason,
      violations
    });

    logger.securityEvent('IP temporarily blocked', 'high', {
      ip,
      reason,
      violations,
      blockDurationMinutes: blockDuration / 60000,
      unblockTime: new Date(until).toISOString()
    });
  }

  private getSuspicionScore(ip: string): number {
    const activity = this.suspiciousActivity.get(ip);
    if (!activity) return 0;

    // Decay score over time
    const now = Date.now();
    const minutesElapsed = (now - activity.lastUpdate) / 60000;
    const decayedScore = Math.max(0, activity.score - (minutesElapsed * this.options.decayRate));
    
    if (decayedScore !== activity.score) {
      activity.score = decayedScore;
      activity.lastUpdate = now;
      this.suspiciousActivity.set(ip, activity);
    }

    return decayedScore;
  }

  private increaseSuspicionScore(ip: string, points: number, reason: string): void {
    const now = Date.now();
    const current = this.suspiciousActivity.get(ip) || { 
      score: 0, 
      lastUpdate: now, 
      reasons: [] 
    };

    // Decay existing score
    const minutesElapsed = (now - current.lastUpdate) / 60000;
    current.score = Math.max(0, current.score - (minutesElapsed * this.options.decayRate));

    // Add new points
    current.score += points;
    current.lastUpdate = now;
    
    // Track reasons (keep only last 10)
    current.reasons = [reason, ...current.reasons.slice(0, 9)];
    
    this.suspiciousActivity.set(ip, current);

    if (current.score > 50) {
      logger.securityEvent('High suspicion score detected', 'medium', {
        ip,
        suspicionScore: current.score,
        latestReason: reason,
        recentReasons: current.reasons.slice(0, 5)
      });
    }
  }

  private createRateLimitResponse(timeUntilReset: number, limit: number, entry: RateLimitEntry): any {
    const retryAfter = Math.ceil(timeUntilReset / 1000);
    const requestId = 'rate-limit-' + Date.now(); // Generate a request ID for rate limiting
    
    const response = createRateLimitResponse(requestId, retryAfter);
    
    // Add additional headers to the response
    const headers = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': Math.ceil((Date.now() + timeUntilReset) / 1000).toString(),
      'X-RateLimit-Violations': entry.violations.toString(),
      'X-Adaptive-Limit': this.options.adaptiveRateLimiting.toString()
    };
    
    // Add the additional headers to the response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }

  private createBlockedResponse(until: number, reason: string): any {
    const secondsRemaining = Math.ceil((until - Date.now()) / 1000);
    const requestId = 'blocked-' + Date.now(); // Generate a request ID for blocking
    
    const response = createRateLimitResponse(requestId, secondsRemaining);
    
    // Add additional headers to the response
    const headers = {
      'X-Blocked-Until': new Date(until).toISOString(),
      'X-Block-Reason': reason
    };
    
    // Add the additional headers to the response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Clean up expired request entries
    const expiredRequestIps: string[] = [];
    this.requests.forEach((entry, ip) => {
      if (now > entry.resetTime) {
        expiredRequestIps.push(ip);
      }
    });
    expiredRequestIps.forEach(ip => this.requests.delete(ip));

    // Clean up expired blocks
    const expiredBlockedIps: string[] = [];
    this.blockedIps.forEach((block, ip) => {
      if (now >= block.until) {
        expiredBlockedIps.push(ip);
      }
    });
    expiredBlockedIps.forEach(ip => this.blockedIps.delete(ip));

    // Clean up old suspicious activity (older than 24 hours with low scores)
    const expiredSuspiciousIps: string[] = [];
    this.suspiciousActivity.forEach((activity, ip) => {
      const hoursOld = (now - activity.lastUpdate) / (60 * 60 * 1000);
      if (hoursOld > 24 && activity.score < 10) {
        expiredSuspiciousIps.push(ip);
      }
    });
    expiredSuspiciousIps.forEach(ip => this.suspiciousActivity.delete(ip));

    logger.debug('Rate limiter cleanup completed', {
      activeRequests: this.requests.size,
      blockedIps: this.blockedIps.size,
      suspiciousActivities: this.suspiciousActivity.size
    });
  }

  // Public methods for monitoring
  getStats(): {
    activeRequests: number;
    blockedIps: number;
    suspiciousActivities: number;
    highRiskIps: number;
  } {
    const highRiskIps = Array.from(this.suspiciousActivity.values())
      .filter(activity => this.getSuspicionScore('') > 50).length;

    return {
      activeRequests: this.requests.size,
      blockedIps: this.blockedIps.size,
      suspiciousActivities: this.suspiciousActivity.size,
      highRiskIps
    };
  }

  getIPStatus(ip: string): {
    currentRequests: number;
    violations: number;
    suspicionScore: number;
    isBlocked: boolean;
    blockReason?: string;
    effectiveLimit: number;
  } {
    const entry = this.requests.get(ip);
    const blocked = this.checkBlocked(ip);
    
    return {
      currentRequests: entry?.count || 0,
      violations: entry?.violations || 0,
      suspicionScore: this.getSuspicionScore(ip),
      isBlocked: blocked.blocked,
      blockReason: blocked.reason,
      effectiveLimit: this.calculateEffectiveLimit(ip)
    };
  }
}