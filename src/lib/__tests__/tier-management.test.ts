import { 
  getTiersByArtistId, 
  getTierById,
  createTier, 
  updateTier, 
  deleteTier,
  updateTierSubscriberCount
} from '../database'
import { prisma } from '../prisma'
import { UserRole, SubscriptionStatus } from '@prisma/client'

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    tier: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    subscription: {
      count: jest.fn(),
    },
    content: {
      count: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as any

describe('Tier Management', () => {
  const mockArtistId = 'artist-123'
  const mockTierId = 'tier-123'
  
  const mockTier = {
    id: mockTierId,
    artistId: mockArtistId,
    name: 'Premium',
    description: 'Premium tier with exclusive content',
    minimumPrice: 10.00,
    isActive: true,
    subscriberCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      subscriptions: 5
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getTiersByArtistId', () => {
    it('should return tiers for an artist with correct subscriber counts', async () => {
      mockPrisma.tier.findMany.mockResolvedValue([mockTier])

      const result = await getTiersByArtistId(mockArtistId)

      expect(mockPrisma.tier.findMany).toHaveBeenCalledWith({
        where: { artistId: mockArtistId },
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE }
              }
            }
          }
        },
        orderBy: { minimumPrice: 'asc' }
      })

      expect(result).toEqual([{
        ...mockTier,
        minimumPrice: 10.00,
        subscriberCount: 5
      }])
    })

    it('should return empty array when artist has no tiers', async () => {
      mockPrisma.tier.findMany.mockResolvedValue([])

      const result = await getTiersByArtistId(mockArtistId)

      expect(result).toEqual([])
    })
  })

  describe('getTierById', () => {
    it('should return tier by id with subscriber count', async () => {
      mockPrisma.tier.findFirst.mockResolvedValue(mockTier)

      const result = await getTierById(mockTierId, mockArtistId)

      expect(mockPrisma.tier.findFirst).toHaveBeenCalledWith({
        where: { id: mockTierId, artistId: mockArtistId },
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE }
              }
            }
          }
        }
      })

      expect(result).toEqual({
        ...mockTier,
        minimumPrice: 10.00,
        subscriberCount: 5
      })
    })

    it('should return null when tier not found', async () => {
      mockPrisma.tier.findFirst.mockResolvedValue(null)

      const result = await getTierById('non-existent-id')

      expect(result).toBeNull()
    })
  })

  describe('createTier', () => {
    const tierData = {
      artistId: mockArtistId,
      name: 'Basic',
      description: 'Basic tier',
      minimumPrice: 5
    }

    it('should create a tier successfully', async () => {
      // Mock validation checks
      mockPrisma.tier.count.mockResolvedValue(2) // Under limit
      mockPrisma.tier.findFirst.mockResolvedValue(null) // No duplicate name
      
      const createdTier = { ...mockTier, ...tierData, _count: { subscriptions: 0 } }
      mockPrisma.tier.create.mockResolvedValue(createdTier)

      const result = await createTier(tierData)

      expect(mockPrisma.tier.create).toHaveBeenCalledWith({
        data: tierData,
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE }
              }
            }
          }
        }
      })

      expect(result).toEqual({
        ...createdTier,
        minimumPrice: 5,
        subscriberCount: 0
      })
    })

    it('should throw error when tier limit exceeded', async () => {
      mockPrisma.tier.count.mockResolvedValue(10) // At limit

      await expect(createTier(tierData)).rejects.toThrow('Maximum of 10 active tiers allowed per artist')
    })

    it('should throw error for duplicate tier name', async () => {
      mockPrisma.tier.count.mockResolvedValue(2)
      mockPrisma.tier.findFirst.mockResolvedValue(mockTier) // Duplicate found

      await expect(createTier(tierData)).rejects.toThrow('A tier with this name already exists')
    })

    it('should throw error for invalid minimum price', async () => {
      const invalidTierData = { ...tierData, minimumPrice: 0 }
      mockPrisma.tier.count.mockResolvedValue(2)
      mockPrisma.tier.findFirst.mockResolvedValue(null)

      await expect(createTier(invalidTierData)).rejects.toThrow('Minimum price must be at least $1')
    })

    it('should throw error for price exceeding maximum', async () => {
      const invalidTierData = { ...tierData, minimumPrice: 1001 }
      mockPrisma.tier.count.mockResolvedValue(2)
      mockPrisma.tier.findFirst.mockResolvedValue(null)

      await expect(createTier(invalidTierData)).rejects.toThrow('Maximum price is $1000')
    })
  })

  describe('updateTier', () => {
    const updateData = {
      name: 'Updated Premium',
      description: 'Updated description',
      minimumPrice: 15
    }

    it('should update tier successfully', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue(mockTier)
      mockPrisma.tier.findFirst.mockResolvedValue(null) // No duplicate name
      
      const updatedTier = { ...mockTier, ...updateData }
      mockPrisma.tier.update.mockResolvedValue(updatedTier)

      const result = await updateTier(mockTierId, updateData)

      expect(mockPrisma.tier.update).toHaveBeenCalledWith({
        where: { id: mockTierId },
        data: updateData,
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE }
              }
            }
          }
        }
      })

      expect(result).toEqual({
        ...updatedTier,
        minimumPrice: 15,
        subscriberCount: 5
      })
    })

    it('should throw error when tier not found', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue(null)

      await expect(updateTier(mockTierId, updateData)).rejects.toThrow('Tier not found')
    })

    it('should throw error for duplicate name', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue(mockTier)
      mockPrisma.tier.findFirst.mockResolvedValue({ ...mockTier, id: 'other-tier' })

      await expect(updateTier(mockTierId, { name: 'Duplicate Name' })).rejects.toThrow('A tier with this name already exists')
    })

    it('should throw error when trying to deactivate tier with subscribers', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue(mockTier)

      await expect(updateTier(mockTierId, { isActive: false })).rejects.toThrow('Cannot deactivate tier with active subscriptions')
    })

    it('should throw error for excessive price increase with subscribers', async () => {
      const tierWithSubscribers = { ...mockTier, minimumPrice: 10, _count: { subscriptions: 5 } }
      mockPrisma.tier.findUnique.mockResolvedValueOnce(tierWithSubscribers)
      mockPrisma.tier.findUnique.mockResolvedValueOnce({ minimumPrice: 10 })

      await expect(updateTier(mockTierId, { minimumPrice: 20 })).rejects.toThrow('Cannot increase minimum price by more than 50% when tier has active subscribers')
    })
  })

  describe('deleteTier', () => {
    it('should delete tier successfully when no active subscriptions or content', async () => {
      mockPrisma.subscription.count.mockResolvedValue(0)
      mockPrisma.content.count.mockResolvedValue(0)
      mockPrisma.tier.delete.mockResolvedValue(mockTier)

      await deleteTier(mockTierId)

      expect(mockPrisma.tier.delete).toHaveBeenCalledWith({
        where: { id: mockTierId }
      })
    })

    it('should throw error when tier has active subscriptions', async () => {
      mockPrisma.subscription.count.mockResolvedValue(5)

      await expect(deleteTier(mockTierId)).rejects.toThrow('Cannot delete tier with active subscriptions')
    })

    it('should throw error when tier has associated content', async () => {
      mockPrisma.subscription.count.mockResolvedValue(0)
      mockPrisma.content.count.mockResolvedValue(3)

      await expect(deleteTier(mockTierId)).rejects.toThrow('Cannot delete tier with associated content. Please reassign content to other tiers first.')
    })
  })

  describe('updateTierSubscriberCount', () => {
    it('should update subscriber count correctly', async () => {
      const newCount = 8
      mockPrisma.subscription.count.mockResolvedValue(newCount)
      mockPrisma.tier.update.mockResolvedValue({ ...mockTier, subscriberCount: newCount })

      const result = await updateTierSubscriberCount(mockTierId)

      expect(mockPrisma.subscription.count).toHaveBeenCalledWith({
        where: {
          tierId: mockTierId,
          status: SubscriptionStatus.ACTIVE
        }
      })

      expect(mockPrisma.tier.update).toHaveBeenCalledWith({
        where: { id: mockTierId },
        data: { subscriberCount: newCount }
      })

      expect(result).toBe(newCount)
    })
  })
})