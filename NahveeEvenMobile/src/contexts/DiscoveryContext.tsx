import React, { createContext, useContext, useReducer, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DiscoveryState,
  DiscoveryAction,
  SearchQuery,
  SearchFilters,
  ContentType,
  CreatorInfo,
  ContentItem,
  FollowAction,
  ContentInteraction,
  UserEngagement,
} from '../types/discovery';
import { useAuth } from './AuthContext';

// Initial state
const initialSearchFilters: SearchFilters = {
  genres: [],
  contentTypes: [],
  priceRange: { min: 0, max: 100 },
  verifiedOnly: false,
};

const initialEngagement: UserEngagement = {
  followedCreators: [],
  likedContent: [],
  bookmarkedContent: [],
  purchasedContent: [],
  viewHistory: [],
};

const initialState: DiscoveryState = {
  searchQuery: '',
  searchFilters: initialSearchFilters,
  searchResults: {
    creators: [],
    content: [],
    totalCreators: 0,
    totalContent: 0,
    hasMore: false,
  },
  isSearching: false,
  trendingData: null,
  recommendedCreators: [],
  recommendedContent: [],
  feed: [],
  feedPage: 1,
  isFeedLoading: false,
  feedHasMore: true,
  followedCreators: [],
  engagement: initialEngagement,
  error: null,
  isLoading: false,
};

// Reducer
const discoveryReducer = (state: DiscoveryState, action: DiscoveryAction): DiscoveryState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: null };
    
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    
    case 'SET_SEARCH_FILTERS':
      return {
        ...state,
        searchFilters: { ...state.searchFilters, ...action.payload },
      };
    
    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.payload,
        isSearching: false,
        error: null,
      };
    
    case 'SET_TRENDING_DATA':
      return { ...state, trendingData: action.payload };
    
    case 'SET_RECOMMENDED_CREATORS':
      return { ...state, recommendedCreators: action.payload };
    
    case 'SET_RECOMMENDED_CONTENT':
      return { ...state, recommendedContent: action.payload };
    
    case 'SET_FEED':
      return {
        ...state,
        feed: action.payload,
        isFeedLoading: false,
        feedPage: 1,
      };
    
    case 'APPEND_FEED':
      return {
        ...state,
        feed: [...state.feed, ...action.payload],
        isFeedLoading: false,
        feedPage: state.feedPage + 1,
      };
    
    case 'SET_FEED_LOADING':
      return { ...state, isFeedLoading: action.payload };
    
    case 'FOLLOW_CREATOR':
      return {
        ...state,
        followedCreators: [...state.followedCreators, action.payload],
        engagement: {
          ...state.engagement,
          followedCreators: [...state.engagement.followedCreators, action.payload],
        },
      };
    
    case 'UNFOLLOW_CREATOR':
      return {
        ...state,
        followedCreators: state.followedCreators.filter(id => id !== action.payload),
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
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false, isSearching: false };
    
    case 'CLEAR_SEARCH':
      return {
        ...state,
        searchQuery: '',
        searchResults: initialState.searchResults,
        isSearching: false,
        error: null,
      };
    
    default:
      return state;
  }
};

// Context interface
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
  
  // User actions
  followCreator: (creatorId: string) => Promise<void>;
  unfollowCreator: (creatorId: string) => Promise<void>;
  interactWithContent: (interaction: ContentInteraction) => Promise<void>;
  
  // Utility functions
  isCreatorFollowed: (creatorId: string) => boolean;
  isContentLiked: (contentId: string) => boolean;
  isContentBookmarked: (contentId: string) => boolean;
  clearError: () => void;
  
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

const STORAGE_KEYS = {
  FOLLOWED_CREATORS: '@directfanz_followed_creators',
  ENGAGEMENT: '@directfanz_engagement',
  SEARCH_FILTERS: '@directfanz_search_filters',
};

export const DiscoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(discoveryReducer, initialState);
  const { user, token } = useAuth();

  // Load cached data on mount
  React.useEffect(() => {
    loadCachedData();
    loadMockData(); // Remove this when API is ready
  }, []);

  const loadCachedData = async () => {
    try {
      const [followedCreators, engagement, searchFilters] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.FOLLOWED_CREATORS),
        AsyncStorage.getItem(STORAGE_KEYS.ENGAGEMENT),
        AsyncStorage.getItem(STORAGE_KEYS.SEARCH_FILTERS),
      ]);

      if (followedCreators) {
        const followed = JSON.parse(followedCreators);
        followed.forEach((creatorId: string) => {
          dispatch({ type: 'FOLLOW_CREATOR', payload: creatorId });
        });
      }

      if (engagement) {
        const engagementData = JSON.parse(engagement);
        // Update engagement state
      }

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

  const value: DiscoveryContextType = {
    ...state,
    search,
    setSearchQuery,
    setSearchFilters,
    clearSearch,
    fetchTrending,
    fetchRecommendedCreators,
    fetchRecommendedContent,
    fetchFeed,
    loadMoreFeed,
    followCreator,
    unfollowCreator,
    interactWithContent,
    isCreatorFollowed,
    isContentLiked,
    isContentBookmarked,
    clearError,
    loadMockData,
  };

  return (
    <DiscoveryContext.Provider value={value}>
      {children}
    </DiscoveryContext.Provider>
  );
};