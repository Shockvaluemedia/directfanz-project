// Content and Media Types
export type ContentType = 'AUDIO' | 'VIDEO' | 'IMAGE' | 'TEXT' | 'LIVE';
export type ContentVisibility = 'PUBLIC' | 'SUBSCRIBERS_ONLY' | 'PREMIUM';

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: ContentType;
  visibility: ContentVisibility;
  
  // Media URLs
  thumbnailUrl?: string;
  mediaUrl?: string;
  previewUrl?: string; // For samples/previews
  
  // Creator info
  creatorId: string;
  creator: CreatorInfo;
  
  // Metadata
  duration?: number; // in seconds for audio/video
  fileSize?: number; // in bytes
  tags: string[];
  genres: string[];
  
  // Engagement metrics
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  
  // Pricing (for premium content)
  price?: number;
  currency?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  
  // Status
  isPublished: boolean;
  isLiked?: boolean; // Current user's like status
  isPurchased?: boolean; // Current user's purchase status
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
}

// Search and Discovery
export interface SearchQuery {
  query?: string;
  type?: 'creators' | 'content' | 'all';
  genres?: string[];
  contentTypes?: ContentType[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  sortBy?: 'relevance' | 'recent' | 'popular' | 'price_low' | 'price_high';
  location?: string;
  hasSubscriptionTiers?: boolean;
}

export interface SearchFilters {
  genres: string[];
  contentTypes: ContentType[];
  priceRange: {
    min: number;
    max: number;
  };
  location?: string;
  hasSubscriptionTiers?: boolean;
  verifiedOnly: boolean;
}

export interface SearchResults {
  creators: CreatorInfo[];
  content: ContentItem[];
  totalCreators: number;
  totalContent: number;
  hasMore: boolean;
  nextPage?: number;
}

// Feed and Discovery
export interface FeedItem {
  id: string;
  type: 'content' | 'creator_joined' | 'creator_milestone' | 'trending';
  content?: ContentItem;
  creator?: CreatorInfo;
  title?: string;
  description?: string;
  createdAt: string;
}

export interface TrendingData {
  trendingCreators: CreatorInfo[];
  trendingContent: ContentItem[];
  trendingGenres: string[];
  newCreators: CreatorInfo[];
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

// Discovery State Management
export interface DiscoveryState {
  // Search
  searchQuery: string;
  searchFilters: SearchFilters;
  searchResults: SearchResults;
  isSearching: boolean;
  
  // Trending and recommendations
  trendingData: TrendingData | null;
  recommendedCreators: CreatorInfo[];
  recommendedContent: ContentItem[];
  
  // Feed
  feed: FeedItem[];
  feedPage: number;
  isFeedLoading: boolean;
  feedHasMore: boolean;
  
  // User state
  followedCreators: string[];
  engagement: UserEngagement;
  
  // UI state
  error: string | null;
  isLoading: boolean;
}

export type DiscoveryAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_FILTERS'; payload: Partial<SearchFilters> }
  | { type: 'SET_SEARCH_RESULTS'; payload: SearchResults }
  | { type: 'SET_TRENDING_DATA'; payload: TrendingData }
  | { type: 'SET_RECOMMENDED_CREATORS'; payload: CreatorInfo[] }
  | { type: 'SET_RECOMMENDED_CONTENT'; payload: ContentItem[] }
  | { type: 'SET_FEED'; payload: FeedItem[] }
  | { type: 'APPEND_FEED'; payload: FeedItem[] }
  | { type: 'SET_FEED_LOADING'; payload: boolean }
  | { type: 'FOLLOW_CREATOR'; payload: string }
  | { type: 'UNFOLLOW_CREATOR'; payload: string }
  | { type: 'LIKE_CONTENT'; payload: string }
  | { type: 'UNLIKE_CONTENT'; payload: string }
  | { type: 'BOOKMARK_CONTENT'; payload: string }
  | { type: 'UNBOOKMARK_CONTENT'; payload: string }
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