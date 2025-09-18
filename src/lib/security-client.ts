/**
 * Client-safe security utilities
 */

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

// Password validation (client-safe)
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

// Sanitize user input to prevent XSS (client-safe)
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Generate a Content Security Policy header (client-safe)
export const generateCSP = (): string => {
  return Object.entries(SECURITY_CONSTANTS.CONTENT_SECURITY_POLICY)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
};

// Generate secure response headers for file downloads (client-safe)
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