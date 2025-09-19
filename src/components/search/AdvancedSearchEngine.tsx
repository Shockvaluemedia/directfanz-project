'use client';

/**
 * Advanced Search & Discovery Engine
 *
 * This component provides intelligent search and content discovery with:
 * - AI-powered semantic search across content types
 * - Advanced filtering with faceted search
 * - Real-time search suggestions and autocomplete
 * - Personalized recommendations based on user behavior
 * - Trending content analysis and discovery
 * - Genre-based and mood-based content discovery
 * - Search analytics and user intent understanding
 * - Voice search integration
 * - Visual similarity search for media
 * - Collaborative filtering recommendations
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon,
  FireIcon,
  ClockIcon,
  StarIcon,
  UserIcon,
  MusicalNoteIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  TagIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  HeartIcon,
  PlayIcon,
  EyeIcon,
  CalendarIcon,
  MapPinIcon,
  MicrophoneIcon,
  XMarkIcon,
  ChevronDownIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  BookmarkIcon,
  ShareIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
  HeartIcon as HeartIconSolid,
  StarIcon as StarIconSolid,
  BookmarkIcon as BookmarkIconSolid,
} from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Types
interface SearchResult {
  id: string;
  type: 'track' | 'artist' | 'album' | 'playlist' | 'stream' | 'user' | 'post';
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  url: string;
  score: number;
  metadata: {
    duration?: number;
    genre?: string;
    releaseDate?: Date;
    playCount?: number;
    likes?: number;
    views?: number;
    followers?: number;
    tags?: string[];
    isVerified?: boolean;
    isLive?: boolean;
  };
  highlights?: {
    title?: string;
    description?: string;
    lyrics?: string;
  };
}

interface SearchFilters {
  type: string[];
  genre: string[];
  dateRange: {
    start?: Date;
    end?: Date;
  };
  duration: {
    min?: number;
    max?: number;
  };
  popularity: {
    min?: number;
    max?: number;
  };
  location?: string;
  verified?: boolean;
  live?: boolean;
  tags: string[];
  sortBy: 'relevance' | 'date' | 'popularity' | 'duration' | 'alphabetical';
  sortOrder: 'asc' | 'desc';
}

interface Recommendation {
  id: string;
  type: 'track' | 'artist' | 'playlist' | 'stream';
  item: SearchResult;
  reason: string;
  confidence: number;
  category: 'trending' | 'similar' | 'collaborative' | 'mood' | 'activity' | 'discovery';
}

interface TrendingItem {
  item: SearchResult;
  trendScore: number;
  velocity: number;
  category: string;
  timeframe: '1h' | '24h' | '7d' | '30d';
}

interface SearchSuggestion {
  query: string;
  type: 'completion' | 'correction' | 'trending';
  category?: string;
  count?: number;
}

interface UserPreferences {
  genres: string[];
  moods: string[];
  activities: string[];
  artists: string[];
  languages: string[];
  explicitContent: boolean;
  regionalPreference: string;
}

export default function AdvancedSearchEngine() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<'standard' | 'semantic' | 'visual' | 'voice'>(
    'standard'
  );
  const [activeTab, setActiveTab] = useState<'results' | 'recommendations' | 'trending'>('results');

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    type: [],
    genre: [],
    dateRange: {},
    duration: {},
    popularity: {},
    tags: [],
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  // UI state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Constants
  const contentTypes = [
    'all',
    'tracks',
    'artists',
    'albums',
    'playlists',
    'streams',
    'users',
    'posts',
  ];
  const genres = [
    'Pop',
    'Rock',
    'Hip Hop',
    'Electronic',
    'Jazz',
    'Classical',
    'R&B',
    'Country',
    'Reggae',
    'Folk',
  ];
  const moods = [
    'Happy',
    'Chill',
    'Energetic',
    'Sad',
    'Focus',
    'Party',
    'Romantic',
    'Aggressive',
    'Peaceful',
  ];
  const activities = [
    'Workout',
    'Study',
    'Sleep',
    'Driving',
    'Cooking',
    'Running',
    'Meditation',
    'Gaming',
  ];

  // Load initial data
  useEffect(() => {
    loadTrendingContent();
    if (session?.user) {
      loadPersonalizedRecommendations();
    }
  }, [session?.user]);

  // Handle search input changes
  useEffect(() => {
    if (searchQuery.trim()) {
      // Debounced search suggestions
      if (suggestionTimeout.current) {
        clearTimeout(suggestionTimeout.current);
      }

      suggestionTimeout.current = setTimeout(() => {
        loadSearchSuggestions(searchQuery);
      }, 300);

      // Debounced search execution
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      searchTimeout.current = setTimeout(() => {
        executeSearch();
      }, 500);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      if (!hasSearched) {
        setSearchResults([]);
      }
    }

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (suggestionTimeout.current) clearTimeout(suggestionTimeout.current);
    };
  }, [searchQuery, filters]);

  // Search functions
  const executeSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setShowSuggestions(false);

    try {
      const searchParams = {
        query: searchQuery,
        mode: searchMode,
        filters,
        limit: 50,
        userId: session?.user?.id,
      };

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams),
      });

      const data = await response.json();

      if (data.success) {
        setSearchResults(data.results || []);
        setHasSearched(true);
        setActiveTab('results');

        // Track search analytics
        trackSearchEvent(searchQuery, searchMode, data.results?.length || 0);
      } else {
        toast.error('Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchMode, filters, session?.user?.id]);

  const loadSearchSuggestions = useCallback(async (query: string) => {
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success) {
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Suggestions error:', error);
    }
  }, []);

  const loadPersonalizedRecommendations = useCallback(async () => {
    try {
      const response = await fetch('/api/recommendations/personalized');
      const data = await response.json();

      if (data.success) {
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Recommendations error:', error);
    }
  }, []);

  const loadTrendingContent = useCallback(async () => {
    try {
      const response = await fetch('/api/search/trending');
      const data = await response.json();

      if (data.success) {
        setTrending(data.trending || []);
      }
    } catch (error) {
      console.error('Trending error:', error);
    }
  }, []);

  // Voice search
  const startVoiceSearch = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setSearchMode('voice');
        toast.success('Voice search started - speak now!');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setSearchMode('standard');
      };

      recognition.onerror = () => {
        toast.error('Voice search failed');
        setSearchMode('standard');
      };

      recognition.start();
    } else {
      toast.error('Voice search not supported in this browser');
    }
  }, []);

  // Analytics
  const trackSearchEvent = async (query: string, mode: string, resultsCount: number) => {
    try {
      await fetch('/api/analytics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          mode,
          resultsCount,
          filters,
          timestamp: new Date(),
        }),
      });
    } catch (error) {
      console.error('Analytics error:', error);
    }
  };

  // Filter functions
  const updateFilter = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      type: [],
      genre: [],
      dateRange: {},
      duration: {},
      popularity: {},
      tags: [],
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
  }, []);

  // Content interaction
  const handleItemClick = useCallback(
    (result: SearchResult) => {
      // Track click for analytics
      fetch('/api/analytics/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: result.id,
          itemType: result.type,
          query: searchQuery,
          position: searchResults.indexOf(result),
        }),
      }).catch(console.error);

      // Navigate to item
      router.push(result.url);
    },
    [searchResults, searchQuery, router]
  );

  const toggleLike = useCallback(async (result: SearchResult) => {
    try {
      const response = await fetch(`/api/${result.type}/${result.id}/like`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // Update result in state
        setSearchResults(prev =>
          prev.map(item =>
            item.id === result.id
              ? { ...item, metadata: { ...item.metadata, likes: data.likes } }
              : item
          )
        );
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  }, []);

  // Filtered results
  const filteredResults = useMemo(() => {
    let filtered = searchResults;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(result => result.type === selectedCategory.slice(0, -1));
    }

    return filtered;
  }, [searchResults, selectedCategory]);

  // Render functions
  const ResultCard = ({ result, index }: { result: SearchResult; index: number }) => (
    <div
      onClick={() => handleItemClick(result)}
      className='flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer transition-colors group'
    >
      <div className='relative'>
        <img
          src={result.thumbnail || '/default-thumbnail.jpg'}
          alt={result.title}
          className='w-16 h-16 rounded-lg object-cover'
        />
        {result.type === 'stream' && result.metadata.isLive && (
          <div className='absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1 py-0.5 rounded'>
            LIVE
          </div>
        )}
      </div>

      <div className='flex-1 min-w-0'>
        <div className='flex items-start justify-between'>
          <div className='min-w-0 flex-1'>
            <h3 className='font-semibold text-white truncate'>
              {result.highlights?.title ? (
                <span dangerouslySetInnerHTML={{ __html: result.highlights.title }} />
              ) : (
                result.title
              )}
            </h3>

            {result.subtitle && <p className='text-gray-400 text-sm truncate'>{result.subtitle}</p>}

            {result.highlights?.description ? (
              <p
                className='text-gray-300 text-sm mt-1 line-clamp-2'
                dangerouslySetInnerHTML={{ __html: result.highlights.description }}
              />
            ) : result.description ? (
              <p className='text-gray-300 text-sm mt-1 line-clamp-2'>{result.description}</p>
            ) : null}

            <div className='flex items-center gap-4 mt-2 text-xs text-gray-500'>
              <span className='capitalize'>{result.type}</span>

              {result.metadata.duration && (
                <span>
                  {Math.floor(result.metadata.duration / 60)}:
                  {(result.metadata.duration % 60).toString().padStart(2, '0')}
                </span>
              )}

              {result.metadata.playCount && (
                <span className='flex items-center gap-1'>
                  <PlayIcon className='w-3 h-3' />
                  {result.metadata.playCount.toLocaleString()}
                </span>
              )}

              {result.metadata.likes && (
                <span className='flex items-center gap-1'>
                  <HeartIcon className='w-3 h-3' />
                  {result.metadata.likes.toLocaleString()}
                </span>
              )}

              {result.metadata.views && (
                <span className='flex items-center gap-1'>
                  <EyeIcon className='w-3 h-3' />
                  {result.metadata.views.toLocaleString()}
                </span>
              )}

              {result.metadata.isVerified && <span className='text-blue-500'>✓ Verified</span>}
            </div>

            {result.metadata.tags && result.metadata.tags.length > 0 && (
              <div className='flex gap-1 mt-2'>
                {result.metadata.tags.slice(0, 3).map(tag => (
                  <span key={tag} className='px-2 py-1 bg-gray-700 text-xs rounded'>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className='flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity'>
            <button
              onClick={e => {
                e.stopPropagation();
                toggleLike(result);
              }}
              className='p-2 hover:bg-gray-700 rounded-lg transition-colors'
            >
              <HeartIcon className='w-4 h-4' />
            </button>

            <button
              onClick={e => e.stopPropagation()}
              className='p-2 hover:bg-gray-700 rounded-lg transition-colors'
            >
              <ShareIcon className='w-4 h-4' />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className='min-h-screen bg-gray-900 text-white'>
      {/* Search Header */}
      <div className='bg-gray-800 border-b border-gray-700 sticky top-0 z-40'>
        <div className='max-w-7xl mx-auto p-4'>
          <div className='flex items-center gap-4'>
            {/* Search Input */}
            <div className='flex-1 relative'>
              <div className='relative'>
                <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  ref={searchInputRef}
                  type='text'
                  placeholder='Search for tracks, artists, playlists, streams...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  className='w-full pl-10 pr-16 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg'
                />

                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className='absolute right-12 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-600 rounded transition-colors'
                  >
                    <XMarkIcon className='w-4 h-4 text-gray-400' />
                  </button>
                )}

                <button
                  onClick={startVoiceSearch}
                  className='absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-600 rounded transition-colors'
                >
                  <MicrophoneIcon className='w-5 h-5 text-gray-400' />
                </button>
              </div>

              {/* Search Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className='absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto'>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchQuery(suggestion.query);
                        setShowSuggestions(false);
                      }}
                      className='w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors flex items-center justify-between'
                    >
                      <span className='flex items-center gap-3'>
                        {suggestion.type === 'trending' ? (
                          <ArrowTrendingUpIcon className='w-4 h-4 text-orange-500' />
                        ) : suggestion.type === 'correction' ? (
                          <LightBulbIcon className='w-4 h-4 text-yellow-500' />
                        ) : (
                          <MagnifyingGlassIcon className='w-4 h-4 text-gray-400' />
                        )}
                        <span>{suggestion.query}</span>
                      </span>

                      {suggestion.count && (
                        <span className='text-xs text-gray-400'>
                          {suggestion.count.toLocaleString()} results
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Mode Toggle */}
            <div className='flex bg-gray-700 rounded-lg overflow-hidden'>
              {[
                { mode: 'standard', icon: MagnifyingGlassIcon, label: 'Text' },
                { mode: 'semantic', icon: SparklesIcon, label: 'AI' },
                { mode: 'voice', icon: MicrophoneIcon, label: 'Voice' },
              ].map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setSearchMode(mode as any)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    searchMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  )}
                >
                  <Icon className='w-4 h-4' />
                  <span className='hidden sm:inline'>{label}</span>
                </button>
              ))}
            </div>

            {/* Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                showFilters
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600'
              )}
            >
              <FunnelIcon className='w-4 h-4' />
              <span className='hidden sm:inline'>Filters</span>
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className='mt-4 p-4 bg-gray-700 rounded-lg'>
              <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4'>
                {/* Content Type */}
                <div>
                  <label className='block text-sm font-medium mb-2'>Content Type</label>
                  <div className='space-y-1'>
                    {['tracks', 'artists', 'albums', 'playlists', 'streams', 'users'].map(type => (
                      <label key={type} className='flex items-center'>
                        <input
                          type='checkbox'
                          checked={filters.type.includes(type)}
                          onChange={e => {
                            if (e.target.checked) {
                              updateFilter('type', [...filters.type, type]);
                            } else {
                              updateFilter(
                                'type',
                                filters.type.filter(t => t !== type)
                              );
                            }
                          }}
                          className='mr-2 rounded'
                        />
                        <span className='text-sm capitalize'>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Genre */}
                <div>
                  <label className='block text-sm font-medium mb-2'>Genre</label>
                  <select
                    multiple
                    value={filters.genre}
                    onChange={e =>
                      updateFilter(
                        'genre',
                        Array.from(e.target.selectedOptions, option => option.value)
                      )
                    }
                    className='w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm h-32'
                  >
                    {genres.map(genre => (
                      <option key={genre} value={genre.toLowerCase()}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range */}
                <div>
                  <label className='block text-sm font-medium mb-2'>Date Range</label>
                  <div className='space-y-2'>
                    <input
                      type='date'
                      value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                      onChange={e =>
                        updateFilter('dateRange', {
                          ...filters.dateRange,
                          start: e.target.value ? new Date(e.target.value) : undefined,
                        })
                      }
                      className='w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-sm'
                    />
                    <input
                      type='date'
                      value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                      onChange={e =>
                        updateFilter('dateRange', {
                          ...filters.dateRange,
                          end: e.target.value ? new Date(e.target.value) : undefined,
                        })
                      }
                      className='w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-sm'
                    />
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <label className='block text-sm font-medium mb-2'>Sort By</label>
                  <select
                    value={filters.sortBy}
                    onChange={e => updateFilter('sortBy', e.target.value)}
                    className='w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm mb-2'
                  >
                    <option value='relevance'>Relevance</option>
                    <option value='date'>Date</option>
                    <option value='popularity'>Popularity</option>
                    <option value='alphabetical'>Alphabetical</option>
                  </select>

                  <select
                    value={filters.sortOrder}
                    onChange={e => updateFilter('sortOrder', e.target.value)}
                    className='w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm'
                  >
                    <option value='desc'>Descending</option>
                    <option value='asc'>Ascending</option>
                  </select>
                </div>
              </div>

              <div className='flex justify-end gap-3 mt-4'>
                <button
                  onClick={clearFilters}
                  className='px-4 py-2 text-gray-300 hover:text-white transition-colors'
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className='px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className='max-w-7xl mx-auto p-6'>
        {/* Content Tabs */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-1'>
            {[
              { id: 'results', label: 'Search Results', icon: MagnifyingGlassIconSolid },
              { id: 'recommendations', label: 'For You', icon: SparklesIcon },
              { id: 'trending', label: 'Trending', icon: FireIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <tab.icon className='w-4 h-4' />
                <span>{tab.label}</span>
                {tab.id === 'results' && filteredResults.length > 0 && (
                  <span className='bg-gray-700 text-xs px-2 py-1 rounded-full'>
                    {filteredResults.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'results' && hasSearched && (
            <div className='flex items-center gap-2'>
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className='bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm'
              >
                {contentTypes.map(type => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Results' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>

              {/* View Mode */}
              <div className='flex bg-gray-800 border border-gray-600 rounded overflow-hidden'>
                {[
                  { mode: 'list', label: 'List' },
                  { mode: 'grid', label: 'Grid' },
                ].map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as any)}
                    className={cn(
                      'px-3 py-1 text-sm transition-colors',
                      viewMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        {activeTab === 'results' && (
          <div>
            {!hasSearched ? (
              <div className='text-center py-16'>
                <MagnifyingGlassIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
                <h3 className='text-xl font-semibold text-gray-400 mb-2'>Search for anything</h3>
                <p className='text-gray-500'>
                  Find tracks, artists, playlists, live streams, and more
                </p>
              </div>
            ) : isSearching ? (
              <div className='text-center py-16'>
                <div className='animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4'></div>
                <p className='text-gray-400'>Searching...</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className='text-center py-16'>
                <div className='w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <MagnifyingGlassIcon className='w-8 h-8 text-gray-400' />
                </div>
                <h3 className='text-xl font-semibold text-gray-400 mb-2'>No results found</h3>
                <p className='text-gray-500 mb-4'>Try adjusting your search terms or filters</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    clearFilters();
                  }}
                  className='px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'space-y-3'
                )}
              >
                {filteredResults.map((result, index) => (
                  <ResultCard key={result.id} result={result} index={index} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div>
            {session?.user ? (
              recommendations.length === 0 ? (
                <div className='text-center py-16'>
                  <SparklesIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
                  <h3 className='text-xl font-semibold text-gray-400 mb-2'>
                    Building your recommendations
                  </h3>
                  <p className='text-gray-500'>
                    Listen to more content to get personalized recommendations
                  </p>
                </div>
              ) : (
                <div className='space-y-8'>
                  {Object.entries(
                    recommendations.reduce(
                      (acc, rec) => {
                        if (!acc[rec.category]) acc[rec.category] = [];
                        acc[rec.category].push(rec);
                        return acc;
                      },
                      {} as Record<string, Recommendation[]>
                    )
                  ).map(([category, recs]) => (
                    <div key={category}>
                      <h3 className='text-xl font-semibold mb-4 capitalize'>
                        {category} Recommendations
                      </h3>
                      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {recs.slice(0, 6).map(rec => (
                          <div
                            key={rec.id}
                            className='bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer'
                            onClick={() => handleItemClick(rec.item)}
                          >
                            <ResultCard result={rec.item} index={0} />
                            <div className='mt-2 text-xs text-gray-400'>
                              <span className='flex items-center gap-1'>
                                <LightBulbIcon className='w-3 h-3' />
                                {rec.reason}
                              </span>
                              <span className='text-green-400'>
                                {Math.round(rec.confidence * 100)}% match
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className='text-center py-16'>
                <UserIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
                <h3 className='text-xl font-semibold text-gray-400 mb-2'>
                  Sign in for personalized recommendations
                </h3>
                <p className='text-gray-500'>
                  Get AI-powered suggestions based on your listening history
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trending' && (
          <div>
            {trending.length === 0 ? (
              <div className='text-center py-16'>
                <FireIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
                <h3 className='text-xl font-semibold text-gray-400 mb-2'>
                  Loading trending content
                </h3>
                <p className='text-gray-500'>Discovering what's hot right now</p>
              </div>
            ) : (
              <div className='space-y-8'>
                {Object.entries(
                  trending.reduce(
                    (acc, item) => {
                      if (!acc[item.category]) acc[item.category] = [];
                      acc[item.category].push(item);
                      return acc;
                    },
                    {} as Record<string, TrendingItem[]>
                  )
                ).map(([category, items]) => (
                  <div key={category}>
                    <h3 className='text-xl font-semibold mb-4 capitalize flex items-center gap-2'>
                      <FireIcon className='w-5 h-5 text-orange-500' />
                      Trending in {category}
                    </h3>
                    <div className='space-y-3'>
                      {items.slice(0, 10).map((trendingItem, index) => (
                        <div key={trendingItem.item.id} className='flex items-center gap-4'>
                          <div className='w-8 text-center'>
                            <span
                              className={cn(
                                'text-lg font-bold',
                                index < 3 ? 'text-yellow-500' : 'text-gray-400'
                              )}
                            >
                              {index + 1}
                            </span>
                          </div>
                          <div className='flex-1'>
                            <ResultCard result={trendingItem.item} index={index} />
                          </div>
                          <div className='text-right'>
                            <div className='text-sm font-medium text-green-400'>
                              +{Math.round(trendingItem.velocity * 100)}%
                            </div>
                            <div className='text-xs text-gray-400'>{trendingItem.timeframe}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
