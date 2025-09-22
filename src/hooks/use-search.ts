import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

// Types for search
export interface SearchableContent {
  id: string;
  type: 'creator' | 'content' | 'stream' | 'playlist';
  title: string;
  description: string;
  tags: string[];
  category: string;
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string;
  creator?: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    followerCount: number;
  };
  metrics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    rating: number;
  };
  contentType?: 'image' | 'video' | 'audio' | 'document' | 'live';
  duration?: number;
  isLive?: boolean;
  isPremium?: boolean;
  price?: number;
}

export interface SearchFilters {
  types: string[];
  categories: string[];
  tags: string[];
  dateRange: {
    start?: Date;
    end?: Date;
  };
  priceRange: {
    min?: number;
    max?: number;
  };
  creators: string[];
  contentTypes: string[];
  isPremium?: boolean;
  isLive?: boolean;
  minRating?: number;
  sortBy: 'relevance' | 'newest' | 'oldest' | 'popular' | 'rating' | 'price_low' | 'price_high';
  duration?: {
    min?: number;
    max?: number;
  };
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'creator' | 'tag' | 'category';
  count?: number;
  popularity?: number;
}

export interface TrendingItem {
  id: string;
  title: string;
  type: 'query' | 'creator' | 'content' | 'tag';
  trendScore: number;
  change: number; // Percentage change
  thumbnailUrl?: string;
  creator?: string;
}

// Search configuration
const searchConfig = {
  keys: [
    { name: 'title', weight: 0.3 },
    { name: 'description', weight: 0.2 },
    { name: 'tags', weight: 0.2 },
    { name: 'category', weight: 0.1 },
    { name: 'creator.name', weight: 0.2 }
  ],
  includeScore: true,
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2
};

// Main search hook
export function useSearch(initialQuery = '', initialFilters: Partial<SearchFilters> = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({
    types: [],
    categories: [],
    tags: [],
    dateRange: {},
    priceRange: {},
    creators: [],
    contentTypes: [],
    sortBy: 'relevance',
    ...initialFilters
  });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // Fetch search results with infinite scroll support
  const {
    data: searchResults,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['search', query, filters],
    queryFn: ({ pageParam = 0 }) => fetchSearchResults(query, filters, pageParam),
    getNextPageParam: (lastPage, pages) => 
      lastPage.hasMore ? pages.length : undefined,
    enabled: query.length > 0 || Object.values(filters).some(v => 
      Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ''
    ),
  });

  // Memoized flattened results
  const results = useMemo(() => {
    return searchResults?.pages?.flatMap(page => page.results) ?? [];
  }, [searchResults]);

  // Update recent searches
  useEffect(() => {
    if (query && query.length > 2) {
      setRecentSearches(prev => {
        const updated = [query, ...prev.filter(q => q !== query)].slice(0, 10);
        localStorage.setItem('recent-searches', JSON.stringify(updated));
        return updated;
      });
    }
  }, [query]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent-searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      types: [],
      categories: [],
      tags: [],
      dateRange: {},
      priceRange: {},
      creators: [],
      contentTypes: [],
      sortBy: 'relevance'
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent-searches');
  };

  return {
    query,
    setQuery,
    filters,
    updateFilters,
    clearFilters,
    results,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    recentSearches,
    clearRecentSearches,
    totalResults: searchResults?.pages?.[0]?.total ?? 0
  };
}

