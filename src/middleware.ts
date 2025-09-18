import { NextRequest, NextResponse } from 'next/server';
import { logger, generateRequestId } from './lib/logger';
import { captureError } from './lib/sentry';
import { createRateLimitResponse } from './lib/error-handler';
import { addSecurityHeaders, detectSuspiciousActivity, generateCSP } from './lib/security';
import { AdaptiveRateLimiter } from './lib/adaptive-rate-limiter';
import { getToken } from 'next-auth/jwt';

// Define adaptive rate limiters with different configurations
const apiRateLimiter = new AdaptiveRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  adaptiveRateLimiting: true,
  burstProtection: true,
  skipIpRanges: ['127.0.0.1', '::1'], // Skip localhost
  blockDuration: 300000, // 5 minutes
  maxViolations: 3
});

const authRateLimiter = new AdaptiveRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute (increased for testing)
  adaptiveRateLimiting: false, // Disabled for testing
  burstProtection: false, // Disabled for testing
  blockDuration: 60000, // 1 minute
  maxViolations: 10, // Higher threshold for testing
  skipIpRanges: ['127.0.0.1', '::1'], // Skip localhost
});

const contentRateLimiter = new AdaptiveRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 requests per minute
  adaptiveRateLimiting: true,
  burstProtection: true,
  blockDuration: 600000, // 10 minutes
  maxViolations: 3
});

export async function middleware(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const url = request.nextUrl.pathname;
  const method = request.method;
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const origin = request.headers.get('origin') || 'unknown';

  // Skip middleware for static assets and non-API routes
  if (
    !url.startsWith('/api/') ||
    url.includes('/_next/') ||
    url.includes('/static/')
  ) {
    // For non-API routes, skip security headers temporarily for debugging
    const response = NextResponse.next();
    // return addSecurityHeaders(response); // Temporarily disabled
    return response;
  }

  // Add request ID to headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  
  // CSRF Protection for state-changing operations (check BEFORE rate limiting for security)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = request.headers.get('x-csrf-token');
    const cookieCSRF = request.cookies.get('csrf-token')?.value;
    
    // Skip CSRF for auth callback routes (handled by NextAuth)
    if (!url.includes('/api/auth/') && (!csrfToken || csrfToken !== cookieCSRF)) {
      logger.securityEvent('CSRF token validation failed', 'high', {
        requestId,
        ip,
        url,
        method,
        hasCSRFHeader: !!csrfToken,
        hasCSRFCookie: !!cookieCSRF
      });
      
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: 'CSRF token validation failed',
          },
          requestId,
          timestamp: new Date().toISOString(),
        }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          }
        }
      );
    }
  }

  // Apply appropriate rate limiter based on route
  let rateLimitResult;
  
  if (url.startsWith('/api/auth/')) {
    rateLimitResult = authRateLimiter.checkRequest(request);
  } else if (url.startsWith('/api/content/')) {
    rateLimitResult = contentRateLimiter.checkRequest(request);
  } else {
    rateLimitResult = apiRateLimiter.checkRequest(request);
  }
  
  if (rateLimitResult.limited) {
    // Log enhanced security event with adaptive rate limiting info
    logger.securityEvent('Adaptive rate limit triggered', 'medium', {
      requestId,
      ip,
      url,
      method,
      userAgent,
      rateLimitType: url.startsWith('/api/auth/') ? 'auth' : url.startsWith('/api/content/') ? 'content' : 'api',
      suspicionScore: rateLimitResult.suspicionScore || 0,
      remainingRequests: rateLimitResult.remaining || 0
    });
    return rateLimitResult.response;
  }

  // Detect suspicious activity
  if (detectSuspiciousActivity(request)) {
    logger.securityEvent('Suspicious activity detected', 'medium', {
      requestId,
      ip,
      url,
      method,
      userAgent,
    });
    
    // For suspicious requests, we might want to:
    // 1. Add to a temporary blocklist
    // 2. Require additional verification
    // 3. Return a generic error
    
    // For now, we'll just return a 403 Forbidden
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
        requestId,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        }
      }
    );
  }

  // Log request
  logger.info(`API Request: ${method} ${url}`, {
    requestId,
    ip,
    method,
    url,
    userAgent,
    origin,
  });

  // OAuth session security checks for authenticated routes
  if (url.startsWith('/api/') && !url.startsWith('/api/auth/')) {
    try {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      
      if (token) {
        // Check for session hijacking indicators
        const currentUserAgent = userAgent;
        const storedUserAgent = token.userAgent as string;
        
        if (storedUserAgent && currentUserAgent !== storedUserAgent) {
          logger.securityEvent('Potential session hijacking detected', 'high', {
            requestId,
            userId: token.id,
            ip,
            currentUserAgent,
            storedUserAgent,
            url
          });
          
          // For high-security operations, you might want to force re-authentication
          if (url.includes('/api/auth/refresh') || url.includes('/api/billing/')) {
            return new NextResponse(
              JSON.stringify({
                success: false,
                error: {
                  code: 'SESSION_SECURITY_CHECK_FAILED',
                  message: 'Security check failed. Please re-authenticate.',
                },
                requestId,
                timestamp: new Date().toISOString(),
              }),
              { 
                status: 401,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Request-ID': requestId,
                }
              }
            );
          }
        }
        
        // Log OAuth token refresh attempts for audit
        if (url.includes('/api/auth/refresh')) {
          logger.securityEvent('OAuth token refresh attempt', 'low', {
            requestId,
            userId: token.id,
            ip,
            userAgent
          });
        }
      }
    } catch (error) {
      logger.error('Error during OAuth security check', { requestId, url }, error as Error);
    }
  }

  // Process the request
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add response headers
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-response-time', `${Date.now() - startTime}ms`);

  // Add comprehensive security headers - TEMPORARILY DISABLED FOR DEBUGGING
  // addSecurityHeaders(response);

  // Add CORS headers for API routes if needed
  if (url.startsWith('/api/') && origin !== 'unknown') {
    // Check if the origin is allowed (you might want to use a whitelist)
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_FRONTEND_URL || '',
      'http://localhost:3000',
      'https://direct-fan-platform.vercel.app',
    ];
    
    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id');
      response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
      
      // Handle preflight requests
      if (method === 'OPTIONS') {
        return new NextResponse(null, {
          status: 204,
          headers: response.headers,
        });
      }
    }
  }

  // Log response
  response.clone().text().then(
    (body) => {
      const duration = Date.now() - startTime;
      const status = response.status;
      
      if (status >= 400) {
        logger.warn(`API Response: ${method} ${url} ${status}`, {
          requestId,
          ip,
          method,
          url,
          status,
          duration,
          body: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
        });
        
        // Log security-related errors with higher severity
        if (status === 401 || status === 403) {
          logger.securityEvent(`Authentication/Authorization failure: ${method} ${url}`, 'medium', {
            requestId,
            ip,
            method,
            url,
            status,
          });
        }
      } else {
        logger.info(`API Response: ${method} ${url} ${status}`, {
          requestId,
          ip,
          method,
          url,
          status,
          duration,
        });
      }
    }
  ).catch((error) => {
    logger.error('Error processing response body', { requestId, url }, error);
    captureError(error, { requestId, url, method });
  });

  return response;
}

// Configure which paths this middleware is run for
export const config = {
  matcher: [
    // Temporarily disabled for debugging hydration issues
    '/api/((?!auth).*)', // Only apply to non-auth API routes
  ],
};
