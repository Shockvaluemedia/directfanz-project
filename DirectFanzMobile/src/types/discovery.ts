// Content and Media Types
export type ContentType = 'AUDIO' | 'VIDEO' | 'IMAGE' | 'TEXT' | 'LIVE';
export type ContentVisibility = 'PUBLIC' | 'SUBSCRIBERS_ONLY' | 'PREMIUM';
export type ContentQuality = '240p' | '360p' | '480p' | '720p' | '1080p' | '4K';
export type AudioQuality = '64kbps' | '128kbps' | '192kbps' | '256kbps' | '320kbps';
export type SortOption = 'relevance' | 'recent' | 'newest' | 'oldest' | 'popular' | 'trending' | 'rating' | 'price_low' | 'price_high';
export type FeedSectionType = 'trending' | 'recommended' | 'category' | 'creator' | 'new' | 'popular' | 'featured' | 'personalized';
export type TrendingPeriod = '1h' | '6h' | '24h' | '7d' | '30d';
export type PlaybackState = 'playing' | 'paused' | 'buffering' | 'ended' | 'error';
export type PlaybackQuality = '240p' | '360p' | '480p' | '720p' | '1080p' | '4K' | 'auto';
export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 1.75 | 2.0;

export interface ContentRating {
  average: number; // 0-5 stars
  totalRatings: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface ContentStats {
  views: number;
  likes: number;
  dislikes: number;
  favorites: number;
  shares: number;
  downloads: number;
  comments: number;
  rating: ContentRating;
  engagement: number; // Calculated engagement score
}

export interface ContentMetadata {
  duration?: number; // in seconds for audio/video
  fileSize: number; // in bytes
  dimensions?: {
    width: number;
    height: number;
  };
  aspectRatio?: string; // e.g., "16:9", "9:16", "1:1"
  hasSubtitles?: boolean;
  languages: string[];
  chapters?: ContentChapter[];
  qualityOptions: ContentQuality[] | AudioQuality[];
  album?: string; // For audio content
}

export interface ContentChapter {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  thumbnail?: string;
}

export interface ContentPricing {
  type: 'free' | 'paid' | 'premium' | 'subscription';
  amount?: number;
  currency: string;
  originalPrice?: number; // For discounts
  subscriptionTier?: string;
  previewDuration?: number; // For paid content preview in seconds
}

export interface PurchaseOption {
  id: string;
  name: string;
  title: string; // Alias for name
  price: number;
  currency: string;
  description?: string;
  type: 'one-time' | 'subscription';
  billingCycle?: 'monthly' | 'yearly';
  features: string[];
}

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: ContentType;
  visibility: ContentVisibility;
  category: string;
  
  // Media URLs
  thumbnailUrl?: string;
  mediaUrl?: string;
  previewUrl?: string; // For samples/previews
  urls?: {
    [quality: string]: string; // Quality -> URL mapping
  };
  
  // Creator info
  creatorId: string;
  creator: CreatorInfo;
  
  // Enhanced metadata
  metadata: ContentMetadata;
  tags: string[];
  genres: string[];
  
  // Enhanced stats and engagement
  stats: ContentStats;
  
  // Enhanced pricing
  pricing: ContentPricing;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  
  // Status and flags
  isPublished: boolean;
  isExplicit: boolean;
  ageRating?: string; // PG, PG-13, R, etc.
  isLive?: boolean;
  scheduledDate?: string;
  status: 'published' | 'scheduled' | 'draft' | 'processing';
  
  // Discovery-specific fields
  discoveryScore: number; // Algorithm score for ranking
  trending: boolean;
  featured: boolean;
  isNew: boolean; // Content published in last 7 days
  personalizedScore?: number; // User-specific relevance score
  
  // Current user's relationship
  isLiked?: boolean;
  isPurchased?: boolean;
  isFavorited?: boolean;
  isBookmarked?: boolean;
  watchProgress?: number; // 0-1 (percentage watched)
  
