import { NextRequest, NextResponse } from 'next/server';

/**
 * The one page where the browser may use the camera and microphone: the
 * artist's listening party broadcast page. Everywhere else they stay off.
 */
export const BROADCAST_PAGE_PATTERN = /^\/dashboard\/artist\/livestreams\/[^/]+\/broadcast\/?$/;

export function permissionsPolicyFor(pathname?: string): string {
  const media =
    pathname && BROADCAST_PAGE_PATTERN.test(pathname)
      ? 'camera=(self), microphone=(self)'
      : 'camera=(), microphone=()';
  return `${media}, geolocation=(), payment=()`;
}

export class SecurityHeadersManager {
  private static getCSPHeader(): string {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      // Amazon IVS: party playback (HLS) and the browser broadcaster's ingest.
      "connect-src 'self' https://api.stripe.com wss: https://*.live-video.net",
      "media-src 'self' blob: https://*.live-video.net",
      "worker-src 'self' blob:",
      "frame-src https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ];
    return csp.join('; ');
  }

  static getSecurityHeaders(pathname?: string): Record<string, string> {
    return {
      // Content Security Policy
      'Content-Security-Policy': this.getCSPHeader(),
      
      // HSTS
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // XSS Protection
      'X-XSS-Protection': '1; mode=block',
      
      // Referrer Policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Permissions Policy
      'Permissions-Policy': permissionsPolicyFor(pathname),
      
      // Remove server information
      'Server': '',
      'X-Powered-By': '',
    };
  }

  static applySecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
    const headers = this.getSecurityHeaders(pathname);
    
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }

  static validateSecurityHeaders(headers: Headers): {
    valid: boolean;
    missing: string[];
    issues: string[];
  } {
    const requiredHeaders = [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
    ];
    
    const missing: string[] = [];
    const issues: string[] = [];
    
    requiredHeaders.forEach(header => {
      if (!headers.get(header)) {
        missing.push(header);
      }
    });
    
    // Validate specific header values
    const csp = headers.get('Content-Security-Policy');
    if (csp && !csp.includes("default-src 'self'")) {
      issues.push('CSP should include default-src self');
    }
    
    const hsts = headers.get('Strict-Transport-Security');
    if (hsts && !hsts.includes('max-age=')) {
      issues.push('HSTS should include max-age');
    }
    
    return {
      valid: missing.length === 0 && issues.length === 0,
      missing,
      issues,
    };
  }
}

export function securityMiddleware(request: NextRequest) {
  const response = NextResponse.next();
  return SecurityHeadersManager.applySecurityHeaders(response);
}

// Standalone exports for middleware compatibility
export function applySecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
  return SecurityHeadersManager.applySecurityHeaders(response, pathname);
}

export function getSecurityConfig() {
  return {
    headers: SecurityHeadersManager.applySecurityHeaders,
  };
}