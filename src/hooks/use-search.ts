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
  } = useInfiniteQuery<{ results: SearchableContent[]; total: number; hasMore: boolean; page: number }>({
    queryKey: ['search', query, filters],
    queryFn: ({ pageParam = 0 }) => fetchSearchResults(query, filters, pageParam as number),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length : undefined,
    initialPageParam: 0,
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

// API functions — call the backend search endpoint
async function fetchSearchResults(query: string, filters: SearchFilters, page: number) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    ...(filters.types?.length && { types: filters.types.join(',') }),
    ...(filters.categories?.length && { categories: filters.categories.join(',') }),
    ...(filters.sortBy && { sortBy: filters.sortBy }),
  });

  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

async function fetchSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&suggestions=true&limit=6`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions ?? [];
}

async function fetchTrending(category?: string): Promise<TrendingItem[]> {
  const params = new URLSearchParams({ trending: 'true' });
  if (category) params.set('category', category);

  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.trending ?? [];
}

async function fetchRecommendations(userId: string, _preferences?: any): Promise<SearchableContent[]> {
  const res = await fetch(`/api/recommendations?userId=${userId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data.recommendations ?? [];
}

async function fetchFeaturedContent(): Promise<SearchableContent[]> {
  const res = await fetch('/api/search?featured=true&limit=8');
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}