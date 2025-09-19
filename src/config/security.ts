/**
 * Centralized Security Configuration
 *
 * This file contains all security-related configurations for the application,
 * making it easier to manage and update security policies in one place.
 */

import { RateLimitConfig } from '@/lib/rate-limiting';
import { SecurityHeadersConfig } from '@/lib/security-headers';

// Environment configuration
export const SECURITY_ENV = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTesting: process.env.NODE_ENV === 'test',
} as const;

// Rate limiting configurations
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints (very strict)
  AUTH_LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
  },

  AUTH_REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 registration attempts per hour
  },

  AUTH_PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 password reset attempts per hour
  },

  // API endpoints (moderate)
  API_GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: SECURITY_ENV.isDevelopment ? 1000 : 100, // Higher limit in dev
  },

  // File upload endpoints (strict)
  UPLOAD_CONTENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
  },

  UPLOAD_AVATAR: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 avatar uploads per minute
  },

  // Payment endpoints (very strict)
  PAYMENT_CREATE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3, // 3 payment attempts per minute
  },

  PAYMENT_WEBHOOK: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // Higher limit for webhooks
  },

  // Admin endpoints (strict)
  ADMIN_OPERATIONS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 admin operations per minute
  },

  // Public content endpoints (lenient)
  PUBLIC_CONTENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: SECURITY_ENV.isDevelopment ? 1000 : 200,
  },

  // Live streaming endpoints
  LIVESTREAM_CREATE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 stream creations per minute
  },

  LIVESTREAM_JOIN: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 stream joins per minute
  },
} as const;

// Security headers configurations
export const SECURITY_HEADERS_CONFIGS: Record<string, SecurityHeadersConfig> = {
  // Default configuration for most routes
  DEFAULT: {
    csp: {
      enabled: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'unsafe-inline'", // Required for Next.js
          ...(SECURITY_ENV.isDevelopment ? ["'unsafe-eval'"] : []),
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://js.stripe.com',
          'https://cdn.jsdelivr.net',
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'", // Required for styled-components
          'https://fonts.googleapis.com',
        ],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:', 'https://res.cloudinary.com'],
        'media-src': ["'self'", 'blob:', 'https:', 'https://res.cloudinary.com'],
        'connect-src': [
          "'self'",
          'https://api.stripe.com',
          'https://www.google-analytics.com',
          'wss:',
          ...(SECURITY_ENV.isDevelopment ? ['ws://localhost:*'] : []),
        ].filter(Boolean),
        'frame-src': [
          "'self'",
          'https://js.stripe.com',
          'https://www.youtube.com',
          'https://player.vimeo.com',
        ],
        'worker-src': ["'self'", 'blob:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': SECURITY_ENV.isProduction ? [] : undefined,
      },
      reportOnly: SECURITY_ENV.isDevelopment,
      reportUri: '/api/security/csp-report',
    },
    hsts: {
      enabled: SECURITY_ENV.isProduction,
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameOptions: 'DENY',
    contentTypeOptions: true,
    xssProtection: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      accelerometer: [],
      'ambient-light-sensor': [],
      autoplay: ['self'],
      battery: [],
      camera: ['self'],
      'cross-origin-isolated': [],
      'display-capture': [],
      'document-domain': [],
      'encrypted-media': ['self'],
      'execution-while-not-rendered': [],
      'execution-while-out-of-viewport': [],
      fullscreen: ['self'],
      geolocation: [],
      gyroscope: [],
      'keyboard-map': [],
      magnetometer: [],
      microphone: ['self'],
      midi: [],
      'navigation-override': [],
      payment: ['self'],
      'picture-in-picture': [],
      'publickey-credentials-get': [],
      'screen-wake-lock': [],
      'sync-xhr': [],
      usb: [],
      'web-share': ['self'],
      'xr-spatial-tracking': [],
    },
    crossOrigin: {
      embedderPolicy: 'require-corp',
      openerPolicy: 'same-origin',
      resourcePolicy: 'same-origin',
    },
  },

  // Stricter configuration for sensitive operations
  STRICT: {
    csp: {
      enabled: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'frame-src': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': [],
      },
      reportOnly: false,
      reportUri: '/api/security/csp-report',
    },
    hsts: {
      enabled: SECURITY_ENV.isProduction,
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameOptions: 'DENY',
    contentTypeOptions: true,
    xssProtection: true,
    referrerPolicy: 'no-referrer',
    crossOrigin: {
      embedderPolicy: 'require-corp',
      openerPolicy: 'same-origin',
      resourcePolicy: 'same-site',
    },
  },

  // Relaxed configuration for development
  DEVELOPMENT: {
    csp: {
      enabled: false, // Disabled for easier development
    },
    hsts: {
      enabled: false, // No HSTS in development
    },
    frameOptions: false,
    contentTypeOptions: true,
    xssProtection: true,
    referrerPolicy: 'origin-when-cross-origin',
  },
} as const;

