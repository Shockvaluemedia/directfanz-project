import { 
  checkContentAccess, 
  generateAccessToken, 
  verifyAccessToken,
  getUserAccessibleContent,
  checkTierAccess,
  getContentAccessSummary
} from '../content-access'
import { prisma } from '../prisma'
import { UserRole, ContentType, SubscriptionStatus } from '@/types/database'

// Mock prisma
jest.mock('../prisma', () => ({
  prisma: {
    content: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    subscription: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    },
    tier: {
      findMany: jest.fn()
    }
  }
}))

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({
    userId: 'user-1',
    contentId: 'content-1',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  }))
}))

describe('Content Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkContentAccess', () => {
    it('should allow access to public content', async () => {
      const mockContent = {
        id: 'content-1',
        artistId: 'artist-1',
        isPublic: true,
        tiers: [],
        artist: { id: 'artist-1', role: UserRole.ARTIST }
      }

      ;(prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any)

      const result = await checkContentAccess('user-1', 'content-1')

      expect(result.hasAccess).toBe(true)
      expect(result.reason).toBe('public')
    })

    it('should allow content owner access', async () => {
      const mockContent = {
        id: 'content-1',
        artistId: 'user-1',
        isPublic: false,
        tiers: [{ id: 'tier-1', minimumPrice: 10, isActive: true }],
        artist: { id: 'user-1', role: UserRole.ARTIST }
      }

      ;(prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any)

      const result = await checkContentAccess('user-1', 'content-1')

      expect(result.hasAccess).toBe(true)
      expect(result.reason).toBe('owner')
    })

    it('should deny access when content not found', async () => {
      ;(prisma.content.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await checkContentAccess('user-1', 'content-1')

      expect(result.hasAccess).toBe(false)
      expect(result.reason).toBe('not_found')
    })

    it('should allow access with valid subscription', async () => {
      const mockContent = {
        id: 'content-1',
        artistId: 'artist-1',
        isPublic: false,
        tiers: [{ id: 'tier-1', minimumPrice: 10, isActive: true }],
        artist: { id: 'artist-1', role: UserRole.ARTIST }
      }

      const mockSubscriptions = [{
        id: 'sub-1',
        fanId: 'user-1',
        artistId: 'artist-1',
        tierId: 'tier-1',
        amount: 15,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000), // Tomorrow
        tier: { id: 'tier-1', minimumPrice: 10, isActive: true }
      }]

      ;(prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any)
      ;(prisma.subscription.findMany as jest.Mock).mockResolvedValue(mockSubscriptions as any)

      const result = await checkContentAccess('user-1', 'content-1')

      expect(result.hasAccess).toBe(true)
      expect(result.reason).toBe('subscription')
      expect(result.subscription).toEqual({
        id: 'sub-1',
        tierId: 'tier-1',
        amount: 15,
        status: SubscriptionStatus.ACTIVE
      })
    })

    it('should deny access without valid subscription', async () => {
      const mockContent = {
        id: 'content-1',
        artistId: 'artist-1',
        isPublic: false,
        tiers: [{ id: 'tier-1', minimumPrice: 10, isActive: true }],
        artist: { id: 'artist-1', role: UserRole.ARTIST }
      }

      ;(prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any)
      ;(prisma.subscription.findMany as jest.Mock).mockResolvedValue([])

      const result = await checkContentAccess('user-1', 'content-1')

      expect(result.hasAccess).toBe(false)
      expect(result.reason).toBe('no_subscription')
    })

    it('should deny access to content with no tiers assigned', async () => {
      const mockContent = {
        id: 'content-1',
        artistId: 'artist-1',
        isPublic: false,
        tiers: [],
        artist: { id: 'artist-1', role: UserRole.ARTIST }
      }

      ;(prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any)

      const result = await checkContentAccess('user-1', 'content-1')

      expect(result.hasAccess).toBe(false)
      expect(result.reason).toBe('no_subscription')
    })

    it('should deny access to inactive tier content', async () => {
      const mockContent = {
        id: 'content-1',
        artistId: 'artist-1',
        isPublic: false,
        tiers: [{ id: 'tier-1', minimumPrice: 10, isActive: false }],
        artist: { id: 'artist-1', role: UserRole.ARTIST }
      }

      const mockSubscriptions = [{
        id: 'sub-1',
        fanId: 'user-1',
        artistId: 'artist-1',
        tierId: 'tier-1',
        amount: 15,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000),
        tier: { id: 'tier-1', minimumPrice: 10, isActive: false }
      }]

      ;(prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent as any)
      ;(prisma.subscription.findMany as jest.Mock).mockResolvedValue(mockSubscriptions as any)

      const result = await checkContentAccess('user-1', 'content-1')

      expect(result.hasAccess).toBe(false)
      expect(result.reason).toBe('no_subscription')
    })
  })

  describe('generateAccessToken and verifyAccessToken', () => {
    it('should generate and verify access tokens', () => {
      const token = generateAccessToken('user-1', 'content-1')
      expect(token).toBe('mock-jwt-token')

      const verified = verifyAccessToken(token)
      expect(verified).toEqual({
        userId: 'user-1',
        contentId: 'content-1',
        iat: expect.any(Number),
        exp: expect.any(Number)
      })
    })
  })

  describe('getUserAccessibleContent', () => {
    it('should return accessible content for user', async () => {
      const mockSubscriptions = [{
        tierId: 'tier-1'
      }]

      const mockContent = [{
        id: 'content-1',
        title: 'Test Content',
        type: ContentType.AUDIO,
        isPublic: false,
        tiers: [{ id: 'tier-1', name: 'Basic', minimumPrice: 10 }],
        artist: { id: 'artist-1', displayName: 'Test Artist', avatar: null }
      }]

      ;(prisma.subscription.findMany as jest.Mock).mockResolvedValue(mockSubscriptions as any)
      ;(prisma.content.findMany as jest.Mock).mockResolvedValue(mockContent as any)
      ;(prisma.content.count as jest.Mock).mockResolvedValue(1)

      const result = await getUserAccessibleContent('user-1', 'artist-1')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].id).toBe('content-1')
      expect(result.pagination.total).toBe(1)
    })

    it('should handle pagination correctly', async () => {
      ;(prisma.subscription.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.content.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.content.count as jest.Mock).mockResolvedValue(0)

      const result = await getUserAccessibleContent('user-1', 'artist-1', {
        page: 2,
        limit: 10
      })

      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(10)
    })
  })

  describe('checkTierAccess', () => {
    it('should return true for active subscription', async () => {
      const mockSubscription = {
        id: 'sub-1',
        fanId: 'user-1',
        tierId: 'tier-1',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000)
      }

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription as any)

      const result = await checkTierAccess('user-1', 'tier-1')
      expect(result).toBe(true)
    })

    it('should return false for no subscription', async () => {
      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await checkTierAccess('user-1', 'tier-1')
      expect(result).toBe(false)
    })
  })

  describe('getContentAccessSummary', () => {
    it('should return content access summary', async () => {
      const mockSubscriptions = [{
        tierId: 'tier-1',
        tier: { id: 'tier-1', name: 'Basic' }
      }]

      ;(prisma.content.count as jest.Mock)
        .mockResolvedValueOnce(10) // total content
        .mockResolvedValueOnce(3)  // public content
        .mockResolvedValueOnce(2)  // accessible gated content
        .mockResolvedValueOnce(5)  // tier content count

      ;(prisma.subscription.findMany as jest.Mock).mockResolvedValue(mockSubscriptions as any)

      const result = await getContentAccessSummary('user-1', 'artist-1')

      expect(result.totalContent).toBe(10)
      expect(result.publicContent).toBe(3)
      expect(result.accessibleContent).toBe(5) // 3 public + 2 gated
      expect(result.gatedContent).toBe(7) // 10 total - 3 public
      expect(result.subscriptions).toHaveLength(1)
    })
  })
})