import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DiscoveryState,
  DiscoveryAction,
  initialDiscoveryState,
  SearchQuery,
  SearchFilters,
  SearchResults,
  SearchSuggestion,
  ContentType,
  CreatorInfo,
  ContentItem,
  ContentCategory,
  Feed,
  FeedSection,
  TrendingData,
  TrendingPeriod,
  UserPreferences,
  ViewHistoryItem,
  ContentStats,
  FollowAction,
  ContentInteraction,
  UserEngagement,
  DISCOVERY_CONSTANTS,
  defaultSearchFilters,
} from '../types/discovery';
import { useAuth } from './AuthContext';

// Storage keys for persistence
const STORAGE_KEYS = {
  USER_PREFERENCES: '@nahvee_discovery_user_preferences',
  VIEWING_HISTORY: '@nahvee_discovery_viewing_history', 
  SEARCH_HISTORY: '@nahvee_discovery_search_history',
  CONTENT_CACHE: '@nahvee_discovery_content_cache',
  FOLLOWED_CREATORS: '@nahvee_discovery_followed_creators',
  ENGAGEMENT: '@nahvee_discovery_engagement',
  SEARCH_FILTERS: '@nahvee_discovery_search_filters',
} as const;

// Enhanced Discovery reducer function
function discoveryReducer(state: DiscoveryState, action: DiscoveryAction): DiscoveryState {
  switch (action.type) {
    // Feed actions
    case 'SET_FEED':
      return {
        ...state,
        feed: action.payload,
        feedLoading: false,
        feedError: null,
      };

    case 'SET_FEED_LOADING':
      return {
        ...state,
        feedLoading: action.payload,
        ...(action.payload ? { feedError: null } : {}),
      };

    case 'SET_FEED_ERROR':
      return {
        ...state,
        feedError: action.payload,
        feedLoading: false,
      };

    case 'SET_FEED_REFRESHING':
      return {
        ...state,
        feedRefreshing: action.payload,
      };

    case 'APPEND_FEED_SECTION':
      const { sectionId, items } = action.payload;
      if (!state.feed) return state;
      
      return {
        ...state,
        feed: {
          ...state.feed,
          sections: state.feed.sections.map(section =>
            section.id === sectionId
              ? { ...section, items: [...section.items, ...items] }
              : section
          ),
        },
      };

    case 'UPDATE_FEED_SECTION':
      if (!state.feed) return state;
      
      return {
        ...state,
        feed: {
          ...state.feed,
          sections: state.feed.sections.map(section =>
            section.id === action.payload.id ? action.payload : section
          ),
        },
      };

    case 'REFRESH_FEED':
      return {
        ...state,
        feed: null,
        feedRefreshing: true,
        feedError: null,
      };

    // Search actions
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload,
        ...(action.payload === '' ? { searchResults: null } : {}),
      };

    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.payload,
        searchLoading: false,
        searchError: null,
      };

    case 'APPEND_SEARCH_RESULTS':
      if (!state.searchResults) return state;
      
      return {
        ...state,
        searchResults: {
          ...state.searchResults,
          content: [...state.searchResults.content, ...action.payload],
        },
      };

    case 'SET_SEARCH_FILTERS':
      return {
        ...state,
        searchFilters: {
          ...state.searchFilters,
          ...action.payload,
        },
      };

    case 'CLEAR_SEARCH_FILTERS':
      return {
        ...state,
        searchFilters: defaultSearchFilters,
        searchResults: null,
      };

    case 'SET_SEARCH_LOADING':
      return {
        ...state,
        searchLoading: action.payload,
        ...(action.payload ? { searchError: null } : {}),
      };

    case 'SET_SEARCH_ERROR':
      return {
        ...state,
        searchError: action.payload,
        searchLoading: false,
      };

    case 'ADD_TO_SEARCH_HISTORY':
      const query = action.payload.trim();
      if (!query || state.searchHistory.includes(query)) return state;
      
      const newHistory = [query, ...state.searchHistory.slice(0, DISCOVERY_CONSTANTS.MAX_SEARCH_HISTORY - 1)];
      return {
        ...state,
        searchHistory: newHistory,
      };

    case 'CLEAR_SEARCH_HISTORY':
      return {
        ...state,
        searchHistory: [],
      };

    case 'SET_SEARCH_SUGGESTIONS':
      return {
        ...state,
        searchSuggestions: action.payload,
      };

    case 'CLEAR_SEARCH':
      return {
        ...state,
        searchQuery: '',
        searchResults: null,
        searchError: null,
        searchSuggestions: [],
      };

    // Categories actions
    case 'SET_CATEGORIES':
      return {
        ...state,
        categories: action.payload,
        categoriesLoading: false,
      };

    case 'SET_CATEGORIES_LOADING':
      return {
        ...state,
        categoriesLoading: action.payload,
      };

    // Trending actions
    case 'SET_TRENDING_DATA':
      return {
        ...state,
        trending: action.payload,
        trendingLoading: false,
      };

    case 'SET_TRENDING_LOADING':
      return {
        ...state,
        trendingLoading: action.payload,
      };

    // Content actions
    case 'SET_SELECTED_CONTENT':
      return {
        ...state,
        selectedContent: action.payload,
      };

    case 'SET_PLAYING_CONTENT':
      return {
        ...state,
        playingContent: action.payload,
      };

    case 'UPDATE_CONTENT_STATS':
      const { contentId, stats } = action.payload;
      
      // Update in feed
      let updatedFeed = state.feed;
      if (updatedFeed) {
        updatedFeed = {
          ...updatedFeed,
          sections: updatedFeed.sections.map(section => ({
            ...section,
            items: section.items.map(item =>
              item.id === contentId
                ? { ...item, stats: { ...item.stats, ...stats } }
                : item
            ),
          })),
        };
      }
      
      // Update in search results
      let updatedSearchResults = state.searchResults;
      if (updatedSearchResults) {
        updatedSearchResults = {
          ...updatedSearchResults,
          content: updatedSearchResults.content.map(item =>
            item.id === contentId
              ? { ...item, stats: { ...item.stats, ...stats } }
              : item
          ),
        };
      }
      
      // Update in cache
      const updatedCache = { ...state.contentCache };
      if (updatedCache[contentId]) {
        updatedCache[contentId] = {
          ...updatedCache[contentId],
          stats: { ...updatedCache[contentId].stats, ...stats },
        };
      }
      
      return {
        ...state,
        feed: updatedFeed,
        searchResults: updatedSearchResults,
        contentCache: updatedCache,
      };

    // User actions
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
        },
      };

    case 'ADD_TO_VIEWING_HISTORY':
      const newHistoryItem = action.payload;
      const existingItemIndex = state.viewingHistory.items.findIndex(
        item => item.contentId === newHistoryItem.contentId
      );
      
      let updatedHistoryItems;
      if (existingItemIndex >= 0) {
        // Update existing item
        updatedHistoryItems = [...state.viewingHistory.items];
        updatedHistoryItems[existingItemIndex] = newHistoryItem;
      } else {
        // Add new item
        updatedHistoryItems = [newHistoryItem, ...state.viewingHistory.items.slice(0, 999)];
      }
      
      return {
        ...state,
        viewingHistory: {
          ...state.viewingHistory,
          items: updatedHistoryItems,
          totalWatchTime: state.viewingHistory.totalWatchTime + newHistoryItem.duration,
          lastUpdated: new Date().toISOString(),
        },
      };

    case 'CLEAR_VIEWING_HISTORY':
      return {
        ...state,
        viewingHistory: {
          items: [],
          totalWatchTime: 0,
          categories: {},
          creators: {},
          lastUpdated: new Date().toISOString(),
        },
      };

    // Legacy engagement actions - keep for backward compatibility
    case 'FOLLOW_CREATOR':
      return {
        ...state,
        followedCreators: [...state.followedCreators, action.payload],
        preferences: {
          ...state.preferences,
          followedCreators: [...state.preferences.followedCreators, action.payload],
        },
        engagement: {
          ...state.engagement,
          followedCreators: [...state.engagement.followedCreators, action.payload],
        },
      };

    case 'UNFOLLOW_CREATOR':
      return {
        ...state,
        followedCreators: state.followedCreators.filter(id => id !== action.payload),
        preferences: {
          ...state.preferences,
          followedCreators: state.preferences.followedCreators.filter(id => id !== action.payload),
        },
        engagement: {
          ...state.engagement,
          followedCreators: state.engagement.followedCreators.filter(id => id !== action.payload),
        },
      };

    case 'LIKE_CONTENT':
      return {
        ...state,
        engagement: {
          ...state.engagement,
          likedContent: [...state.engagement.likedContent, action.payload],
        },
      };

    case 'UNLIKE_CONTENT':
      return {
        ...state,
        engagement: {
          ...state.engagement,
          likedContent: state.engagement.likedContent.filter(id => id !== action.payload),
        },
      };

    case 'BOOKMARK_CONTENT':
      return {
        ...state,
        engagement: {
          ...state.engagement,
          bookmarkedContent: [...state.engagement.bookmarkedContent, action.payload],
        },
      };

    case 'UNBOOKMARK_CONTENT':
      return {
        ...state,
        engagement: {
          ...state.engagement,
          bookmarkedContent: state.engagement.bookmarkedContent.filter(id => id !== action.payload),
        },
      };

    // Cache actions
    case 'CACHE_CONTENT':
      const { id, content, expiry } = action.payload;
      const expiryTime = expiry || Date.now() + DISCOVERY_CONSTANTS.CACHE_DURATION;
      
      // Remove old items if cache is full
      let newCache = { ...state.contentCache };
      let newExpiry = { ...state.cacheExpiry };
      
      const cacheKeys = Object.keys(newCache);
      if (cacheKeys.length >= DISCOVERY_CONSTANTS.MAX_CACHE_SIZE) {
        // Remove oldest items
        const sortedKeys = cacheKeys.sort((a, b) => newExpiry[a] - newExpiry[b]);
        const keysToRemove = sortedKeys.slice(0, 10); // Remove 10 oldest items
        
        keysToRemove.forEach(key => {
          delete newCache[key];
          delete newExpiry[key];
        });
      }
      
      newCache[id] = content;
      newExpiry[id] = expiryTime;
      
      return {
        ...state,
        contentCache: newCache,
        cacheExpiry: newExpiry,
      };

    case 'CLEAR_CACHE':
      return {
        ...state,
        contentCache: {},
        cacheExpiry: {},
      };

    case 'REMOVE_FROM_CACHE':
      const updatedCacheAfterRemoval = { ...state.contentCache };
      const updatedExpiryAfterRemoval = { ...state.cacheExpiry };
      delete updatedCacheAfterRemoval[action.payload];
      delete updatedExpiryAfterRemoval[action.payload];
      
      return {
        ...state,
        contentCache: updatedCacheAfterRemoval,
        cacheExpiry: updatedExpiryAfterRemoval,
      };

    // UI actions
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.payload,
      };

    case 'TOGGLE_FILTERS':
      return {
        ...state,
        showFilters: !state.showFilters,
      };

    case 'SET_GRID_VIEW':
      return {
        ...state,
        gridView: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    default:
      return state;
  }
}

