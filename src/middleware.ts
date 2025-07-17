import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { UserRole } from "@/types/database"
import { getRouteProtection } from "@/lib/rbac"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const pathname = req.nextUrl.pathname
    
    // Public routes that don't require authentication
    const isPublicRoute = 
      pathname === "/" ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/public") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/favicon")

    // Allow public routes
    if (isPublicRoute) {
      return NextResponse.next()
    }

    // Check if route requires authentication
    const routeProtection = getRouteProtection(pathname)
    
    // Redirect to login if not authenticated and trying to access protected routes
    if (!isAuth && (routeProtection || pathname.startsWith("/dashboard") || pathname.startsWith("/api/"))) {
      // For API routes, return 401
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }
      // For page routes, redirect to signin
      return NextResponse.redirect(new URL("/auth/signin", req.url))
    }

    // Role-based access control for authenticated users
    if (isAuth && token && routeProtection) {
      const userRole = token.role as UserRole

      // Check if specific role is required
      if ('role' in routeProtection && routeProtection.role && userRole !== routeProtection.role) {
        // For API routes, return 403
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ 
            error: "Insufficient permissions",
            details: `${routeProtection.role} role required`
          }, { status: 403 })
        }
        
        // For page routes, redirect to appropriate dashboard
        const redirectPath = userRole === UserRole.ARTIST ? "/dashboard/artist" : "/dashboard/fan"
        return NextResponse.redirect(new URL(redirectPath, req.url))
      }
    }

    // Additional role-based redirects for dashboard root
    if (isAuth && token && pathname === "/dashboard") {
      const userRole = token.role as UserRole
      const redirectPath = userRole === UserRole.ARTIST ? "/dashboard/artist" : "/dashboard/fan"
      return NextResponse.redirect(new URL(redirectPath, req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        
        // Allow access to public routes
        if (
          pathname === "/" ||
          pathname.startsWith("/auth") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/public") ||
          pathname.startsWith("/_next") ||
          pathname.startsWith("/favicon")
        ) {
          return true
        }

        // Require authentication for protected routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}