// Database types and interfaces for the Direct-to-Fan Platform

export enum UserRole {
  ARTIST = 'ARTIST',
  FAN = 'FAN'
}

export enum ContentType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT'
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  PAST_DUE = 'PAST_DUE',
  INCOMPLETE = 'INCOMPLETE',
  INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED',
  TRIALING = 'TRIALING',
  UNPAID = 'UNPAID'
}

// Base User interface
export interface User {
  id: string
  email: string
  password?: string | null
  role: UserRole
  displayName: string
  bio?: string | null
  avatar?: string | null
  socialLinks?: Record<string, string> | null
  emailVerified?: Date | null
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

// User profile interface for public display
export interface UserProfile {
  displayName: string
  bio?: string | null
  avatar?: string | null
  socialLinks?: Record<string, string> | null
}

// Artist-specific profile
export interface Artist {
  id: string
  userId: string
  stripeAccountId?: string | null
  isStripeOnboarded: boolean
  totalEarnings: number
  totalSubscribers: number
  createdAt: Date
  updatedAt: Date
}

// Extended Artist interface with user data
export interface ArtistWithUser extends Artist {
  user: User
}

// Subscription tier
export interface Tier {
  id: string
  artistId: string
  name: string
  description: string
  minimumPrice: number
  isActive: boolean
  subscriberCount: number
  createdAt: Date
  updatedAt: Date
}

// Extended Tier interface with artist data
export interface TierWithArtist extends Tier {
  artist: User
}

// Content metadata interface
export interface ContentMetadata {
  fileSize: number
  duration?: number | null
  format: string
  tags: string[]
}

// Content interface
export interface Content {
  id: string
  artistId: string
  title: string
  description?: string | null
  type: ContentType
  fileUrl: string
  thumbnailUrl?: string | null
  isPublic: boolean
  fileSize: number
  duration?: number | null
  format: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// Extended Content interface with relations
export interface ContentWithArtist extends Content {
  artist: User
}

export interface ContentWithTiers extends Content {
  tiers: Tier[]
}

export interface ContentWithAll extends Content {
  artist: User
  tiers: Tier[]
  comments: CommentWithFan[]
}

// Subscription interface
export interface Subscription {
  id: string
  fanId: string
  artistId: string
  tierId: string
  stripeSubscriptionId: string
  amount: number
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
  createdAt: Date
  updatedAt: Date
}

// Extended Subscription interfaces
export interface SubscriptionWithTier extends Subscription {
  tier: Tier
}

export interface SubscriptionWithArtist extends Subscription {
  tier: TierWithArtist
}

export interface SubscriptionWithFan extends Subscription {
  fan: User
}

// Comment interface
export interface Comment {
  id: string
  contentId: string
  fanId: string
  text: string
  createdAt: Date
  updatedAt: Date
}

// Extended Comment interface
export interface CommentWithFan extends Comment {
  fan: User
}

// Analytics interfaces
export interface ArtistAnalytics {
  totalEarnings: number
  totalSubscribers: number
  monthlyEarnings: number
  monthlySubscribers: number
  churnRate: number
  topTiers: Array<{
    tier: Tier
    subscriberCount: number
    revenue: number
  }>
}

export interface SubscriptionAnalytics {
  activeSubscriptions: number
  canceledSubscriptions: number
  pastDueSubscriptions: number
  monthlyRecurringRevenue: number
  averageRevenuePerUser: number
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  timestamp: string
  requestId?: string
}

// Pagination interface
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Search and filter interfaces
export interface ArtistSearchFilters {
  genre?: string
  tags?: string[]
  minPrice?: number
  maxPrice?: number
  sortBy?: 'name' | 'subscribers' | 'created' | 'earnings'
  sortOrder?: 'asc' | 'desc'
}

export interface ContentSearchFilters {
  type?: ContentType
  tags?: string[]
  isPublic?: boolean
  sortBy?: 'title' | 'created' | 'updated'
  sortOrder?: 'asc' | 'desc'
}

// Form data interfaces for API requests
export interface CreateTierData {
  name: string
  description: string
  minimumPrice: number
}

export interface UpdateTierData extends Partial<CreateTierData> {
  isActive?: boolean
}

export interface CreateContentData {
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
}

export interface UpdateContentData extends Partial<CreateContentData> {}

export interface CreateSubscriptionData {
  tierId: string
  amount: number
}

export interface UpdateSubscriptionData {
  amount?: number
}

export interface UpdateUserProfileData {
  displayName?: string
  bio?: string
  avatar?: string
  socialLinks?: Record<string, string>
}

// Stripe-related interfaces
export interface StripeCheckoutData {
  tierId: string
  amount: number
  successUrl: string
  cancelUrl: string
}

export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: any
  }
  created: number
}

// File upload interfaces
export interface FileUploadData {
  file: File
  type: ContentType
  onProgress?: (progress: number) => void
}

export interface PresignedUrlResponse {
  uploadUrl: string
  fileUrl: string
  fields: Record<string, string>
}