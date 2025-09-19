import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ZodError } from 'zod';

// Standard API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Success response helper
export function apiSuccess<T>(data?: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
}

// Error response helper
export function apiError(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

// Validation error helper
export function validationError(error: ZodError): NextResponse<ApiResponse> {
  const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
  return NextResponse.json(
    {
      success: false,
      error: `Validation failed: ${errors}`,
    },
    { status: 400 }
  );
}

// Paginated response helper
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): NextResponse<ApiResponse<T[]>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

// Safe URL parsing utility for static generation compatibility
export function safeParseURL(request: NextRequest): URL | null {
  try {
    // During static generation, request.url might be empty or invalid
    if (!request.url || request.url === '') {
      return null;
    }
    return new URL(request.url);
  } catch (error) {
    console.warn('Failed to parse request URL during static generation:', request.url);
    return null;
  }
}

// Extract pagination params from request
export function getPaginationFromRequest(request: NextRequest) {
  const url = safeParseURL(request);
  if (!url) {
    return { page: 1, limit: 10 }; // Default values for static generation
  }
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));

  return { page, limit };
}

// Extract search params from request
export function getSearchFromRequest(request: NextRequest) {
  const url = safeParseURL(request);
  return url?.searchParams.get('search') || '';
}

// Authentication middleware
export async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error('Authentication required');
  }

  return session;
}

// Role-based authorization
export async function requireRole(request: NextRequest, allowedRoles: string[]) {
  const session = await requireAuth(request);

  if (!allowedRoles.includes(session.user.role)) {
    throw new Error('Insufficient permissions');
  }

  return session;
}

// Generic API handler wrapper with error handling
export function apiHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);

      if (error instanceof ZodError) {
        return validationError(error);
      }

      if (error instanceof Error) {
        if (error.message === 'Authentication required') {
          return apiError('Authentication required', 401);
        }
        if (error.message === 'Insufficient permissions') {
          return apiError('Insufficient permissions', 403);
        }
        return apiError(error.message, 400);
      }

      return apiError('Internal server error', 500);
    }
  };
}

// Body parser with validation
export async function parseAndValidate<T>(
  request: NextRequest,
  schema: { parse: (data: any) => T }
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw error;
    }
    throw new Error('Invalid JSON body');
  }
}

// File upload helpers
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some(type => file.type.startsWith(type));
}

export function validateFileSize(file: File, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
}

// URL parameter extraction
export function getIdFromParams(params: { id?: string }): string {
  if (!params.id) {
    throw new Error('ID parameter is required');
  }
  return params.id;
}

// Check if user owns resource
export async function checkResourceOwnership(
  userId: string,
  resourceOwnerId: string,
  userRole: string
): Promise<boolean> {
  // Admins can access everything
  if (userRole === 'ADMIN') {
    return true;
  }

  // Users can access their own resources
  return userId === resourceOwnerId;
}

// Rate limiting helper (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

// CORS helper
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

// Handle preflight requests
export function handlePreflight(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}
