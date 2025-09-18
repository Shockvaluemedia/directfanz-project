import { NextResponse } from 'next/server';
import { logger } from './logger';
import { captureError } from './sentry';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function createErrorResponse(
  error: unknown,
  requestId?: string
): NextResponse {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  if (error instanceof APIError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
    // Log unexpected errors
    logger.error('Unexpected API error', { requestId }, error);
    captureError(error, { requestId });
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      ...(requestId && { requestId }),
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

// Common error creators
export const UnauthorizedError = (message = 'Authentication required') =>
  new APIError(message, 401, 'UNAUTHORIZED');

export const ForbiddenError = (message = 'Access denied') =>
  new APIError(message, 403, 'FORBIDDEN');

export const NotFoundError = (message = 'Resource not found') =>
  new APIError(message, 404, 'NOT_FOUND');

export const ValidationError = (message: string, details?: any) =>
  new APIError(message, 400, 'VALIDATION_ERROR', details);

export const ConflictError = (message: string) =>
  new APIError(message, 409, 'CONFLICT');

export const RateLimitError = (message = 'Rate limit exceeded') =>
  new APIError(message, 429, 'RATE_LIMITED');