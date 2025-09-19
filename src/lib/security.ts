/**
 * Server-side security utilities and middleware for implementing OWASP best practices
 *
 * WARNING: This module uses Node.js crypto and should only be imported in server-side code.
 * For client-safe security utilities, use './security-client.ts' instead.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { createRateLimitResponse } from './error-handler';
import { AppError, ErrorCode } from './errors';
import {
  SECURITY_CONSTANTS,
  generateCSP,
  sanitizeInput,
  generateSecureDownloadHeaders,
} from './security-client';

// Re-export client-safe utilities for convenience
export {
  SECURITY_CONSTANTS,
  generateCSP,
  sanitizeInput,
  generateSecureDownloadHeaders,
} from './security-client';

// === SERVER-SIDE ONLY FUNCTIONS (require Node.js crypto) ===

// Generate a secure random token
export const generateSecureToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

// Hash sensitive data
export const hashData = (data: string, salt?: string): { hash: string; salt: string } => {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', useSalt).update(data).digest('hex');

  return { hash, salt: useSalt };
};

// Encrypt sensitive data
export const encryptData = (data: string, key = process.env.ENCRYPTION_KEY): string => {
  if (!key) {
    throw new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Encryption key not configured',
      500,
      undefined,
      undefined,
      undefined,
      false
    );
  }

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption failed', {}, error as Error);
    throw new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to encrypt data',
      500,
      undefined,
      undefined,
      undefined,
      false
    );
  }
};

// Decrypt sensitive data
export const decryptData = (encryptedData: string, key = process.env.ENCRYPTION_KEY): string => {
  if (!key) {
    throw new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Encryption key not configured',
      500,
      undefined,
      undefined,
      undefined,
      false
    );
  }

  try {
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', {}, error as Error);
    throw new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to decrypt data',
      500,
      undefined,
      undefined,
      undefined,
      false
    );
  }
};

// CSRF token generation and validation (server-side only)
export const generateCsrfToken = (sessionId: string): { token: string; expires: Date } => {
  const expires = new Date(Date.now() + SECURITY_CONSTANTS.CSRF_TOKEN_EXPIRY * 1000);
  const data = `${sessionId}:${expires.getTime()}`;
  const { hash } = hashData(data);

  return {
    token: `${hash}:${expires.getTime()}`,
    expires,
  };
};

export const validateCsrfToken = (token: string, sessionId: string): boolean => {
  try {
    const [hash, expiresTimestamp] = token.split(':');
    const expires = parseInt(expiresTimestamp, 10);

    // Check if token has expired
    if (Date.now() > expires) {
      return false;
    }

    // Recreate the data that was used to generate the hash
    const data = `${sessionId}:${expires}`;
    const { hash: expectedHash } = hashData(data);

    // Compare the hashes using a timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch (error) {
    logger.error('CSRF token validation failed', {}, error as Error);
    return false;
  }
};

// === SERVER-SIDE MIDDLEWARE AND UTILITIES ===

// GDPR data export (server-side only)
export const generateUserDataExport = async (userId: string): Promise<Record<string, any>> => {
  // This would be implemented to fetch all user data from various tables
  // For now, we'll return a placeholder
  return {
    userId,
    exportDate: new Date().toISOString(),
    personalData: {
      // Would contain user personal data
    },
    subscriptions: [
      // Would contain subscription data
    ],
    comments: [
      // Would contain comment data
    ],
    // Other user data categories
  };
};

// GDPR data deletion (server-side only)
export const initiateUserDataDeletion = async (userId: string): Promise<void> => {
  // This would implement the actual data deletion process
  // For now, we'll just log the request
  logger.info(`GDPR data deletion initiated for user ${userId}`, { userId });

  // In a real implementation, this would:
  // 1. Anonymize user data that must be retained (e.g., for financial records)
  // 2. Delete personal data that can be removed
  // 3. Mark the account as deleted
  // 4. Send confirmation email
};

// Security headers middleware (server-side only)
export const addSecurityHeaders = (response: NextResponse): NextResponse => {
  // Content Security Policy
  response.headers.set('Content-Security-Policy', generateCSP());

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Enable XSS protection in browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Control browser features
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS (HTTP Strict Transport Security)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
};

// IP-based rate limiting (more sophisticated than the middleware implementation)
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  statusCode?: number;
}

const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  statusCode: 429,
  message: 'Too many requests, please try again later.',
};

// Store for rate limiting data
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up rate limit store periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    Array.from(rateLimitStore.entries()).forEach(([key, data]) => {
      if (data.resetTime <= now) {
        rateLimitStore.delete(key);
      }
    });
  }, 60 * 1000); // Clean up every minute
}

// Rate limiting middleware factory
export const createRateLimiter = (config: Partial<RateLimitConfig> = {}) => {
  const options: RateLimitConfig = { ...defaultRateLimitConfig, ...config };

  return (request: NextRequest, key?: string): { limited: boolean; response?: NextResponse } => {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const limitKey = key || `${ip}:${request.nextUrl.pathname}`;
    const now = Date.now();

    const currentData = rateLimitStore.get(limitKey) || {
      count: 0,
      resetTime: now + options.windowMs,
    };

    // Reset if window has passed
    if (currentData.resetTime <= now) {
      currentData.count = 0;
      currentData.resetTime = now + options.windowMs;
    }

    currentData.count += 1;
    rateLimitStore.set(limitKey, currentData);

    if (currentData.count > options.maxRequests) {
      const retryAfter = Math.ceil((currentData.resetTime - now) / 1000);

      logger.warn('Rate limit exceeded', {
        ip,
        path: request.nextUrl.pathname,
        method: request.method,
        count: currentData.count,
        limit: options.maxRequests,
      });

      return {
        limited: true,
        response: createRateLimitResponse(
          request.headers.get('x-request-id') || 'unknown',
          retryAfter
        ),
      };
    }

    return { limited: false };
  };
};

// Detect suspicious activities
export const detectSuspiciousActivity = (request: NextRequest, userId?: string): boolean => {
  // In development mode, be less restrictive to allow testing with curl/postman
  if (process.env.NODE_ENV === 'development') {
    return false;
  }

  // This would implement more sophisticated detection logic
  // For now, we'll use a simple check for unusual headers or patterns

  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const referer = request.headers.get('referer') || '';

  // Check for missing or suspicious user agent
  if (
    !userAgent ||
    userAgent.length < 10 ||
    userAgent.includes('bot') ||
    userAgent.includes('crawl')
  ) {
    logger.warn('Suspicious user agent detected', {
      userId,
      userAgent,
      ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      path: request.nextUrl.pathname,
    });
    return true;
  }

  // Add more sophisticated checks here

  return false;
};
