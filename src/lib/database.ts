import { prisma } from './prisma'
import { UserRole, ContentType, SubscriptionStatus } from '@prisma/client'
import type {
  ArtistWithUser,
  TierWithArtist,
  ContentWithArtist,
  ContentWithTiers,
  SubscriptionWithTier,
  PaginatedResponse
} from '../types/database'
import type { User, Artist, Tier, Content, Subscription, Comment } from '@prisma/client'

// User operations
export async function getUserById(id: string) {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      artistProfile: true
    }
  })
}

export async function getUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      artistProfile: true
    }
  })
}

export async function createUser(data: {
  email: string
  password?: string
  role: UserRole
  displayName: string
  bio?: string
  avatar?: string
  socialLinks?: Record<string, string>
}) {
  return await prisma.user.create({
    data: {
      ...data,
      artistProfile: data.role === UserRole.ARTIST ? {
        create: {
          isStripeOnboarded: false,
          totalEarnings: 0,
          totalSubscribers: 0
        }
      } : undefined
    },
    include: {
      artistProfile: true
    }
  })
}

// Artist operations
export async function getArtistById(id: string): Promise<ArtistWithUser | null> {
  const artist = await prisma.user.findUnique({
    where: { 
      id,
      role: UserRole.ARTIST
    },
    include: {
      artistProfile: true
    }
  })

  if (!artist || !artist.artistProfile) return null

  return {
    ...artist.artistProfile,
    totalEarnings: Number(artist.artistProfile.totalEarnings),
    user: artist
  } as ArtistWithUser
}

export async function getArtists(options: {
  page?: number
  limit?: number
  sortBy?: 'name' | 'subscribers' | 'created'
  sortOrder?: 'asc' | 'desc'
} = {}): Promise<PaginatedResponse<ArtistWithUser>> {
  const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = options
  const skip = (page - 1) * limit

  const orderBy = sortBy === 'name' 
    ? { displayName: sortOrder }
    : sortBy === 'subscribers'
    ? { artistProfile: { totalSubscribers: sortOrder } }
    : { createdAt: sortOrder }

  const [artists, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.ARTIST },
      include: { artistProfile: true },
      orderBy,
      skip,
      take: limit
    }),
    prisma.user.count({
      where: { role: UserRole.ARTIST }
    })
  ])

  const data = artists
    .filter(artist => artist.artistProfile)
    .map(artist => ({
      ...artist.artistProfile!,
      totalEarnings: Number(artist.artistProfile!.totalEarnings),
      user: artist
    })) as ArtistWithUser[]

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  }
}

