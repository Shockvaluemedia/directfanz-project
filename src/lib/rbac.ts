import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { UserRole } from "@/types/database"

// Define permissions for different roles
export const ROLE_PERMISSIONS = {
  ARTIST: [
    // Artist-specific permissions
    'artist:profile:read',
    'artist:profile:write',
    'artist:tiers:create',
    'artist:tiers:read',
    'artist:tiers:update',
    'artist:tiers:delete',
    'artist:content:create',
    'artist:content:read',
    'artist:content:update',
    'artist:content:delete',
    'artist:analytics:read',
    'artist:earnings:read',
    'artist:subscribers:read',
    // General permissions
    'user:profile:read',
    'user:profile:write',
  ],
  FAN: [
    // Fan-specific permissions
    'fan:artists:discover',
    'fan:artists:read',
    'fan:subscriptions:create',
    'fan:subscriptions:read',
    'fan:subscriptions:update',
    'fan:subscriptions:delete',
    'fan:content:read',
    'fan:comments:create',
    'fan:comments:read',
    'fan:comments:update',
    'fan:comments:delete',
    // General permissions
    'user:profile:read',
    'user:profile:write',
  ],
} as const

export type Permission = typeof ROLE_PERMISSIONS[keyof typeof ROLE_PERMISSIONS][number]

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]
  if (!rolePermissions) return false
  return (rolePermissions as readonly string[]).includes(permission)
}

// Check if a role has any of the specified permissions
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission))
}

// Check if a role has all of the specified permissions
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission))
}

// Middleware function to check role-based access
export async function checkRoleAccess(
  request: NextRequest,
  requiredRole?: UserRole,
  requiredPermissions?: Permission[]
): Promise<NextResponse | null> {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const userRole = token.role as UserRole

    // Check if specific role is required
    if (requiredRole && userRole !== requiredRole) {
      return NextResponse.json(
        { 
          error: "Insufficient permissions",
          details: `${requiredRole} role required`
        },
        { status: 403 }
      )
    }

    // Check if specific permissions are required
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasRequiredPermissions = hasAllPermissions(userRole, requiredPermissions)
      
      if (!hasRequiredPermissions) {
        return NextResponse.json(
          { 
            error: "Insufficient permissions",
            details: "Required permissions not met"
          },
          { status: 403 }
        )
      }
    }

    // Access granted
    return null
  } catch (error) {
    console.error("Role access check error:", error)
    return NextResponse.json(
      { error: "Authorization check failed" },
      { status: 500 }
    )
  }
}

// Higher-order function to create role-specific middleware
export function withRoleAuth(
  requiredRole?: UserRole,
  requiredPermissions?: Permission[]
) {
  return async function(request: NextRequest) {
    const accessDenied = await checkRoleAccess(request, requiredRole, requiredPermissions)
    return accessDenied
  }
}

// Specific middleware creators for common use cases
export const withArtistAuth = () => withRoleAuth(UserRole.ARTIST)
export const withFanAuth = () => withRoleAuth(UserRole.FAN)

// Permission-based middleware creators
export const withArtistContentPermissions = () => withRoleAuth(
  undefined,
  ['artist:content:create', 'artist:content:read', 'artist:content:update', 'artist:content:delete']
)

export const withFanSubscriptionPermissions = () => withRoleAuth(
  undefined,
  ['fan:subscriptions:create', 'fan:subscriptions:read', 'fan:subscriptions:update']
)

// Route protection configuration
export const PROTECTED_ROUTES = {
  // Artist-only routes
  '/dashboard/artist': { role: UserRole.ARTIST },
  '/api/artist': { role: UserRole.ARTIST },
  
  // Fan-only routes
  '/dashboard/fan': { role: UserRole.FAN },
  '/api/fan': { role: UserRole.FAN },
  
  // General protected routes (any authenticated user)
  '/dashboard': { authenticated: true },
  '/api/user': { authenticated: true },
} as const

// Check if a route requires specific role or authentication
export function getRouteProtection(pathname: string) {
  // Find the most specific matching route
  const matchingRoutes = Object.entries(PROTECTED_ROUTES)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length) // Sort by specificity (longer paths first)

  return matchingRoutes[0]?.[1] || null
}

// Simplified permission check function for backwards compatibility
export async function checkPermission(userId: string, permission: Permission): Promise<boolean> {
  try {
    // In a real implementation, this would fetch the user's role from database
    // For now, we'll return true as a placeholder
    console.log(`Permission check: ${userId} requesting ${permission}`);
    return true;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}
