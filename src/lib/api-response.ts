/**
 * Standardized API response helpers.
 *
 * Usage:
 *   return apiSuccess({ user })          // 200 { success: true, data: { user } }
 *   return apiCreated({ campaign })      // 201
 *   return apiError('NOT_FOUND', 'User not found')   // 404
 *   return apiError('UNAUTHORIZED', 'Login required') // 401
 */

import { NextResponse } from 'next/server';

const STATUS_MAP: Record<string, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
};

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiCreated<T>(data: T) {
  return apiSuccess(data, 201);
}

export function apiError(code: string, message: string, details?: any, status?: number) {
  const httpStatus = status ?? STATUS_MAP[code] ?? 500;
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details && { details }) },
    },
    { status: httpStatus }
  );
}

export function apiValidationError(errors: any[]) {
  return apiError('VALIDATION_ERROR', 'Validation failed', errors, 400);
}