// Tier operations
export async function getTiersByArtistId(artistId: string) {
  const tiers = await prisma.tier.findMany({
    where: { artistId },
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
  
  return tiers.map(tier => ({
    ...tier,
    minimumPrice: Number(tier.minimumPrice),
    subscriberCount: tier._count.subscriptions
  }))
}

export async function getTierById(id: string, artistId?: string) {
  const where = artistId ? { id, artistId } : { id }
  
  const tier = await prisma.tier.findFirst({
    where,
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
  
  if (!tier) return null
  
  return {
    ...tier,
    minimumPrice: Number(tier.minimumPrice),
    subscriberCount: tier._count.subscriptions
  }
}

export async function createTier(data: {
  artistId: string
  name: string
  description: string
  minimumPrice: number
}) {
  // Business rule validations
  await validateTierCreation(data.artistId, data.name, data.minimumPrice)
  
  const tier = await prisma.tier.create({
    data,
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
  
  return {
    ...tier,
    minimumPrice: Number(tier.minimumPrice),
    subscriberCount: tier._count.subscriptions
  }
}

export async function updateTier(id: string, data: {
  name?: string
  description?: string
  minimumPrice?: number
  isActive?: boolean
}) {
  // Get existing tier for validation
  const existingTier = await prisma.tier.findUnique({
    where: { id },
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
  
  if (!existingTier) {
    throw new Error('Tier not found')
  }
  
  // Business rule validations
  if (data.name && data.name !== existingTier.name) {
    await validateTierName(existingTier.artistId, data.name, id)
  }
  
  if (data.minimumPrice && data.minimumPrice !== Number(existingTier.minimumPrice)) {
    await validatePriceChange(id, data.minimumPrice, existingTier._count.subscriptions)
  }
  
  if (data.isActive === false && existingTier._count.subscriptions > 0) {
    throw new Error('Cannot deactivate tier with active subscriptions')
  }
  
  const tier = await prisma.tier.update({
    where: { id },
    data,
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
  
  return {
    ...tier,
    minimumPrice: Number(tier.minimumPrice),
    subscriberCount: tier._count.subscriptions
  }
}

export async function deleteTier(id: string): Promise<void> {
  // Check if tier has active subscriptions
  const subscriptionCount = await prisma.subscription.count({
    where: { 
      tierId: id,
      status: SubscriptionStatus.ACTIVE
    }
  })

  if (subscriptionCount > 0) {
    throw new Error('Cannot delete tier with active subscriptions')
  }

  // Check if tier has associated content
  const contentCount = await prisma.content.count({
    where: {
      tiers: {
        some: { id }
      }
    }
  })

  if (contentCount > 0) {
    throw new Error('Cannot delete tier with associated content. Please reassign content to other tiers first.')
  }

  await prisma.tier.delete({
    where: { id }
  })
}

// Tier validation helper functions
async function validateTierCreation(artistId: string, name: string, minimumPrice: number) {
  // Check tier limit per artist (business rule: max 10 tiers per artist)
  const tierCount = await prisma.tier.count({
    where: { artistId, isActive: true }
  })
  
  if (tierCount >= 10) {
    throw new Error('Maximum of 10 active tiers allowed per artist')
  }
  
  // Check for duplicate tier names
  await validateTierName(artistId, name)
  
  // Validate minimum price constraints
  if (minimumPrice < 1) {
    throw new Error('Minimum price must be at least $1')
  }
  
  if (minimumPrice > 1000) {
    throw new Error('Maximum price is $1000')
  }
}

async function validateTierName(artistId: string, name: string, excludeTierId?: string) {
  const where = excludeTierId 
    ? { artistId, name: { equals: name, mode: 'insensitive' as const }, id: { not: excludeTierId } }
    : { artistId, name: { equals: name, mode: 'insensitive' as const } }
  
  const existingTier = await prisma.tier.findFirst({ where })
  
  if (existingTier) {
    throw new Error('A tier with this name already exists')
  }
}

async function validatePriceChange(tierId: string, newPrice: number, subscriberCount: number) {
  if (subscriberCount > 0) {
    // Get current tier price
    const currentTier = await prisma.tier.findUnique({
      where: { id: tierId },
      select: { minimumPrice: true }
    })
    
    if (currentTier && newPrice > Number(currentTier.minimumPrice) * 1.5) {
      throw new Error('Cannot increase minimum price by more than 50% when tier has active subscribers')
    }
  }
}

// Subscriber count tracking
export async function updateTierSubscriberCount(tierId: string) {
  const activeSubscriptions = await prisma.subscription.count({
    where: {
      tierId,
      status: SubscriptionStatus.ACTIVE
    }
  })
  
  await prisma.tier.update({
    where: { id: tierId },
    data: { subscriberCount: activeSubscriptions }
  })
  
  return activeSubscriptions
}

// Content operations
export async function getContentByArtistId(
  artistId: string,
  options: {
    page?: number
    limit?: number
    type?: ContentType
    isPublic?: boolean
  } = {}
): Promise<PaginatedResponse<ContentWithTiers>> {
  const { page = 1, limit = 20, type, isPublic } = options
  const skip = (page - 1) * limit

  const where = {
    artistId,
    ...(type && { type }),
    ...(isPublic !== undefined && { isPublic })
  }

  const [content, total] = await Promise.all([
    prisma.content.findMany({
      where,
      include: {
        tiers: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.content.count({ where })
  ])

  const transformedContent = content.map(item => ({
    ...item,
    tiers: item.tiers.map(tier => ({
      ...tier,
      minimumPrice: Number(tier.minimumPrice)
    }))
  }))

  return {
    data: transformedContent as ContentWithTiers[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  }
}

export async function createContent(data: {
  artistId: string
  title: string
  description?: string
  type: ContentType
  fileUrl: string
  thumbnailUrl?: string
  isPublic: boolean
  fileSize: number
  duration?: number
  format: string
  tags: string[]
  tierIds: string[]
}): Promise<Content> {
  const { tierIds, ...contentData } = data
  
  return await prisma.content.create({
    data: {
      ...contentData,
      tiers: {
        connect: tierIds.map(id => ({ id }))
      }
    }
  })
}

// Subscription operations
export async function getSubscriptionsByFanId(fanId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { fanId },
    include: {
      tier: {
        include: {
          artist: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  return subscriptions.map(sub => ({
    ...sub,
    amount: Number(sub.amount),
    tier: {
      ...sub.tier,
      minimumPrice: Number(sub.tier.minimumPrice)
    }
  }))
}

export async function getSubscriptionsByArtistId(artistId: string): Promise<Subscription[]> {
  return await prisma.subscription.findMany({
    where: { artistId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createSubscription(data: {
  fanId: string
  artistId: string
  tierId: string
  stripeSubscriptionId: string
  amount: number
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
}): Promise<Subscription> {
  return await prisma.subscription.create({
    data
  })
}

export async function updateSubscription(id: string, data: {
  amount?: number
  status?: SubscriptionStatus
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
}): Promise<Subscription> {
  return await prisma.subscription.update({
    where: { id },
    data
  })
}

// Comment operations
export async function getCommentsByContentId(contentId: string): Promise<Comment[]> {
  return await prisma.comment.findMany({
    where: { contentId },
    include: {
      fan: {
        select: {
          id: true,
          displayName: true,
          avatar: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createComment(data: {
  contentId: string
  fanId: string
  text: string
}): Promise<Comment> {
  return await prisma.comment.create({
    data
  })
}

// Analytics operations
export async function getArtistAnalytics(artistId: string) {
  const [
    totalEarnings,
    totalSubscribers,
    monthlyEarnings,
    monthlySubscribers,
    tierStats
  ] = await Promise.all([
    // Total earnings
    prisma.subscription.aggregate({
      where: { 
        artistId,
        status: SubscriptionStatus.ACTIVE
      },
      _sum: { amount: true }
    }),
    
    // Total subscribers
    prisma.subscription.count({
      where: { 
        artistId,
        status: SubscriptionStatus.ACTIVE
      }
    }),
    
    // Monthly earnings (last 30 days)
    prisma.subscription.aggregate({
      where: { 
        artistId,
        status: SubscriptionStatus.ACTIVE,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      _sum: { amount: true }
    }),
    
    // Monthly subscribers (last 30 days)
    prisma.subscription.count({
      where: { 
        artistId,
        status: SubscriptionStatus.ACTIVE,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    
    // Tier statistics
    prisma.tier.findMany({
      where: { artistId },
      include: {
        _count: {
          select: {
            subscriptions: {
              where: { status: SubscriptionStatus.ACTIVE }
            }
          }
        },
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE },
          select: { amount: true }
        }
      }
    })
  ])

  const topTiers = tierStats.map(tier => ({
    tier,
    subscriberCount: tier._count.subscriptions,
    revenue: tier.subscriptions.reduce((sum, sub) => sum + Number(sub.amount), 0)
  })).sort((a, b) => b.revenue - a.revenue)

  return {
    totalEarnings: Number(totalEarnings._sum.amount || 0),
    totalSubscribers,
    monthlyEarnings: Number(monthlyEarnings._sum.amount || 0),
    monthlySubscribers,
    churnRate: 0, // TODO: Calculate churn rate
    topTiers
  }
}

// Utility functions
export async function checkUserAccess(userId: string, contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { tiers: true }
  })

  if (!content) return false
  if (content.isPublic) return true
  if (content.artistId === userId) return true

  // Check if user has subscription to any of the content's tiers
  const hasAccess = await prisma.subscription.findFirst({
    where: {
      fanId: userId,
      tierId: { in: content.tiers.map(tier => tier.id) },
      status: SubscriptionStatus.ACTIVE
    }
  })

  return !!hasAccess
}