import { NextRequest, NextResponse } from 'next/server';
import { logger, generateRequestId } from './lib/logger';
import { captureError } from './lib/sentry';
import { createRateLimitResponse } from './lib/error-handler';
import { addSecurityHeaders, createRateLimiter, detectSuspiciousActivity, generateCSP } from './lib/security';

// Define rate limiters with different configurations
const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 requests per 15 minutes
});

const contentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 requests per minute
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
    // For non-API routes, we still want to add security headers
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Add request ID to headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  // Apply appropriate rate limiter based on route
  let rateLimitResult;
  
  if (url.startsWith('/api/auth/')) {
    rateLimitResult = authRateLimiter(request);
  } else if (url.startsWith('/api/content/')) {
    rateLimitResult = contentRateLimiter(request);
  } else {
    rateLimitResult = apiRateLimiter(request);
  }
  
  if (rateLimitResult.limited) {
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

  // Process the request
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add response headers
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-response-time', `${Date.now() - startTime}ms`);

  // Add comprehensive security headers
  addSecurityHeaders(response);

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
    // Apply to all routes for security headers
    '/(.*)',
  ],
};