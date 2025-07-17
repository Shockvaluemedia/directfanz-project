import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleGuard, ArtistGuard, FanGuard } from '@/components/auth/role-guard'
import { UserRole } from '@/types/database'

// Mock next-auth
jest.mock('next-auth/react')
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Mock next/navigation
jest.mock('next/navigation')
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockPush = jest.fn()

describe('Role Guard Components', () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      push: mockPush,
    } as any)
    mockPush.mockClear()
  })

  describe('RoleGuard', () => {
    it('should show loading component when session is loading', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading'
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
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated'
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
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'artist@example.com',
            role: UserRole.ARTIST
          }
        },
        status: 'authenticated'
      })

      render(
        <RoleGuard requiredRole={UserRole.ARTIST}>
          <div>Artist Content</div>
        </RoleGuard>
      )

      expect(screen.getByText('Artist Content')).toBeInTheDocument()
    })

    it('should show fallback when user does not have required role', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'fan@example.com',
            role: UserRole.FAN
          }
        },
        status: 'authenticated'
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
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'artist@example.com',
            role: UserRole.ARTIST
          }
        },
        status: 'authenticated'
      })

      render(
        <ArtistGuard>
          <div>Artist Only Content</div>
        </ArtistGuard>
      )

      expect(screen.getByText('Artist Only Content')).toBeInTheDocument()
    })

    it('should not show content for fan users', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'fan@example.com',
            role: UserRole.FAN
          }
        },
        status: 'authenticated'
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
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'fan@example.com',
            role: UserRole.FAN
          }
        },
        status: 'authenticated'
      })

      render(
        <FanGuard>
          <div>Fan Only Content</div>
        </FanGuard>
      )

      expect(screen.getByText('Fan Only Content')).toBeInTheDocument()
    })

    it('should not show content for artist users', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'artist@example.com',
            role: UserRole.ARTIST
          }
        },
        status: 'authenticated'
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