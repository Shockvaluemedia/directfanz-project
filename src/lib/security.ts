/**
 * Security utilities and middleware for implementing OWASP best practices
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { createRateLimitResponse } from './error-handler';
import { AppError, ErrorCode } from './errors';

// Constants for security settings
export const SECURITY_CONSTANTS = {
  PASSWORD_MIN_LENGTH: 10,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SYMBOL: true,
  CSRF_TOKEN_EXPIRY: 3600, // 1 hour in seconds
  SESSION_IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
  BCRYPT_ROUNDS: 12,
  COOKIE_SECURE: process.env.NODE_ENV === 'production',
  COOKIE_SAME_SITE: 'lax' as 'lax' | 'strict' | 'none',
  COOKIE_HTTP_ONLY: true,
  CONTENT_SECURITY_POLICY: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", 'js.stripe.com', 'cdn.vercel-insights.com'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', '*.amazonaws.com', '*.stripe.com'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", 'api.stripe.com', '*.vercel-insights.com', '*.sentry.io'],
    'media-src': ["'self'", 'blob:', '*.amazonaws.com'],
    'frame-src': ["'self'", 'js.stripe.com', 'hooks.stripe.com'],
  },
};

// Password validation
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < SECURITY_CONSTANTS.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONSTANTS.PASSWORD_MIN_LENGTH} characters long`);
  }

  if (SECURITY_CONSTANTS.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (SECURITY_CONSTANTS.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (SECURITY_CONSTANTS.PASSWORD_REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (SECURITY_CONSTANTS.PASSWORD_REQUIRE_SYMBOL && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Generate a secure random token
export const generateSecureToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

// Hash sensitive data
export const hashData = (data: string, salt?: string): { hash: string; salt: string } => {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .createHmac('sha256', useSalt)
    .update(data)
    .digest('hex');

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

// Generate a Content Security Policy header
export const generateCSP = (): string => {
  return Object.entries(SECURITY_CONSTANTS.CONTENT_SECURITY_POLICY)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
};

// CSRF token generation and validation
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
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch (error) {
    logger.error('CSRF token validation failed', {}, error as Error);
    return false;
  }
};

// Sanitize user input to prevent XSS
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// GDPR data export
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

// GDPR data deletion
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

// Security headers middleware
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
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
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
      resetTime: now + options.windowMs 
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
  // This would implement more sophisticated detection logic
  // For now, we'll use a simple check for unusual headers or patterns
  
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const referer = request.headers.get('referer') || '';
  
  // Check for missing or suspicious user agent
  if (!userAgent || userAgent.length < 10 || userAgent.includes('bot') || userAgent.includes('crawl')) {
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

// Generate secure response headers for file downloads
export const generateSecureDownloadHeaders = (filename: string, contentType: string): Record<string, string> => {
  return {
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
};