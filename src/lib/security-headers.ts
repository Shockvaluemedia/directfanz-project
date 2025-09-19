import { NextRequest, NextResponse } from 'next/server';

export interface SecurityHeadersConfig {
  // Content Security Policy
  csp?: {
    enabled: boolean;
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
    reportUri?: string;
  };

  // HSTS (HTTP Strict Transport Security)
  hsts?: {
    enabled: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };

  // X-Frame-Options
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | false;

  // X-Content-Type-Options
  contentTypeOptions?: boolean;

  // X-XSS-Protection
  xssProtection?: boolean;

  // Referrer Policy
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';

  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy?: Record<string, string[]>;

  // Cross-Origin policies
  crossOrigin?: {
    embedderPolicy?: 'unsafe-none' | 'require-corp';
    openerPolicy?: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
    resourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
  };
}

// Default security configuration
const DEFAULT_CONFIG: SecurityHeadersConfig = {
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for Next.js
        "'unsafe-eval'", // Required for Next.js dev mode
        'https://www.googletagmanager.com',
        'https://www.google-analytics.com',
        'https://js.stripe.com',
        'https://cdn.jsdelivr.net',
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled-components and CSS-in-JS
        'https://fonts.googleapis.com',
      ],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https:',
        'https://res.cloudinary.com', // For image uploads
      ],
      'media-src': [
        "'self'",
        'blob:',
        'https:',
        'https://res.cloudinary.com', // For video/audio uploads
      ],
      'connect-src': [
        "'self'",
        'https://api.stripe.com',
        'https://www.google-analytics.com',
        'wss:', // WebSocket connections
        process.env.NODE_ENV === 'development' ? 'ws://localhost:*' : '',
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
      'upgrade-insecure-requests': [],
    },
    reportOnly: false,
  },

  hsts: {
    enabled: true,
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
};

// Build CSP header value
function buildCSPHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
}

// Build Permissions Policy header value
function buildPermissionsPolicyHeader(policies: Record<string, string[]>): string {
  return Object.entries(policies)
    .map(([directive, allowlist]) => {
      if (allowlist.length === 0) {
        return `${directive}=()`;
      }
      const formatted = allowlist.map(origin => (origin === 'self' ? 'self' : `"${origin}"`));
      return `${directive}=(${formatted.join(' ')})`;
    })
    .join(', ');
}

// Apply security headers to response
export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = DEFAULT_CONFIG
): NextResponse {
  // Content Security Policy
  if (config.csp?.enabled) {
    const cspValue = buildCSPHeader(config.csp.directives || {});
    const cspHeader = config.csp.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    if (cspValue) {
      response.headers.set(cspHeader, cspValue);
    }
  }

  // HTTP Strict Transport Security
  if (config.hsts?.enabled && process.env.NODE_ENV === 'production') {
    let hstsValue = `max-age=${config.hsts.maxAge || 31536000}`;
    if (config.hsts.includeSubDomains) hstsValue += '; includeSubDomains';
    if (config.hsts.preload) hstsValue += '; preload';
    response.headers.set('Strict-Transport-Security', hstsValue);
  }

  // X-Frame-Options
  if (config.frameOptions) {
    response.headers.set('X-Frame-Options', config.frameOptions);
  }

  // X-Content-Type-Options
  if (config.contentTypeOptions) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }

  // X-XSS-Protection
  if (config.xssProtection) {
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }

  // Referrer Policy
  if (config.referrerPolicy) {
    response.headers.set('Referrer-Policy', config.referrerPolicy);
  }

  // Permissions Policy
  if (config.permissionsPolicy) {
    const permissionsPolicyValue = buildPermissionsPolicyHeader(config.permissionsPolicy);
    response.headers.set('Permissions-Policy', permissionsPolicyValue);
  }

  // Cross-Origin policies
  if (config.crossOrigin) {
    if (config.crossOrigin.embedderPolicy) {
      response.headers.set('Cross-Origin-Embedder-Policy', config.crossOrigin.embedderPolicy);
    }
    if (config.crossOrigin.openerPolicy) {
      response.headers.set('Cross-Origin-Opener-Policy', config.crossOrigin.openerPolicy);
    }
    if (config.crossOrigin.resourcePolicy) {
      response.headers.set('Cross-Origin-Resource-Policy', config.crossOrigin.resourcePolicy);
    }
  }

  return response;
}

// Security headers middleware
export function createSecurityMiddleware(config?: SecurityHeadersConfig) {
  return function <T extends any[]>(handler: (...args: T) => Promise<NextResponse>) {
    return async (...args: T): Promise<NextResponse> => {
      const response = await handler(...args);
      return applySecurityHeaders(response, config);
    };
  };
}

// Environment-specific configurations
export const SecurityConfigs = {
  development: {
    ...DEFAULT_CONFIG,
    csp: {
      ...DEFAULT_CONFIG.csp,
      directives: {
        ...DEFAULT_CONFIG.csp?.directives,
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", // Required for development
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://js.stripe.com',
          'https://cdn.jsdelivr.net',
        ],
      },
    },
    hsts: {
      ...DEFAULT_CONFIG.hsts,
      enabled: false, // Disable HSTS in development
    },
  } as SecurityHeadersConfig,

  production: {
    ...DEFAULT_CONFIG,
    csp: {
      ...DEFAULT_CONFIG.csp,
      directives: {
        ...DEFAULT_CONFIG.csp?.directives,
        'script-src': [
          "'self'",
          "'unsafe-inline'", // Still needed for Next.js
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://js.stripe.com',
          'https://cdn.jsdelivr.net',
        ],
      },
      reportOnly: false,
    },
  } as SecurityHeadersConfig,

  // Stricter configuration for sensitive pages
  strict: {
    ...DEFAULT_CONFIG,
    csp: {
      ...DEFAULT_CONFIG.csp,
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
    },
    frameOptions: 'DENY',
    crossOrigin: {
      embedderPolicy: 'require-corp',
      openerPolicy: 'same-origin',
      resourcePolicy: 'same-site',
    },
  } as SecurityHeadersConfig,
};

// Get configuration based on environment
export function getSecurityConfig(): SecurityHeadersConfig {
  const env = process.env.NODE_ENV;

  switch (env) {
    case 'development':
      return SecurityConfigs.development;
    case 'production':
      return SecurityConfigs.production;
    default:
      return DEFAULT_CONFIG;
  }
}

// Helper for API routes
export function withSecurityHeaders<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  config?: SecurityHeadersConfig
) {
  const securityMiddleware = createSecurityMiddleware(config || getSecurityConfig());
  return securityMiddleware(handler);
}

// Validate CSP violations (for reporting endpoint)
export interface CSPViolation {
  'document-uri': string;
  referrer: string;
  'violated-directive': string;
  'effective-directive': string;
  'original-policy': string;
  disposition: string;
  'blocked-uri': string;
  'line-number': number;
  'column-number': number;
  'source-file': string;
  'status-code': number;
  'script-sample': string;
}

export function validateCSPReport(body: any): CSPViolation | null {
  try {
    const report = body['csp-report'];
    if (!report) return null;

    // Basic validation
    if (typeof report['document-uri'] !== 'string') return null;
    if (typeof report['violated-directive'] !== 'string') return null;

    return report as CSPViolation;
  } catch {
    return null;
  }
}
