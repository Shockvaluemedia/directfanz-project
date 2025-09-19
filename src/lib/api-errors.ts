import { NextResponse } from 'next/server';
import { logger } from './logger';

// Standard API error types
export enum APIErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

// Standard API error structure
export interface APIError {
  type: APIErrorType;
  message: string;
  details?: any;
  code?: string;
  timestamp: string;
  requestId?: string;
}

// Error response structure
export interface APIErrorResponse {
  success: false;
  error: APIError;
}

export interface APISuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export type APIResponse<T = any> = APISuccessResponse<T> | APIErrorResponse;

// Create standardized error responses
export function createErrorResponse(
  type: APIErrorType,
  message: string,
  statusCode: number,
  details?: any,
  requestId?: string
): NextResponse<APIErrorResponse> {
  const error: APIError = {
    type,
    message,
    details,
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Log the error
  logger.error('API Error', {
    type,
    message,
    statusCode,
    details,
    requestId,
  });

  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status: statusCode }
  );
}

// Common error response helpers
export const APIErrors = {
  // 400 Bad Request
  validation: (message: string, details?: any, requestId?: string) =>
    createErrorResponse(APIErrorType.VALIDATION_ERROR, message, 400, details, requestId),

  // 401 Unauthorized
  authentication: (message: string = 'Authentication required', requestId?: string) =>
    createErrorResponse(APIErrorType.AUTHENTICATION_ERROR, message, 401, undefined, requestId),

  // 403 Forbidden
  authorization: (message: string = 'Access denied', requestId?: string) =>
    createErrorResponse(APIErrorType.AUTHORIZATION_ERROR, message, 403, undefined, requestId),

  // 404 Not Found
  notFound: (resource: string = 'Resource', requestId?: string) =>
    createErrorResponse(
      APIErrorType.NOT_FOUND_ERROR,
      `${resource} not found`,
      404,
      undefined,
      requestId
    ),

  // 409 Conflict
  conflict: (message: string, details?: any, requestId?: string) =>
    createErrorResponse(APIErrorType.CONFLICT_ERROR, message, 409, details, requestId),

  // 429 Too Many Requests
  rateLimit: (message: string = 'Too many requests', requestId?: string) =>
    createErrorResponse(APIErrorType.RATE_LIMIT_ERROR, message, 429, undefined, requestId),

  // 500 Internal Server Error
  internal: (message: string = 'Internal server error', details?: any, requestId?: string) =>
    createErrorResponse(APIErrorType.INTERNAL_SERVER_ERROR, message, 500, details, requestId),

  // Database-specific errors
  database: (message: string, details?: any, requestId?: string) =>
    createErrorResponse(APIErrorType.DATABASE_ERROR, message, 500, details, requestId),

  // External service errors
  externalService: (service: string, details?: any, requestId?: string) =>
    createErrorResponse(
      APIErrorType.EXTERNAL_SERVICE_ERROR,
      `External service error: ${service}`,
      502,
      details,
      requestId
    ),
};

// Success response helper
export function createSuccessResponse<T>(
  data: T,
  meta?: APISuccessResponse<T>['meta']
): NextResponse<APISuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}

// Error handling middleware for API routes
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse | Response>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const result = await handler(...args);
      return result as NextResponse;
    } catch (error: any) {
      // Extract request ID if available
      const request = args[0] as any;
      const requestId = request?.headers?.get('x-request-id');

      // Handle different types of errors
      if (error.name === 'ZodError') {
        return APIErrors.validation('Invalid request data', error.errors, requestId);
      }

      if (error.code === 'P2002') {
        return APIErrors.conflict('Resource already exists', error.meta, requestId);
      }

      if (error.code?.startsWith('P2')) {
        return APIErrors.database('Database operation failed', error.message, requestId);
      }

      if (error.message?.includes('Unauthorized')) {
        return APIErrors.authentication(error.message, requestId);
      }

      if (error.message?.includes('Forbidden')) {
        return APIErrors.authorization(error.message, requestId);
      }

      // Default to internal server error
      return APIErrors.internal(
        process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
        requestId
      );
    }
  };
}

// Client-side error handling hook
export function useAPIError() {
  const handleError = (error: any): string => {
    // If it's already an APIErrorResponse, extract the message
    if (error?.error?.message) {
      return error.error.message;
    }

    // If it's a fetch error
    if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }

    // If it's a timeout error
    if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }

    // Generic error message
    return error?.message || 'An unexpected error occurred';
  };

  const isAPIError = (error: any): error is APIErrorResponse => {
    return error && typeof error === 'object' && error.success === false && error.error;
  };

  return { handleError, isAPIError };
}

// Fetch wrapper with error handling
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw data;
    }

    return data;
  } catch (error: any) {
    // If it's already a structured error response, return it
    if (error?.success === false) {
      throw error;
    }

    // Otherwise, create a structured error
    throw {
      success: false,
      error: {
        type: APIErrorType.INTERNAL_SERVER_ERROR,
        message: error?.message || 'Network error',
        timestamp: new Date().toISOString(),
      },
    } as APIErrorResponse;
  }
}
