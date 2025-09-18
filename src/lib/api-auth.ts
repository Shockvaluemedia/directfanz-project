import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { UserRole } from "@/types/database"
import { hasPermission, hasAllPermissions, Permission } from "@/lib/rbac"

// API response helper types
export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string
    email: string
    role: UserRole
    name?: string
  }
}

// API authentication middleware
export async function withApiAuth<T = any>(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    if (!token || !token.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ) as NextResponse<T>
    }

    // Attach user info to request
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = {
      id: token.id as string,
      email: token.email as string,
      role: token.role as UserRole,
      name: token.name as string,
    }

    return await handler(authenticatedRequest)
  } catch (error) {
    console.error("API authentication error:", error)
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    ) as NextResponse<T>
  }
}

// Role-based API middleware
export async function withApiRole<T = any>(
  request: NextRequest,
  requiredRole: UserRole,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  return withApiAuth(request, async (req) => {
    if (req.user.role !== requiredRole) {
      return NextResponse.json(
        { 
          error: "Insufficient permissions",
          details: `${requiredRole} role required`
        },
        { status: 403 }
      ) as NextResponse<T>
    }

    return await handler(req)
  })
}

// Permission-based API middleware
export async function withApiPermissions<T = any>(
  request: NextRequest,
  requiredPermissions: Permission[],
  handler: (req: AuthenticatedRequest) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  return withApiAuth(request, async (req) => {
    const hasRequiredPermissions = hasAllPermissions(req.user.role, requiredPermissions)
    
    if (!hasRequiredPermissions) {
      return NextResponse.json(
        { 
          error: "Insufficient permissions",
          details: "Required permissions not met"
        },
        { status: 403 }
      ) as NextResponse<T>
    }

    return await handler(req)
  })
}

// Specific role middleware helpers
export async function withArtistApi(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return withApiRole(request, UserRole.ARTIST, handler)
}

export async function withFanApi(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return withApiRole(request, UserRole.FAN, handler)
}

export async function withAdminApi(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return withApiRole(request, UserRole.ADMIN, handler)
}

// General API auth (any authenticated user)
export async function withApi(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return withApiAuth(request, handler)
}

// Higher-order function to create protected API handlers
export function createProtectedApiHandler<T = any>(
  options: {
    role?: UserRole
    permissions?: Permission[]
  } = {}
) {
  return function(handler: (req: AuthenticatedRequest) => Promise<NextResponse<T>>) {
    return async function(request: NextRequest): Promise<NextResponse<T>> {
      if (options.role) {
        return withApiRole(request, options.role, handler)
      }
      
      if (options.permissions) {
        return withApiPermissions(request, options.permissions, handler)
      }
      
      return withApiAuth(request, handler)
    }
  }
}

// Convenience creators for common patterns
export const createArtistApiHandler = <T = any>() => 
  createProtectedApiHandler<T>({ role: UserRole.ARTIST })

export const createFanApiHandler = <T = any>() => 
  createProtectedApiHandler<T>({ role: UserRole.FAN })

export const createAdminApiHandler = <T = any>() => 
  createProtectedApiHandler<T>({ role: UserRole.ADMIN })

// Error response helpers
export function unauthorizedResponse(message = "Authentication required") {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  )
}

export function forbiddenResponse(message = "Insufficient permissions") {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  )
}

export function badRequestResponse(message = "Bad request", details?: any) {
  return NextResponse.json(
    { error: message, details },
    { status: 400 }
  )
}

export function serverErrorResponse(message = "Internal server error") {
  return NextResponse.json(
    { error: message },
    { status: 500 }
  )
}