  // Additional properties used by components
  duration?: number; // Duration in seconds
  price?: number; // Price for paid content
  isPremium?: boolean;
  likesCount?: number; // Alias for stats.likes
  viewsCount?: number; // Alias for stats.views
  commentsCount?: number; // Alias for stats.comments
  shareCount?: number; // Alias for stats.shares
  likeCount?: number; // Another alias for stats.likes
  commentCount?: number; // Another alias for stats.comments
  rating?: number; // Alias for stats.rating.average
  subtitle?: string;
  thumbnail?: string; // Alias for thumbnailUrl
  viewCount?: number; // Another alias for stats.views
  purchaseOptions?: PurchaseOption[];
  album?: string; // For audio content
}

export interface CreatorInfo {
  id: string;
  name: string;
  artistName?: string;
  avatar?: string;
  verified: boolean;
  
  // Bio and links
  bio?: string;
  genres: string[];
  location?: string;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
    spotify?: string;
    soundcloud?: string;
  };
  
  // Statistics
  followerCount: number;
  followingCount: number;
  contentCount: number;
  totalViews: number;
  averageRating: number;
  
  // Subscription info
  hasSubscriptionTiers: boolean;
  lowestTierPrice?: number;
  
  // Timestamps
  createdAt: string;
  lastActiveAt?: string;
  
  // Current user's relationship
  isFollowing?: boolean;
  isSubscribed?: boolean;
  subscriptionTier?: string;
  
  // Additional properties used by components
  displayName?: string; // Alias for name or artistName
  avatarUrl?: string; // Alias for avatar
  followersCount?: number; // Alias for followerCount
  isFollowed?: boolean; // Alias for isFollowing
  isVerified?: boolean; // Alias for verified
}

export interface ContentCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  parentId?: string; // For subcategories
  children?: ContentCategory[];
  contentCount: number;
  trending: boolean;
  order: number;
  
  // Additional properties used by components
  creatorCount?: number;
  followersCount?: number;
  thumbnailUrl?: string;
}

// Enhanced Search and Discovery
export interface SearchQuery {
  query?: string;
  type?: 'creators' | 'content' | 'all';
  genres?: string[];
  contentTypes?: ContentType[];
  categories?: string[];
  priceRange?: {
    min?: number;
    max?: number;
    includeFree?: boolean;
  };
  duration?: {
    min: number; // In minutes
    max: number;
  };
  uploadDate?: {
    from?: string;
    to?: string;
    preset?: 'today' | 'week' | 'month' | 'year';
  };
  rating?: {
    min: number; // Minimum rating (0-5)
  };
  tags?: string[];
  creators?: string[];
  languages?: string[];
  sortBy?: SortOption;
  location?: string;
  hasSubscriptionTiers?: boolean;
  isExplicit?: boolean;
  hasPreview?: boolean;
}

export interface SearchFilters {
  genres: string[];
  contentTypes: ContentType[];
  categories: string[];
  priceRange: {
    min: number;
    max: number;
    includeFree: boolean;
  };
  duration: {
    min: number;
    max: number;
  };
  uploadDate?: {
    from?: string;
    to?: string;
    preset?: 'today' | 'week' | 'month' | 'year';
  };
  rating: {
    min: number;
  };
  tags: string[];
  creators: string[];
  languages: string[];
  sortBy?: SortOption;
  location?: string;
  hasSubscriptionTiers?: boolean;
  verifiedOnly: boolean;
  isExplicit?: boolean;
  hasPreview?: boolean;
}

export interface SearchSuggestion {
  query: string;
  type: 'query' | 'category' | 'creator' | 'tag' | 'QUERY' | 'CREATOR' | 'CONTENT' | 'TAG';
  score: number;
  value: string; // Alias for query
  meta?: string; // Additional metadata
  metadata?: {
    categoryId?: string;
    creatorId?: string;
    resultCount?: number;
  };
}

export interface SearchResults {
  creators: CreatorInfo[];
  content: ContentItem[];
  totalCreators: number;
  totalContent: number;
  hasMore: boolean;
  nextPage?: number;
  nextCursor?: string;
  aggregations?: {
    categories: { [key: string]: number };
    creators: { [key: string]: number };
    priceRanges: { [key: string]: number };
    contentTypes: { [key: string]: number };
  };
  searchTime: number; // In milliseconds
  suggestions?: string[];
}

