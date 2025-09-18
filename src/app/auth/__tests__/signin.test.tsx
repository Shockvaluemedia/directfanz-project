import { render, screen } from '@testing-library/react'
import { RoleGuard, ArtistGuard, FanGuard } from '@/components/auth/role-guard'
import { UserRole } from '@/types/database'

// Use global mocks
const mockUseRoleAuth = (global as any).__mockUseRoleAuth
const mockPush = (global as any).__mockNavigationPush

describe('Role Guard Components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('RoleGuard', () => {
    it('should show loading component when session is loading', () => {
      mockUseRoleAuth.mockReturnValue({
        session: null,
        user: null,
        userRole: null,
        isLoading: true,
        isAuthenticated: false,
        hasRequiredRole: false,
        isArtist: false,
        isFan: false,
      })

      render(
        <RoleGuard loadingComponent={<div>Loading...</div>}>
          <div>Protected Content</div>
        </RoleGuard>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('should show fallback when user is not authenticated', () => {
      mockUseRoleAuth.mockReturnValue({
        session: null,
        user: null,
        userRole: null,
        isLoading: false,
        isAuthenticated: false,
        hasRequiredRole: false,
        isArtist: false,
        isFan: false,
      })

      render(
        <RoleGuard fallback={<div>Please sign in</div>}>
          <div>Protected Content</div>
        </RoleGuard>
      )

      expect(screen.getByText('Please sign in')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('should show content when user is authenticated and has required role', () => {
      mockUseRoleAuth.mockReturnValue({
        session: {
          user: {
            id: '1',
            email: 'artist@example.com',
            role: UserRole.ARTIST
          }
        },
        user: {
          id: '1',
          email: 'artist@example.com',
          role: UserRole.ARTIST
        },
        userRole: UserRole.ARTIST,
        isLoading: false,
        isAuthenticated: true,
        hasRequiredRole: true,
        isArtist: true,
        isFan: false,
      })

      render(
        <RoleGuard requiredRole={UserRole.ARTIST}>
          <div>Artist Content</div>
        </RoleGuard>
      )

      expect(screen.getByText('Artist Content')).toBeInTheDocument()
    })

    it('should show fallback when user does not have required role', () => {
      mockUseRoleAuth.mockReturnValue({
        session: {
          user: {
            id: '1',
            email: 'fan@example.com',
            role: UserRole.FAN
          }
        },
        user: {
          id: '1',
          email: 'fan@example.com',
          role: UserRole.FAN
        },
        userRole: UserRole.FAN,
        isLoading: false,
        isAuthenticated: true,
        hasRequiredRole: false,
        isArtist: false,
        isFan: true,
      })

      render(
        <RoleGuard 
          requiredRole={UserRole.ARTIST}
          fallback={<div>Access Denied</div>}
        >
          <div>Artist Content</div>
        </RoleGuard>
      )

      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(screen.queryByText('Artist Content')).not.toBeInTheDocument()
    })
  })

  describe('ArtistGuard', () => {
    it('should show content for artist users', () => {
      mockUseRoleAuth.mockReturnValue({
        session: {
          user: {
            id: '1',
            email: 'artist@example.com',
            role: UserRole.ARTIST
          }
        },
        user: {
          id: '1',
          email: 'artist@example.com',
          role: UserRole.ARTIST
        },
        userRole: UserRole.ARTIST,
        isLoading: false,
        isAuthenticated: true,
        hasRequiredRole: true,
        isArtist: true,
        isFan: false,
      })

      render(
        <ArtistGuard>
          <div>Artist Only Content</div>
        </ArtistGuard>
      )

      expect(screen.getByText('Artist Only Content')).toBeInTheDocument()
    })

    it('should not show content for fan users', () => {
      mockUseRoleAuth.mockReturnValue({
        session: {
          user: {
            id: '1',
            email: 'fan@example.com',
            role: UserRole.FAN
          }
        },
        user: {
          id: '1',
          email: 'fan@example.com',
          role: UserRole.FAN
        },
        userRole: UserRole.FAN,
        isLoading: false,
        isAuthenticated: true,
        hasRequiredRole: false,
        isArtist: false,
        isFan: true,
      })

      render(
        <ArtistGuard fallback={<div>Not an artist</div>}>
          <div>Artist Only Content</div>
        </ArtistGuard>
      )

      expect(screen.getByText('Not an artist')).toBeInTheDocument()
      expect(screen.queryByText('Artist Only Content')).not.toBeInTheDocument()
    })
  })

  describe('FanGuard', () => {
    it('should show content for fan users', () => {
      mockUseRoleAuth.mockReturnValue({
        session: {
          user: {
            id: '1',
            email: 'fan@example.com',
            role: UserRole.FAN
          }
        },
        user: {
          id: '1',
          email: 'fan@example.com',
          role: UserRole.FAN
        },
        userRole: UserRole.FAN,
        isLoading: false,
        isAuthenticated: true,
        hasRequiredRole: true,
        isArtist: false,
        isFan: true,
      })

      render(
        <FanGuard>
          <div>Fan Only Content</div>
        </FanGuard>
      )

      expect(screen.getByText('Fan Only Content')).toBeInTheDocument()
    })

    it('should not show content for artist users', () => {
      mockUseRoleAuth.mockReturnValue({
        session: {
          user: {
            id: '1',
            email: 'artist@example.com',
            role: UserRole.ARTIST
          }
        },
        user: {
          id: '1',
          email: 'artist@example.com',
          role: UserRole.ARTIST
        },
        userRole: UserRole.ARTIST,
        isLoading: false,
        isAuthenticated: true,
        hasRequiredRole: false,
        isArtist: true,
        isFan: false,
      })

      render(
        <FanGuard fallback={<div>Not a fan</div>}>
          <div>Fan Only Content</div>
        </FanGuard>
      )

      expect(screen.getByText('Not a fan')).toBeInTheDocument()
      expect(screen.queryByText('Fan Only Content')).not.toBeInTheDocument()
    })
  })
})