// Input validation configurations
export const VALIDATION_LIMITS = {
  // Text field limits
  EMAIL_MAX_LENGTH: 254,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  DISPLAY_NAME_MAX_LENGTH: 100,
  BIO_MAX_LENGTH: 500,
  DESCRIPTION_MAX_LENGTH: 1000,
  CONTENT_MAX_LENGTH: 10000,
  TITLE_MAX_LENGTH: 200,

  // File upload limits (in bytes)
  AVATAR_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  IMAGE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  AUDIO_MAX_SIZE: 100 * 1024 * 1024, // 100MB
  VIDEO_MAX_SIZE: 500 * 1024 * 1024, // 500MB
  DOCUMENT_MAX_SIZE: 25 * 1024 * 1024, // 25MB

  // API request limits
  MAX_REQUEST_BODY_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_QUERY_STRING_LENGTH: 2048,
  MAX_URL_LENGTH: 2048,

  // Collection limits
  MAX_TAGS_PER_CONTENT: 10,
  MAX_TAG_LENGTH: 50,
  MAX_COMMENTS_PER_REQUEST: 100,
  MAX_SEARCH_RESULTS: 100,
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  DOCUMENTS: ['application/pdf', 'text/plain'],
  AVATARS: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

// Security monitoring thresholds
export const SECURITY_THRESHOLDS = {
  // Rate limiting violations before temporary block
  MAX_RATE_LIMIT_VIOLATIONS: 3,

  // Time to block IP after violations (in milliseconds)
  IP_BLOCK_DURATION: 15 * 60 * 1000, // 15 minutes

  // Failed login attempts before account lock
  MAX_FAILED_LOGINS: 5,

  // Account lock duration (in milliseconds)
  ACCOUNT_LOCK_DURATION: 30 * 60 * 1000, // 30 minutes

  // Suspicious activity scoring thresholds
  SUSPICION_SCORE_WARNING: 70,
  SUSPICION_SCORE_BLOCK: 90,

  // File validation thresholds
  MAX_FILE_NAME_LENGTH: 255,
  MAX_UPLOAD_ATTEMPTS_PER_HOUR: 50,
} as const;

// CORS configuration
export const CORS_CONFIG = {
  allowedOrigins: [
    process.env.NEXT_PUBLIC_FRONTEND_URL || '',
    'http://localhost:3000',
    'http://localhost:3001',
    ...(SECURITY_ENV.isDevelopment ? ['http://127.0.0.1:3000'] : []),
  ].filter(Boolean),

  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'X-Request-ID',
    'Accept',
    'Origin',
  ],

  exposedHeaders: [
    'X-Request-ID',
    'X-Response-Time',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],

  credentials: true,
  maxAge: 86400, // 24 hours
} as const;

// Session security configuration
export const SESSION_CONFIG = {
  // JWT token expiration
  JWT_EXPIRY: '24h',
  JWT_REFRESH_EXPIRY: '7d',

  // Session cookie settings
  COOKIE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  COOKIE_SECURE: SECURITY_ENV.isProduction,
  COOKIE_HTTP_ONLY: true,
  COOKIE_SAME_SITE: 'strict' as const,

  // Session validation
  CHECK_USER_AGENT: true,
  CHECK_IP_CHANGE: SECURITY_ENV.isProduction,
  ALLOW_CONCURRENT_SESSIONS: 3,
} as const;

// Content security policies for different route types
export const ROUTE_SECURITY_CONFIGS = {
  '/api/auth/*': 'STRICT',
  '/api/admin/*': 'STRICT',
  '/api/billing/*': 'STRICT',
  '/api/content/*': 'DEFAULT',
  '/api/artist/*': 'DEFAULT',
  '/api/public/*': 'DEFAULT',
} as const;

// Helper functions to get configurations
export function getRateLimitConfig(endpoint: string): RateLimitConfig {
  return RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS.API_GENERAL;
}

export function getSecurityHeadersConfig(route: string): SecurityHeadersConfig {
  // Check for specific route patterns
  for (const [pattern, configName] of Object.entries(ROUTE_SECURITY_CONFIGS)) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    if (regex.test(route)) {
      return SECURITY_HEADERS_CONFIGS[configName];
    }
  }

  // Return default configuration
  return SECURITY_ENV.isDevelopment
    ? SECURITY_HEADERS_CONFIGS.DEVELOPMENT
    : SECURITY_HEADERS_CONFIGS.DEFAULT;
}

export function isAllowedOrigin(origin: string): boolean {
  return CORS_CONFIG.allowedOrigins.includes(origin);
}

export function getMaxFileSize(fileType: string): number {
  if (ALLOWED_FILE_TYPES.IMAGES.includes(fileType)) {
    return VALIDATION_LIMITS.IMAGE_MAX_SIZE;
  }
  if (ALLOWED_FILE_TYPES.AUDIO.includes(fileType)) {
    return VALIDATION_LIMITS.AUDIO_MAX_SIZE;
  }
  if (ALLOWED_FILE_TYPES.VIDEO.includes(fileType)) {
    return VALIDATION_LIMITS.VIDEO_MAX_SIZE;
  }
  if (ALLOWED_FILE_TYPES.DOCUMENTS.includes(fileType)) {
    return VALIDATION_LIMITS.DOCUMENT_MAX_SIZE;
  }
  return VALIDATION_LIMITS.IMAGE_MAX_SIZE; // Default to image size
}

export function isAllowedFileType(
  fileType: string,
  category?: keyof typeof ALLOWED_FILE_TYPES
): boolean {
  if (category) {
    return ALLOWED_FILE_TYPES[category].includes(fileType as any);
  }

  // Check all categories
  return Object.values(ALLOWED_FILE_TYPES).some(types => types.includes(fileType as any));
}