// Enhanced Feed and Discovery
export interface FeedSection {
  id: string;
  title: string;
  description?: string;
  type: FeedSectionType;
  items: ContentItem[];
  hasMore: boolean;
  nextCursor?: string;
  refreshable: boolean;
  priority: number; // For ordering sections
  categoryId?: string; // If type is 'category'
  creatorId?: string; // If type is 'creator'
}

export interface Feed {
  sections: FeedSection[];
  lastUpdated: string;
  hasMore: boolean;
  nextPage?: number;
  personalizedSections?: FeedSection[]; // User-specific sections
}

export interface FeedItem {
  id: string;
  type: 'content' | 'creator_joined' | 'creator_milestone' | 'trending' | 'recommendation';
  content?: ContentItem;
  creator?: CreatorInfo;
  title?: string;
  description?: string;
  createdAt: string;
  priority?: number;
}

export interface TrendingData {
  period: TrendingPeriod;
  trendingCreators: CreatorInfo[];
  trendingContent: ContentItem[];
  trendingGenres: string[];
  newCreators: CreatorInfo[];
  categories: {
    [categoryId: string]: ContentItem[];
  };
  lastUpdated: string;
}

export interface CuratedCollection {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  content: ContentItem[];
  curatorId: string;
  curatorName: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
}

export interface TrendingCategory {
  id: string;
  name: string;
  trendingScore: number;
  growthRate: number;
  contentCount: number;
  period: TrendingPeriod;
}

export interface TrendingSearch {
  query: string;
  searchCount: number;
  trendingScore: number;
  period: TrendingPeriod;
}

export interface UserPreferences {
  favoriteCategories: string[];
  preferredContentTypes: ContentType[];
  preferredDuration: {
    min: number;
    max: number;
  };
  pricePreference: 'free' | 'paid' | 'both';
  explicitContent: boolean;
  autoplay: boolean;
  quality: ContentQuality | AudioQuality;
  followedCreators: string[];
  blockedCreators: string[];
  languages: string[];
}

export interface ViewingHistory {
  items: ViewHistoryItem[];
  totalWatchTime: number; // In seconds
  categories: { [key: string]: number }; // Category -> watch count
  creators: { [key: string]: number }; // Creator -> watch count
  lastUpdated: string;
}

export interface ViewHistoryItem {
  contentId: string;
  watchedAt: string;
  duration: number; // How long watched in seconds
  completed: boolean;
  progress: number; // 0-1 (percentage watched)
  device: string;
  quality: string;
}

// User Interactions
export interface FollowAction {
  creatorId: string;
  action: 'follow' | 'unfollow';
}

export interface ContentInteraction {
  contentId: string;
  type: 'like' | 'unlike' | 'view' | 'share' | 'bookmark' | 'unbookmark';
}

export interface UserEngagement {
  followedCreators: string[];
  likedContent: string[];
  bookmarkedContent: string[];
  purchasedContent: string[];
  viewHistory: {
    contentId: string;
    viewedAt: string;
    progress?: number; // For video/audio progress
  }[];
}

// Enhanced Discovery State Management
export interface DiscoveryState {
  // Feed state
  feed: Feed | null;
  feedLoading: boolean;
  feedError: string | null;
  feedRefreshing: boolean;
  feedPage?: number;
  feedHasMore?: boolean;
  isFeedLoading?: boolean; // Alias for feedLoading
  
  // Search state
  searchQuery: string;
  searchResults: SearchResults | null;
  searchFilters: SearchFilters;
  searchLoading: boolean;
  searchError: string | null;
  searchHistory: string[];
  searchSuggestions: SearchSuggestion[];
  
  // Categories
  categories: ContentCategory[];
  categoriesLoading: boolean;
  
  // Trending
  trending: TrendingData | null;
  trendingLoading: boolean;
  
  // Current content
  selectedContent: ContentItem | null;
  playingContent: ContentItem | null;
  
  // User preferences and history
  preferences: UserPreferences;
  viewingHistory: ViewingHistory;
  
  // Legacy engagement (keep for compatibility)
  followedCreators: string[];
  engagement: UserEngagement;
  
  // Cache
  contentCache: { [id: string]: ContentItem };
  cacheExpiry: { [id: string]: number };
  
  // UI state
  activeTab: 'home' | 'search' | 'categories' | 'trending';
  showFilters: boolean;
  gridView: boolean; // List vs grid view toggle
  error: string | null;
  isLoading: boolean;
}

