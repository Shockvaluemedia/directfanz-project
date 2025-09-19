/**
 * Unified API Error Handling System
 * Consolidates error handling patterns across the application
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger, generateRequestId } from '@/lib/logger';
import { AppError, ErrorCode, isAppError, getUserFriendlyMessage } from '@/lib/errors';

// Standard API response types
export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
  requestId: string;
  timestamp: string;
}

// Request context for consistent logging
export interface ApiRequestContext {
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: string;
  userRole?: string;
  startTime: number;
}

// Create request context from NextRequest
export function createApiContext(request: NextRequest): ApiRequestContext {
  return {
    requestId: generateRequestId(),
    method: request.method,
    url: request.url,
    ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    startTime: Date.now(),
  };
}

// Add user info to context
export function addUserToContext(
  context: ApiRequestContext,
  userId: string,
  userRole: string
): ApiRequestContext {
  return {
    ...context,
    userId,
    userRole,
  };
}

// Convert context to logger context
export function toLoggerContext(context: ApiRequestContext) {
  return {
    requestId: context.requestId,
    userId: context.userId,
    userRole: context.userRole,
    ip: context.ip,
    userAgent: context.userAgent,
    method: context.method,
    url: context.url,
  };
}

// Success response helper
export function createSuccessResponse<T>(
  data: T,
  context: ApiRequestContext,
  statusCode: number = 200
): NextResponse<StandardApiResponse<T>> {
  const response: StandardApiResponse<T> = {
    success: true,
    data,
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  };

  // Log successful API call
  const duration = Date.now() - context.startTime;
  logger.apiRequest(context.method, context.url, statusCode, duration, toLoggerContext(context));

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'X-Request-ID': context.requestId,
    },
  });
}

// Error response helper
export function createErrorResponse(
  error: AppError,
  context: ApiRequestContext
): NextResponse<StandardApiResponse> {
  const response: StandardApiResponse = {
    success: false,
    error: {
      code: error.code,
      message: getUserFriendlyMessage(error),
      details: process.env.NODE_ENV === 'development' ? error.details : undefined,
      timestamp: error.timestamp,
    },
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  };

  // Log API error
  const duration = Date.now() - context.startTime;
  logger.apiError(context.method, context.url, error, {
    ...toLoggerContext(context),
    duration,
    statusCode: error.statusCode,
  });

  return NextResponse.json(response, {
    status: error.statusCode,
    headers: {
      'X-Request-ID': context.requestId,
    },
  });
}

// Convert various error types to AppError
export function normalizeApiError(error: unknown, context: ApiRequestContext): AppError {
  const logContext = toLoggerContext(context);

  // Already an AppError
  if (isAppError(error)) {
    return error;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const details = {
      validationErrors: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
        value: err.input,
      })),
    };

    logger.warn('API validation error', logContext, { zodErrors: error.errors });

    return new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      400,
      details,
      context.requestId,
      context.userId
    );
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Database operation failed';
    let code = ErrorCode.DATABASE_ERROR;
    let statusCode = 500;

    switch (error.code) {
      case 'P2002': // Unique constraint violation
        message = 'A record with this information already exists';
        code = ErrorCode.ALREADY_EXISTS;
        statusCode = 409;
        break;
      case 'P2025': // Record not found
        message = 'Record not found';
        code = ErrorCode.NOT_FOUND;
        statusCode = 404;
        break;
      case 'P2003': // Foreign key constraint failed
        message = 'Referenced record does not exist';
        code = ErrorCode.RESOURCE_CONFLICT;
        statusCode = 409;
        break;
      case 'P2021': // Table does not exist
        message = 'Database configuration error';
        code = ErrorCode.DATABASE_ERROR;
        statusCode = 500;
        break;
      case 'P2024': // Timeout
        message = 'Database operation timed out';
        code = ErrorCode.DATABASE_ERROR;
        statusCode = 500;
        break;
    }

    logger.error('Prisma error in API', logContext, error, {
      prismaCode: error.code,
      meta: error.meta,
    });

    return new AppError(
      code,
      message,
      statusCode,
      {
        prismaCode: error.code,
        meta: error.meta,
        target: error.meta?.target,
      },
      context.requestId,
      context.userId,
      false // Database errors are not operational
    );
  }

  // Prisma client validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error in API', logContext, error);

    return new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid database query',
      400,
      { originalError: error.message },
      context.requestId,
      context.userId
    );
  }

  // Prisma unknown request errors
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    logger.error('Unknown Prisma error in API', logContext, error);

    return new AppError(
      ErrorCode.DATABASE_ERROR,
      'Database error occurred',
      500,
      { originalError: error.message },
      context.requestId,
      context.userId,
      false
    );
  }

  // Network/fetch errors
  if (error instanceof Error && (error.name === 'TypeError' || error.message.includes('fetch'))) {
    logger.error('Network error in API', logContext, error);

    return new AppError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      'External service unavailable',
      503,
      { originalError: error.message },
      context.requestId,
      context.userId
    );
  }

  // Generic JavaScript errors
  if (error instanceof Error) {
    logger.error('Unexpected error in API', logContext, error);

    return new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      500,
      process.env.NODE_ENV === 'development'
        ? {
            originalError: error.message,
            stack: error.stack,
          }
        : undefined,
      context.requestId,
      context.userId,
      false
    );
  }

  // Unknown error types
  logger.error('Unknown error type in API', logContext, undefined, { error });

  return new AppError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    'An unknown error occurred',
    500,
    { error: String(error) },
    context.requestId,
    context.userId,
    false
  );
}

// Request validation helper
export function validateApiRequest<T>(
  schema: ZodSchema<T>,
  data: unknown,
  context: ApiRequestContext
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    throw normalizeApiError(error, context);
  }
}

// Main API handler wrapper
export function withApiHandler<T extends any[], R>(
  handler: (context: ApiRequestContext, ...args: T) => Promise<R>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const context = createApiContext(request);

    try {
      logger.info('API request started', toLoggerContext(context));

      const result = await handler(context, ...args);

      // If handler returns NextResponse directly, return it
      if (result instanceof NextResponse) {
        return result;
      }

      // Otherwise wrap in success response
      return createSuccessResponse(result, context);
    } catch (error) {
      const appError = normalizeApiError(error, context);
      return createErrorResponse(appError, context);
    }
  };
}

// Authenticated API handler wrapper
export function withAuthenticatedApiHandler<T extends any[], R>(
  handler: (context: ApiRequestContext, userId: string, userRole: string, ...args: T) => Promise<R>,
  requiredRole?: 'ADMIN' | 'ARTIST' | 'FAN'
) {
  return withApiHandler(async (context: ApiRequestContext, ...args: T) => {
    // Get session
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'Authentication required',
        401,
        undefined,
        context.requestId
      );
    }

    // Check role if required
    if (requiredRole && session.user.role !== requiredRole) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        `Access denied. ${requiredRole} role required.`,
        403,
        { requiredRole, userRole: session.user.role },
        context.requestId,
        session.user.id
      );
    }

    // Add user info to context
    const userContext = addUserToContext(context, session.user.id, session.user.role);

    return handler(userContext, session.user.id, session.user.role, ...args);
  });
}

// Admin API handler wrapper
export const withAdminApiHandler = <T extends any[], R>(
  handler: (context: ApiRequestContext, userId: string, ...args: T) => Promise<R>
) =>
  withAuthenticatedApiHandler(
    async (context: ApiRequestContext, userId: string, userRole: string, ...args: T) => {
      return handler(context, userId, ...args);
    },
    'ADMIN'
  );

// Artist API handler wrapper
export const withArtistApiHandler = <T extends any[], R>(
  handler: (context: ApiRequestContext, userId: string, ...args: T) => Promise<R>
) =>
  withAuthenticatedApiHandler(
    async (context: ApiRequestContext, userId: string, userRole: string, ...args: T) => {
      return handler(context, userId, ...args);
    },
    'ARTIST'
  );

// Convenient error classes for direct import
export class UnauthorizedError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// Rate limit response helper
export function createRateLimitResponse(requestId?: string): NextResponse {
  const response: StandardApiResponse = {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      timestamp: new Date().toISOString(),
    },
    requestId: requestId || generateRequestId(),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: 429,
    headers: {
      'X-Request-ID': response.requestId,
      'Retry-After': '60',
    },
  });
}
