/**
 * Error handling middleware and utilities for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import {
  AppError,
  ErrorCode,
  isAppError,
  getUserFriendlyMessage,
  createInternalError,
  createValidationError,
  createDatabaseError,
} from './errors';
import { logger, generateRequestId, LogContext } from './logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
  timestamp: string;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  method: string;
  url: string;
  startTime: number;
}

// Create request context from NextRequest
export const createRequestContext = (
  request: NextRequest,
  userId?: string,
  userRole?: string
): RequestContext => {
  return {
    requestId: generateRequestId(),
    userId,
    userRole,
    ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    method: request.method,
    url: request.url,
    startTime: Date.now(),
  };
};

// Convert request context to log context
export const toLogContext = (context: RequestContext): LogContext => {
  return {
    requestId: context.requestId,
    userId: context.userId,
    ip: context.ip,
    userAgent: context.userAgent,
    method: context.method,
    url: context.url,
  };
};

// Error response creator
export const createErrorResponse = (error: AppError, requestId: string): NextResponse => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: error.code,
      message: getUserFriendlyMessage(error),
      details: error.details,
    },
    requestId,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: error.statusCode });
};

// Success response creator
export const createSuccessResponse = <T>(
  data: T,
  requestId: string,
  statusCode: number = 200
): NextResponse => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: statusCode });
};

// Convert various error types to AppError
export const normalizeError = (error: unknown, context: RequestContext): AppError => {
  const logContext = toLogContext(context);

  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    const details = {
      validationErrors: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };

    logger.warn('Validation error occurred', logContext, { zodError: error.errors });

    return createValidationError('Validation failed', details, context.requestId, context.userId);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Database operation failed';
    let code = ErrorCode.DATABASE_ERROR;
    let statusCode = 500;

    switch (error.code) {
      case 'P2002':
        message = 'A record with this information already exists';
        code = ErrorCode.ALREADY_EXISTS;
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Record not found';
        code = ErrorCode.NOT_FOUND;
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Foreign key constraint failed';
        code = ErrorCode.RESOURCE_CONFLICT;
        statusCode = 409;
        break;
    }

    logger.error('Prisma error occurred', logContext, error, {
      prismaCode: error.code,
      meta: error.meta,
    });

    return new AppError(
      code,
      message,
      statusCode,
      { prismaCode: error.code, meta: error.meta },
      context.requestId,
      context.userId,
      false
    );
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    logger.error('Unknown Prisma error occurred', logContext, error);

    return createDatabaseError(
      'Database error occurred',
      { prismaError: error.message },
      context.requestId,
      context.userId
    );
  }

  if (error instanceof Error) {
    logger.error('Unexpected error occurred', logContext, error);

    return createInternalError(
      'An unexpected error occurred',
      { originalMessage: error.message },
      context.requestId,
      context.userId
    );
  }

  logger.error('Unknown error type occurred', logContext, undefined, { error });

  return createInternalError(
    'An unknown error occurred',
    { error: String(error) },
    context.requestId,
    context.userId
  );
};

// API route wrapper with error handling
export const withErrorHandling = <T extends any[], R>(
  handler: (context: RequestContext, ...args: T) => Promise<R>
) => {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const context = createRequestContext(request);
    const logContext = toLogContext(context);

    try {
      logger.info(`API Request started`, logContext);

      const result = await handler(context, ...args);

      const duration = Date.now() - context.startTime;
      logger.apiRequest(context.method, context.url, 200, duration, logContext);

      return createSuccessResponse(result, context.requestId);
    } catch (error) {
      const appError = normalizeError(error, context);
      const duration = Date.now() - context.startTime;

      logger.apiError(context.method, context.url, appError, {
        ...logContext,
        duration,
        statusCode: appError.statusCode,
      });

      return createErrorResponse(appError, context.requestId);
    }
  };
};

// Async error handler for non-API functions
export const handleAsync = <T extends any[], R>(fn: (...args: T) => Promise<R>) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      const context = {
        requestId: generateRequestId(),
        method: 'INTERNAL',
        url: 'internal-function',
        startTime: Date.now(),
      } as RequestContext;

      throw normalizeError(error, context);
    }
  };
};

// Rate limiting error
export const createRateLimitResponse = (requestId: string, retryAfter?: number): NextResponse => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests. Please wait a moment and try again.',
      details: retryAfter ? { retryAfter } : undefined,
    },
    requestId,
    timestamp: new Date().toISOString(),
  };

  const headers: Record<string, string> = {};
  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }

  return NextResponse.json(response, { status: 429, headers });
};

// Validation helper
export const validateRequest = <T>(
  schema: { parse: (data: unknown) => T },
  data: unknown,
  context: RequestContext
): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    throw normalizeError(error, context);
  }
};

// Database operation wrapper
export const withDatabaseErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: RequestContext,
  operationName: string
): Promise<T> => {
  try {
    logger.debug(`Database operation started: ${operationName}`, toLogContext(context));

    const result = await operation();

    logger.debug(`Database operation completed: ${operationName}`, toLogContext(context));

    return result;
  } catch (error) {
    logger.error(
      `Database operation failed: ${operationName}`,
      toLogContext(context),
      error as Error
    );
    throw normalizeError(error, context);
  }
};