export type DiscoveryAction =
  // Feed actions
  | { type: 'SET_FEED'; payload: Feed }
  | { type: 'SET_FEED_LOADING'; payload: boolean }
  | { type: 'SET_FEED_ERROR'; payload: string | null }
  | { type: 'SET_FEED_REFRESHING'; payload: boolean }
  | { type: 'APPEND_FEED_SECTION'; payload: { sectionId: string; items: ContentItem[] } }
  | { type: 'UPDATE_FEED_SECTION'; payload: FeedSection }
  | { type: 'REFRESH_FEED' }
  | { type: 'APPEND_FEED'; payload: Feed }
  | { type: 'SET_RECOMMENDED_CREATORS'; payload: CreatorInfo[] }
  | { type: 'SET_RECOMMENDED_CONTENT'; payload: ContentItem[] }
  
  // Search actions
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: SearchResults }
  | { type: 'APPEND_SEARCH_RESULTS'; payload: ContentItem[] }
  | { type: 'SET_SEARCH_FILTERS'; payload: Partial<SearchFilters> }
  | { type: 'CLEAR_SEARCH_FILTERS' }
  | { type: 'SET_SEARCH_LOADING'; payload: boolean }
  | { type: 'SET_SEARCH_ERROR'; payload: string | null }
  | { type: 'ADD_TO_SEARCH_HISTORY'; payload: string }
  | { type: 'CLEAR_SEARCH_HISTORY' }
  | { type: 'SET_SEARCH_SUGGESTIONS'; payload: SearchSuggestion[] }
  
  // Categories actions
  | { type: 'SET_CATEGORIES'; payload: ContentCategory[] }
  | { type: 'SET_CATEGORIES_LOADING'; payload: boolean }
  
  // Trending actions
  | { type: 'SET_TRENDING_DATA'; payload: TrendingData }
  | { type: 'SET_TRENDING_LOADING'; payload: boolean }
  
  // Content actions
  | { type: 'SET_SELECTED_CONTENT'; payload: ContentItem | null }
  | { type: 'SET_PLAYING_CONTENT'; payload: ContentItem | null }
  | { type: 'UPDATE_CONTENT_STATS'; payload: { contentId: string; stats: Partial<ContentStats> } }
  
  // User actions
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<UserPreferences> }
  | { type: 'ADD_TO_VIEWING_HISTORY'; payload: ViewHistoryItem }
  | { type: 'CLEAR_VIEWING_HISTORY' }
  
  // Legacy engagement actions (keep for compatibility)
  | { type: 'FOLLOW_CREATOR'; payload: string }
  | { type: 'UNFOLLOW_CREATOR'; payload: string }
  | { type: 'LIKE_CONTENT'; payload: string }
  | { type: 'UNLIKE_CONTENT'; payload: string }
  | { type: 'BOOKMARK_CONTENT'; payload: string }
  | { type: 'UNBOOKMARK_CONTENT'; payload: string }
  
  // Cache actions
  | { type: 'CACHE_CONTENT'; payload: { id: string; content: ContentItem; expiry?: number } }
  | { type: 'CLEAR_CACHE' }
  | { type: 'REMOVE_FROM_CACHE'; payload: string }
  
  // UI actions
  | { type: 'SET_ACTIVE_TAB'; payload: DiscoveryState['activeTab'] }
  | { type: 'TOGGLE_FILTERS' }
  | { type: 'SET_GRID_VIEW'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_SEARCH' };

// API Response Types
export interface CreatorsResponse {
  success: boolean;
  data: {
    creators: CreatorInfo[];
    total: number;
    page: number;
    hasMore: boolean;
  };
  message?: string;
}

export interface ContentResponse {
  success: boolean;
  data: {
    content: ContentItem[];
    total: number;
    page: number;
    hasMore: boolean;
  };
  message?: string;
}

export interface SearchResponse {
  success: boolean;
  data: SearchResults;
  message?: string;
}

export interface TrendingResponse {
  success: boolean;
  data: TrendingData;
  message?: string;
}

// Popular genres and content types for UI
export const POPULAR_GENRES = [
  'R&B', 'Hip-Hop', 'Pop', 'Soul', 'Jazz', 'Rock', 
  'Electronic', 'Country', 'Gospel', 'Reggae', 'Blues',
  'Alternative', 'Indie', 'Classical', 'Funk', 'Latin'
];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  AUDIO: 'Music',
  VIDEO: 'Videos',
  IMAGE: 'Photos',
  TEXT: 'Posts',
  LIVE: 'Live Streams',
};

