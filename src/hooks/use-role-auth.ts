import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { UserRole } from "@/types/database"

// Hook for role-based authentication
export function useRoleAuth(requiredRole?: UserRole) {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isLoading = status === "loading"
  const isAuthenticated = !!session
  const userRole = session?.user?.role as UserRole
  const hasRequiredRole = !requiredRole || userRole === requiredRole

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.push("/auth/signin")
      return
    }

    if (requiredRole && !hasRequiredRole) {
      // Redirect to appropriate dashboard based on user's actual role
      const redirectPath = userRole === UserRole.ARTIST ? "/dashboard/artist" : "/dashboard/fan"
      router.push(redirectPath)
      return
    }
  }, [isLoading, isAuthenticated, hasRequiredRole, requiredRole, userRole, router])

  return {
    session,
    user: session?.user,
    userRole,
    isLoading,
    isAuthenticated,
    hasRequiredRole,
    isArtist: userRole === UserRole.ARTIST,
    isFan: userRole === UserRole.FAN,
  }
}

// Hook specifically for artist authentication
export function useArtistAuth() {
  return useRoleAuth(UserRole.ARTIST)
}

// Hook specifically for fan authentication
export function useFanAuth() {
  return useRoleAuth(UserRole.FAN)
}

// Hook for checking permissions without redirecting
export function useRoleCheck() {
  const { data: session, status } = useSession()
  
  const isLoading = status === "loading"
  const isAuthenticated = !!session
  const userRole = session?.user?.role as UserRole

  const hasRole = (role: UserRole) => userRole === role
  const isArtist = () => userRole === UserRole.ARTIST
  const isFan = () => userRole === UserRole.FAN

  return {
    session,
    user: session?.user,
    userRole,
    isLoading,
    isAuthenticated,
    hasRole,
    isArtist: isArtist(),
    isFan: isFan(),
    checkRole: hasRole,
  }
}

// Hook for conditional rendering based on role
export function useConditionalRender() {
  const { userRole, isAuthenticated, isLoading } = useRoleCheck()

  const renderForRole = (role: UserRole, component: React.ReactNode) => {
    if (isLoading || !isAuthenticated) return null
    return userRole === role ? component : null
  }

  const renderForArtist = (component: React.ReactNode) => 
    renderForRole(UserRole.ARTIST, component)

  const renderForFan = (component: React.ReactNode) => 
    renderForRole(UserRole.FAN, component)

  const renderForAuthenticated = (component: React.ReactNode) => {
    if (isLoading) return null
    return isAuthenticated ? component : null
  }

  return {
    renderForRole,
    renderForArtist,
    renderForFan,
    renderForAuthenticated,
  }
}