// Enhanced Context interface
interface DiscoveryContextType extends DiscoveryState {
  // Search functions
  search: (query: SearchQuery) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  clearSearch: () => void;
  
  // Discovery functions
  fetchTrending: () => Promise<void>;
  fetchRecommendedCreators: () => Promise<void>;
  fetchRecommendedContent: () => Promise<void>;
  
  // Feed functions
  fetchFeed: (refresh?: boolean) => Promise<void>;
  loadMoreFeed: () => Promise<void>;
  
  // Enhanced functions
  loadCategories: () => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  addToViewingHistory: (item: ViewHistoryItem) => Promise<void>;
  getCachedContent: (id: string) => ContentItem | null;
  
  // User actions
  followCreator: (creatorId: string) => Promise<void>;
  unfollowCreator: (creatorId: string) => Promise<void>;
  interactWithContent: (interaction: ContentInteraction) => Promise<void>;
  
  // Utility functions
  isCreatorFollowed: (creatorId: string) => boolean;
  isContentLiked: (contentId: string) => boolean;
  isContentBookmarked: (contentId: string) => boolean;
  clearError: () => void;
  
  // Missing functions used by components
  user?: any; // Current user
  getCategoryContent: (categoryId: string) => Promise<void>;
  getTrendingCategories: () => Promise<void>;
  getCuratedCollections: () => Promise<void>;
  getContentById: (contentId: string) => ContentItem | null;
  toggleLike: (contentId: string) => Promise<void>;
  toggleBookmark: (contentId: string) => Promise<void>;
  toggleFollow: (creatorId: string) => Promise<void>;
  purchaseContent: (contentId: string, option: any) => Promise<void>;
  getRelatedContent: (contentId: string) => Promise<void>;
  getCreatorContent: (creatorId: string) => Promise<void>;
  getCategoryById: (categoryId: string) => ContentCategory | null;
  loadMoreCategoryContent: (categoryId: string) => Promise<void>;
  