export const VISIBILITY_LABELS: Record<ContentVisibility, string> = {
  PUBLIC: 'Public',
  SUBSCRIBERS_ONLY: 'Subscribers Only',
  PREMIUM: 'Premium',
};

// Discovery Constants
export const DISCOVERY_CONSTANTS = {
  // Pagination
  FEED_PAGE_SIZE: 20,
  SEARCH_PAGE_SIZE: 24,
  INFINITE_SCROLL_THRESHOLD: 0.8,
  
  // Cache
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 100,
  
  // Search
  SEARCH_DEBOUNCE_DELAY: 500,
  MIN_SEARCH_QUERY_LENGTH: 2,
  MAX_SEARCH_HISTORY: 20,
  SUGGESTION_LIMIT: 10,
  
  // Content
  PREVIEW_DURATION: 30, // seconds
  TRENDING_UPDATE_INTERVAL: 15 * 60 * 1000, // 15 minutes
  RECOMMENDATION_UPDATE_INTERVAL: 60 * 60 * 1000, // 1 hour
  
  // Rating
  MIN_RATINGS_FOR_AVERAGE: 5,
  RATING_SCALE: 5,
  
  // Discovery scoring
  DISCOVERY_WEIGHTS: {
    views: 0.3,
    likes: 0.2,
    rating: 0.15,
    recency: 0.15,
    engagement: 0.1,
    creator_popularity: 0.1,
  },
  
  // Feed refresh
  FEED_REFRESH_THRESHOLD: 15 * 60 * 1000, // 15 minutes
  PULL_TO_REFRESH_THRESHOLD: 50,
} as const;

// Default Search Filters
export const defaultSearchFilters: SearchFilters = {
  genres: [],
  contentTypes: [],
  categories: [],
  priceRange: {
    min: 0,
    max: 1000,
    includeFree: true,
  },
  duration: {
    min: 0,
    max: 3600, // 1 hour
  },
  rating: {
    min: 0,
  },
  tags: [],
  creators: [],
  languages: ['en'],
  verifiedOnly: false,
};

// Default User Preferences
export const defaultUserPreferences: UserPreferences = {
  favoriteCategories: [],
  preferredContentTypes: ['AUDIO', 'VIDEO'],
  preferredDuration: { min: 0, max: 3600 }, // 0 to 1 hour
  pricePreference: 'both',
  explicitContent: false,
  autoplay: false,
  quality: '720p',
  followedCreators: [],
  blockedCreators: [],
  languages: ['en'],
};

// Initial Discovery State
export const initialDiscoveryState: DiscoveryState = {
  // Feed state
  feed: null,
  feedLoading: false,
  feedError: null,
  feedRefreshing: false,
  
  // Search state
  searchQuery: '',
  searchResults: null,
  searchFilters: defaultSearchFilters,
  searchLoading: false,
  searchError: null,
  searchHistory: [],
  searchSuggestions: [],
  
  // Categories
  categories: [],
  categoriesLoading: false,
  
  // Trending
  trending: null,
  trendingLoading: false,
  
  // Current content
  selectedContent: null,
  playingContent: null,
  
  // User preferences and history
  preferences: defaultUserPreferences,
  viewingHistory: {
    items: [],
    totalWatchTime: 0,
    categories: {},
    creators: {},
    lastUpdated: new Date().toISOString(),
  },
  
  // Legacy engagement (keep for compatibility)
  followedCreators: [],
  engagement: {
    followedCreators: [],
    likedContent: [],
    bookmarkedContent: [],
    purchasedContent: [],
    viewHistory: [],
  },
  
  // Cache
  contentCache: {},
  cacheExpiry: {},
  
  // UI state
  activeTab: 'home',
  showFilters: false,
  gridView: false,
  error: null,
  isLoading: false,
};
