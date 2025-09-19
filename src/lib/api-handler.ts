import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from './logger';
import { AppError, createError } from './errors';
import { createRateLimiter } from './rate-limiting';

// Standard API response interface
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
    details?: unknown;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    requestId?: string;
    timestamp: string;
    version?: string;
  };
}

// API Handler configuration
export interface ApiHandlerConfig<TQuery, TBody, TResponse> {
  // Validation schemas
  querySchema?: z.ZodSchema<TQuery>;
  bodySchema?: z.ZodSchema<TBody>;

  // Rate limiting
  rateLimit?: {
    requests: number;
    windowMs: number;
    keyGenerator?: (request: NextRequest) => string;
  };

  // Authentication & Authorization
  requireAuth?: boolean;
  allowedRoles?: string[];

  // Request handler
  handler: (params: {
    query: TQuery;
    body: TBody;
    request: NextRequest;
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }) => Promise<TResponse>;

  // Options
  options?: {
    skipLogging?: boolean;
    timeout?: number;
    cors?: {
      origin?: string[];
      methods?: string[];
      headers?: string[];
    };
  };
}

/**
 * Create a standardized API handler with built-in error handling, validation, and logging
 */
export function createApiHandler<TQuery = any, TBody = any, TResponse = any>(
  config: ApiHandlerConfig<TQuery, TBody, TResponse>
) {
  return async (request: NextRequest): Promise<NextResponse<ApiResponse<TResponse>>> => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Apply CORS if configured
      let corsHeaders: HeadersInit = {};
      if (config.options?.cors) {
        const origin = request.headers.get('origin');
        const allowedOrigins = config.options.cors.origin || ['*'];

        if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
          corsHeaders = {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods':
              config.options.cors.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers':
              config.options.cors.headers?.join(', ') || 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
          };
        }
      }

      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, { status: 200, headers: corsHeaders });
      }

      // Apply rate limiting if configured
      if (config.rateLimit) {
        const rateLimiter = createRateLimiter(
          {
            windowMs: config.rateLimit.windowMs,
            maxRequests: config.rateLimit.requests,
            keyGenerator: config.rateLimit.keyGenerator,
          },
          'api'
        );

        const rateLimitResponse = await rateLimiter(request);
        if (rateLimitResponse) {
          // Rate limit exceeded - return the rate limiter's response with our headers
          const responseData = await rateLimitResponse.json();
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please try again later.',
              },
              meta: {
                requestId,
                timestamp: new Date().toISOString(),
              },
            } as ApiResponse,
            {
              status: 429,
              headers: {
                ...corsHeaders,
                ...Object.fromEntries(rateLimitResponse.headers.entries()),
              },
            }
          );
        }
      }

      // Authentication check
      let user: { id: string; email: string; role: string } | undefined;
      if (config.requireAuth) {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          throw createError('UNAUTHORIZED', 'Missing or invalid authentication token');
        }

        // TODO: Implement actual JWT verification
        // For now, mock user extraction
        user = { id: 'user-123', email: 'user@example.com', role: 'USER' };

        // Role-based authorization
        if (config.allowedRoles && !config.allowedRoles.includes(user.role)) {
          throw createError('FORBIDDEN', 'Insufficient permissions for this resource');
        }
      }

      // Extract and validate query parameters
      const url = new URL(request.url);
      const queryParams = Object.fromEntries(url.searchParams);

      const query = config.querySchema
        ? config.querySchema.parse(queryParams)
        : (queryParams as TQuery);

      // Extract and validate request body
      let body = {} as TBody;
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const rawBody = await request.json();
          body = config.bodySchema ? config.bodySchema.parse(rawBody) : rawBody;
        } catch (error) {
          if (config.bodySchema && error instanceof z.ZodError) {
            throw error; // Re-throw Zod errors to be handled by the error handler
          }
          throw createError('VALIDATION_ERROR', 'Invalid JSON in request body');
        }
      }

      // Execute the handler with timeout
      const handlerPromise = config.handler({ query, body, request, user });

      const timeoutPromise = config.options?.timeout
        ? new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(createError('TIMEOUT', 'Request timeout')),
              config.options!.timeout!
            )
          )
        : null;

      const data = timeoutPromise
        ? await Promise.race([handlerPromise, timeoutPromise])
        : await handlerPromise;

      const duration = Date.now() - startTime;

      // Log successful requests (unless disabled)
      if (!config.options?.skipLogging) {
        logger.info('API request completed', {
          requestId,
          method: request.method,
          url: request.url,
          duration: `${duration}ms`,
          userAgent: request.headers.get('user-agent'),
          userId: user?.id,
        });
      }

      // Return successful response
      return NextResponse.json(
        {
          success: true,
          data,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            version: '1.0',
          },
        } as ApiResponse<TResponse>,
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'X-Request-ID': requestId,
            'X-Response-Time': `${duration}ms`,
          },
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle different error types
      let statusCode = 500;
      let errorResponse: ApiResponse['error'] = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      };

      if (error instanceof z.ZodError) {
        statusCode = 400;
        errorResponse = {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: err.input,
          })),
        };
      } else if (error instanceof AppError) {
        statusCode = error.statusCode;
        errorResponse = {
          code: error.code,
          message: error.message,
          field: error.field,
          details: error.details,
        };
      } else if (error instanceof Error) {
        // Log unexpected errors
        logger.error('Unhandled API error', {
          requestId,
          method: request.method,
          url: request.url,
          duration: `${duration}ms`,
          error: error.message,
          stack: error.stack,
          userId: user?.id,
        });

        // Don't expose internal error details in production
        if (process.env.NODE_ENV === 'production') {
          errorResponse.message = 'Internal server error';
        } else {
          errorResponse.message = error.message;
          errorResponse.details = { stack: error.stack };
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: errorResponse,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse,
        {
          status: statusCode,
          headers: {
            'X-Request-ID': requestId,
            'X-Response-Time': `${duration}ms`,
          },
        }
      );
    }
  };
}

/**
 * Standardized success response helper
 */
export function successResponse<T>(data: T, meta?: Partial<ApiResponse['meta']>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      ...meta,
    },
  };
}

/**
 * Standardized error response helper
 */
export function errorResponse(
  code: string,
  message: string,
  statusCode: number = 400,
  details?: unknown
): { response: ApiResponse; statusCode: number } {
  return {
    response: {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    statusCode,
  };
}

/**
 * Pagination helper for API responses
 */
export function paginationMeta(
  page: number,
  limit: number,
  total: number
): ApiResponse['meta']['pagination'] {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Common query parameter schemas
 */
export const commonSchemas = {
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  sorting: z.object({
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  search: z.object({
    search: z.string().min(1).max(100).optional(),
  }),

  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
};

// Export types for external use
export type { ApiHandlerConfig, ApiResponse };