// Search suggestions hook
export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ['search-suggestions', query],
    queryFn: () => fetchSearchSuggestions(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Trending content hook
export function useTrending(category?: string) {
  return useQuery({
    queryKey: ['trending', category],
    queryFn: () => fetchTrending(category),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Recommended content hook
export function useRecommendations(userId: string, preferences?: any) {
  return useQuery({
    queryKey: ['recommendations', userId, preferences],
    queryFn: () => fetchRecommendations(userId, preferences),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Featured content hook
export function useFeaturedContent() {
  return useQuery({
    queryKey: ['featured-content'],
    queryFn: fetchFeaturedContent,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

// Local search using Fuse.js for instant results
export function useLocalSearch(data: SearchableContent[], query: string) {
  const fuse = useMemo(() => new Fuse(data, searchConfig), [data]);
  
  return useMemo(() => {
    if (!query || query.length < 2) return data;
    
    const results = fuse.search(query);
    return results.map(result => ({
      ...result.item,
      score: result.score
    }));
  }, [fuse, query, data]);
}

// API functions (these would connect to your backend)
async function fetchSearchResults(query: string, filters: SearchFilters, page: number) {
  // In a real app, this would be an API call
  const mockData = generateMockSearchResults(query, filters, page);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return mockData;
}

async function fetchSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  // Mock suggestions
  const suggestions: SearchSuggestion[] = [
    { text: `${query} tutorial`, type: 'query', count: 156 },
    { text: `${query} live`, type: 'query', count: 89 },
    { text: `${query} premium`, type: 'query', count: 67 },
    { text: `best ${query}`, type: 'query', count: 234 },
  ];
  
  // Add creator suggestions
  if (query.length >= 3) {
    suggestions.push(
      { text: `${query} creator`, type: 'creator', count: 45 },
      { text: `${query} artist`, type: 'creator', count: 32 }
    );
  }
  
  return suggestions;
}

async function fetchTrending(category?: string): Promise<TrendingItem[]> {
  // Mock trending data
  return [
    {
      id: '1',
      title: 'Music Production',
      type: 'query',
      trendScore: 95,
      change: 15.3
    },
    {
      id: '2',
      title: 'Sarah Johnson',
      type: 'creator',
      trendScore: 88,
      change: 23.7,
      thumbnailUrl: 'https://picsum.photos/100/100?random=1'
    },
    {
      id: '3',
      title: 'Fitness Challenge',
      type: 'content',
      trendScore: 82,
      change: -5.2,
      creator: 'FitPro Mike'
    },
    {
      id: '4',
      title: '#WorkoutMotivation',
      type: 'tag',
      trendScore: 76,
      change: 8.9
    }
  ];
}

async function fetchRecommendations(userId: string, preferences?: any): Promise<SearchableContent[]> {
  // Mock recommendations based on user preferences
  return generateMockContent(10, 'recommended');
}

async function fetchFeaturedContent(): Promise<SearchableContent[]> {
  // Mock featured content
  return generateMockContent(8, 'featured');
}

// Mock data generator
function generateMockSearchResults(query: string, filters: SearchFilters, page: number) {
  const pageSize = 20;
  const totalResults = 150;
  const hasMore = (page + 1) * pageSize < totalResults;
  
  const results = generateMockContent(pageSize, 'search', query);
  
  return {
    results,
    total: totalResults,
    hasMore,
    page
  };
}

function generateMockContent(count: number, context: 'search' | 'recommended' | 'featured', query?: string): SearchableContent[] {
  const categories = ['Music', 'Art', 'Fitness', 'Gaming', 'Education', 'Comedy', 'Fashion', 'Cooking'];
  const contentTypes = ['image', 'video', 'audio', 'document'] as const;
  const creators = [
    'Sarah Johnson', 'Mike Chen', 'Emma Williams', 'David Brown', 'Lisa Garcia',
    'Alex Thompson', 'Maya Patel', 'Chris Wilson', 'Ashley Davis', 'Ryan Martinez'
  ];

  return Array.from({ length: count }, (_, i) => {
    const creator = creators[i % creators.length];
    const category = categories[i % categories.length];
    const contentType = contentTypes[i % contentTypes.length];
    const isPremium = Math.random() > 0.7;
    const isLive = Math.random() > 0.9;

    return {
      id: `${context}-${i}`,
      type: Math.random() > 0.8 ? 'creator' : 'content',
      title: query ? `${query} - ${category} Content ${i + 1}` : `${category} Content ${i + 1}`,
      description: `Amazing ${category.toLowerCase()} content created by ${creator}. This is a detailed description of the content.`,
      tags: [`${category.toLowerCase()}`, 'tutorial', 'premium', 'popular'],
      category,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      thumbnailUrl: `https://picsum.photos/400/300?random=${i}`,
      creator: {
        id: `creator-${i}`,
        name: creator,
        avatar: `https://picsum.photos/100/100?random=${i + 100}`,
        verified: Math.random() > 0.6,
        followerCount: Math.floor(Math.random() * 10000) + 100
      },
      metrics: {
        views: Math.floor(Math.random() * 50000) + 100,
        likes: Math.floor(Math.random() * 5000) + 10,
        comments: Math.floor(Math.random() * 1000) + 5,
        shares: Math.floor(Math.random() * 500) + 1,
        rating: 3 + Math.random() * 2
      },
      contentType,
      duration: contentType === 'video' || contentType === 'audio' ? Math.floor(Math.random() * 3600) + 60 : undefined,
      isLive,
      isPremium,
      price: isPremium ? Math.floor(Math.random() * 50) + 5 : undefined
    };
  });
}