  // Mock data functions (for development)
  loadMockData: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextType | undefined>(undefined);

export const useDiscovery = (): DiscoveryContextType => {
  const context = useContext(DiscoveryContext);
  if (!context) {
    throw new Error('useDiscovery must be used within a DiscoveryProvider');
  }
  return context;
};

// Storage keys already defined above

export const DiscoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(discoveryReducer, initialDiscoveryState);
  const { user, token } = useAuth();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cacheCleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load cached data on mount
  useEffect(() => {
    loadCachedData();
    loadMockData(); // Remove this when API is ready
  }, []);
  
  // Persist data when it changes
  useEffect(() => {
    if (state.preferences !== initialDiscoveryState.preferences) {
      AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(state.preferences));
    }
  }, [state.preferences]);

  useEffect(() => {
    if (state.viewingHistory.items.length > 0) {
      AsyncStorage.setItem(STORAGE_KEYS.VIEWING_HISTORY, JSON.stringify(state.viewingHistory));
    }
  }, [state.viewingHistory]);

  useEffect(() => {
    if (state.searchHistory.length > 0) {
      AsyncStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(state.searchHistory));
    }
  }, [state.searchHistory]);
  
  // Setup cache cleanup interval
  useEffect(() => {
    const clearExpiredCache = () => {
      const now = Date.now();
      const expiredKeys = Object.keys(state.cacheExpiry).filter(
        key => state.cacheExpiry[key] < now
      );
      
      expiredKeys.forEach(key => {
        dispatch({ type: 'REMOVE_FROM_CACHE', payload: key });
      });
    };
    
    cacheCleanupIntervalRef.current = setInterval(clearExpiredCache, DISCOVERY_CONSTANTS.CACHE_DURATION);

    return () => {
      if (cacheCleanupIntervalRef.current) {
        clearInterval(cacheCleanupIntervalRef.current);
      }
    };
  }, [state.cacheExpiry]);

  const loadCachedData = async () => {
    try {
      const [
        userPreferences,
        viewingHistory, 
        searchHistory,
        followedCreators,
        engagement,
        searchFilters,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES),
        AsyncStorage.getItem(STORAGE_KEYS.VIEWING_HISTORY),
        AsyncStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY),
        AsyncStorage.getItem(STORAGE_KEYS.FOLLOWED_CREATORS),
        AsyncStorage.getItem(STORAGE_KEYS.ENGAGEMENT),
        AsyncStorage.getItem(STORAGE_KEYS.SEARCH_FILTERS),
      ]);

      // Load user preferences
      if (userPreferences) {
        const preferences = JSON.parse(userPreferences);
        dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences });
      }

      // Load viewing history
      if (viewingHistory) {
        const history = JSON.parse(viewingHistory);
        if (history.items && Array.isArray(history.items)) {
          history.items.forEach((item: ViewHistoryItem) => {
            dispatch({ type: 'ADD_TO_VIEWING_HISTORY', payload: item });
          });
        }
      }

      // Load search history
      if (searchHistory) {
        const history = JSON.parse(searchHistory);
        if (Array.isArray(history)) {
          history.forEach((query: string) => {
            dispatch({ type: 'ADD_TO_SEARCH_HISTORY', payload: query });
          });
        }
      }

      // Load followed creators
      if (followedCreators) {
        const followed = JSON.parse(followedCreators);
        if (Array.isArray(followed)) {
          followed.forEach((creatorId: string) => {
            dispatch({ type: 'FOLLOW_CREATOR', payload: creatorId });
          });
        }
      }

      // Load engagement data
      if (engagement) {
        const engagementData = JSON.parse(engagement);
        if (engagementData.likedContent && Array.isArray(engagementData.likedContent)) {
          engagementData.likedContent.forEach((contentId: string) => {
            dispatch({ type: 'LIKE_CONTENT', payload: contentId });
          });
        }
        if (engagementData.bookmarkedContent && Array.isArray(engagementData.bookmarkedContent)) {
          engagementData.bookmarkedContent.forEach((contentId: string) => {
            dispatch({ type: 'BOOKMARK_CONTENT', payload: contentId });
          });
        }
      }

      // Load search filters
      if (searchFilters) {
        const filters = JSON.parse(searchFilters);
        dispatch({ type: 'SET_SEARCH_FILTERS', payload: filters });
      }
    } catch (error) {
      console.error('Error loading cached discovery data:', error);
    }
  };

  const search = useCallback(async (query: SearchQuery) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // TODO: Replace with actual API call
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: data.results });
    } catch (error) {
      console.error('Search error:', error);
      // For development, use mock data
      loadMockSearchResults(query);
    }
  }, [token]);

  const fetchTrending = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // TODO: Replace with actual API call
      const response = await fetch('http://localhost:3000/api/trending', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trending data');
      }

      const data = await response.json();
      dispatch({ type: 'SET_TRENDING_DATA', payload: data.trending });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      console.error('Fetch trending error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch trending content' });
    }
  }, [token]);

  const fetchRecommendedCreators = useCallback(async () => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:3000/api/recommendations/creators?limit=10`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommended creators');
      }

      const data = await response.json();
      dispatch({ type: 'SET_RECOMMENDED_CREATORS', payload: data.creators });
    } catch (error) {
      console.error('Fetch recommended creators error:', error);
    }
  }, [token]);

  const fetchRecommendedContent = useCallback(async () => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:3000/api/recommendations/content?limit=20`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommended content');
      }

      const data = await response.json();
      dispatch({ type: 'SET_RECOMMENDED_CONTENT', payload: data.content });
    } catch (error) {
      console.error('Fetch recommended content error:', error);
    }
  }, [token]);

  const fetchFeed = useCallback(async (refresh = false) => {
    try {
      dispatch({ type: 'SET_FEED_LOADING', payload: true });
      
      const page = refresh ? 1 : state.feedPage;
      
      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:3000/api/feed?page=${page}&limit=20`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feed');
      }

      const data = await response.json();
      
      if (refresh) {
        dispatch({ type: 'SET_FEED', payload: data.feed });
      } else {
        dispatch({ type: 'APPEND_FEED', payload: data.feed });
      }
    } catch (error) {
      console.error('Fetch feed error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch feed' });
    }
  }, [token, state.feedPage]);

  const loadMoreFeed = useCallback(async () => {
    if (!state.feedHasMore || state.isFeedLoading) return;
    await fetchFeed();
  }, [fetchFeed, state.feedHasMore, state.isFeedLoading]);

  const followCreator = useCallback(async (creatorId: string) => {
    try {
      // Optimistic update
      dispatch({ type: 'FOLLOW_CREATOR', payload: creatorId });
      
      // Save to storage
      const updatedFollowed = [...state.followedCreators, creatorId];
      await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWED_CREATORS, JSON.stringify(updatedFollowed));

      // TODO: Replace with actual API call
      const response = await fetch('http://localhost:3000/api/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ creatorId, action: 'follow' }),
      });

      if (!response.ok) {
        // Revert on error
        dispatch({ type: 'UNFOLLOW_CREATOR', payload: creatorId });
        throw new Error('Failed to follow creator');
      }
    } catch (error) {
      console.error('Follow creator error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to follow creator' });
    }
  }, [token, state.followedCreators]);

  const unfollowCreator = useCallback(async (creatorId: string) => {
    try {
      // Optimistic update
      dispatch({ type: 'UNFOLLOW_CREATOR', payload: creatorId });
      
      // Save to storage
      const updatedFollowed = state.followedCreators.filter(id => id !== creatorId);
      await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWED_CREATORS, JSON.stringify(updatedFollowed));

      // TODO: Replace with actual API call
      const response = await fetch('http://localhost:3000/api/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ creatorId, action: 'unfollow' }),
      });

      if (!response.ok) {
        // Revert on error
        dispatch({ type: 'FOLLOW_CREATOR', payload: creatorId });
        throw new Error('Failed to unfollow creator');
      }
    } catch (error) {
      console.error('Unfollow creator error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to unfollow creator' });
    }
  }, [token, state.followedCreators]);

  const interactWithContent = useCallback(async (interaction: ContentInteraction) => {
    try {
      // Optimistic update
      switch (interaction.type) {
        case 'like':
          dispatch({ type: 'LIKE_CONTENT', payload: interaction.contentId });
          break;
        case 'unlike':
          dispatch({ type: 'UNLIKE_CONTENT', payload: interaction.contentId });
          break;
        case 'bookmark':
          dispatch({ type: 'BOOKMARK_CONTENT', payload: interaction.contentId });
          break;
        case 'unbookmark':
          dispatch({ type: 'UNBOOKMARK_CONTENT', payload: interaction.contentId });
          break;
      }

      // TODO: Replace with actual API call
      const response = await fetch('http://localhost:3000/api/content/interact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(interaction),
      });

      if (!response.ok) {
        throw new Error('Failed to interact with content');
      }
    } catch (error) {
      console.error('Content interaction error:', error);
      // Could add revert logic here
    }
  }, [token]);

  // Utility functions
  const setSearchQuery = (query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  };

  const setSearchFilters = (filters: Partial<SearchFilters>) => {
    dispatch({ type: 'SET_SEARCH_FILTERS', payload: filters });
    AsyncStorage.setItem(STORAGE_KEYS.SEARCH_FILTERS, JSON.stringify({ ...state.searchFilters, ...filters }));
  };

  const clearSearch = () => {
    dispatch({ type: 'CLEAR_SEARCH' });
  };

  const isCreatorFollowed = (creatorId: string) => {
    return state.followedCreators.includes(creatorId);
  };

  const isContentLiked = (contentId: string) => {
    return state.engagement.likedContent.includes(contentId);
  };

  const isContentBookmarked = (contentId: string) => {
    return state.engagement.bookmarkedContent.includes(contentId);
  };

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  // Mock data function (remove when API is ready)
  const loadMockData = () => {
    // Import mock data
    const { mockCreators, mockContent, mockTrendingData, mockFeedItems, generateMockCreator, generateMockContent } = require('../data/mockDiscoveryData');
    
    // Generate additional creators and content
    const additionalCreators = Array.from({ length: 10 }, (_, i) => generateMockCreator(i + 6));
    const allCreators = [...mockCreators, ...additionalCreators];
    const additionalContent = Array.from({ length: 15 }, (_, i) => generateMockContent(i + 6, allCreators));
    const allContent = [...mockContent, ...additionalContent];
    
    // Set trending data
    dispatch({ type: 'SET_TRENDING_DATA', payload: mockTrendingData });
    
    // Set recommended creators and content
    dispatch({ type: 'SET_RECOMMENDED_CREATORS', payload: allCreators.slice(0, 8) });
    dispatch({ type: 'SET_RECOMMENDED_CONTENT', payload: allContent.slice(0, 12) });
    
    // Set initial feed
    dispatch({ type: 'SET_FEED', payload: mockFeedItems });
  };

  const loadMockSearchResults = (query: SearchQuery) => {
    const { mockCreators, mockContent, generateSearchResults, generateMockCreator, generateMockContent } = require('../data/mockDiscoveryData');
    
    // Generate additional data for search
    const additionalCreators = Array.from({ length: 10 }, (_, i) => generateMockCreator(i + 6));
    const allCreators = [...mockCreators, ...additionalCreators];
    const additionalContent = Array.from({ length: 15 }, (_, i) => generateMockContent(i + 6, allCreators));
    const allContent = [...mockContent, ...additionalContent];
    
    // Generate search results
    const searchResults = generateSearchResults(query.query || '', allCreators, allContent);
    
    // Apply filters if provided
    let filteredCreators = searchResults.creators;
    let filteredContent = searchResults.content;
    
    if (query.genres && query.genres.length > 0) {
      filteredCreators = filteredCreators.filter(creator => 
        creator.genres.some(genre => query.genres!.includes(genre))
      );
      filteredContent = filteredContent.filter(content => 
        content.genres.some(genre => query.genres!.includes(genre))
      );
    }
    
    if (query.contentTypes && query.contentTypes.length > 0) {
      filteredContent = filteredContent.filter(content => 
        query.contentTypes!.includes(content.type)
      );
    }
    
    const finalResults = {
      creators: filteredCreators,
      content: filteredContent,
      totalCreators: filteredCreators.length,
      totalContent: filteredContent.length,
      hasMore: false,
    };
    
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: finalResults });
    dispatch({ type: 'SET_LOADING', payload: false });
  };

  // Enhanced methods
  const loadFeed = useCallback(async (refresh = false) => {
    if (!refresh && state.feed && state.feedLoading) return;
    dispatch({ type: 'SET_FEED_LOADING', payload: true });
    
    try {
      // Use existing fetchFeed but adapt to new structure
      await fetchFeed(refresh);
    } catch (error) {
      dispatch({ type: 'SET_FEED_ERROR', payload: 'Failed to load feed' });
    }
  }, [state.feed, state.feedLoading, fetchFeed]);
  
  const loadCategories = useCallback(async () => {
    dispatch({ type: 'SET_CATEGORIES_LOADING', payload: true });
    try {
      // Mock categories for now
      const mockCategories = [
        {
          id: 'music',
          name: 'Music',
          slug: 'music',
          description: 'Audio content and music',
          icon: '🎵',
          color: '#FF6B6B',
          contentCount: 1250,
          trending: true,
          order: 1,
        },
      ];
      dispatch({ type: 'SET_CATEGORIES', payload: mockCategories });
    } catch (error) {
      console.error('Failed to load categories');
    }
  }, []);
  
  const updatePreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences });
  }, []);
  
  const addToViewingHistory = useCallback(async (item: ViewHistoryItem) => {
    dispatch({ type: 'ADD_TO_VIEWING_HISTORY', payload: item });
  }, []);
  
  const getCachedContent = useCallback((id: string): ContentItem | null => {
    const content = state.contentCache[id];
    const expiry = state.cacheExpiry[id];
    
    if (!content || !expiry || expiry < Date.now()) {
      if (content) {
        dispatch({ type: 'REMOVE_FROM_CACHE', payload: id });
      }
      return null;
    }
    
    return content;
  }, [state.contentCache, state.cacheExpiry]);

  const value: DiscoveryContextType = {
    ...state,
    search,
    setSearchQuery,
    setSearchFilters,
    clearSearch,
    fetchTrending,
    fetchRecommendedCreators,
    fetchRecommendedContent,
    fetchFeed: loadFeed,
    loadMoreFeed,
    loadCategories,
    updatePreferences,
    addToViewingHistory,
    followCreator,
    unfollowCreator,
    interactWithContent,
    isCreatorFollowed,
    isContentLiked,
    isContentBookmarked,
    getCachedContent,
    clearError,
    loadMockData,
  };

  return (
    <DiscoveryContext.Provider value={value}>
      {children}
    </DiscoveryContext.Provider>
  );
};