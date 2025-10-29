'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  X, 
  Clock, 
  TrendingUp, 
  Star, 
  Users, 
  Tag, 
  MapPin, 
  Calendar,
  DollarSign,
  Play,
  Heart,
  Bookmark,
  Eye,
  ChevronDown,
  ChevronUp,
  Zap,
  Crown,
  Verified,
  Hash,
  User,
  Video,
  Image,
  Mic,
  Globe,
  Settings,
  Save,
  AlertCircle
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';

interface SearchResult {
  id: string;
  type: 'content' | 'creator' | 'community' | 'tag' | 'category';
  title: string;
  description?: string;
  thumbnail?: string;
  creator?: {
    id: string;
    name: string;
    avatar?: string;
    verified?: boolean;
    tier?: 'free' | 'premium' | 'vip';
  };
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    rating?: number;
    duration?: number;
    price?: number;
  };
  tags?: string[];
  category?: string;
  createdAt?: Date;
  relevanceScore?: number;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'trending' | 'suggestion' | 'correction';
  count?: number;
  category?: string;
}

interface SearchFilter {
  id: string;
  name: string;
  type: 'select' | 'multiselect' | 'range' | 'date' | 'boolean' | 'tags';
  options?: Array<{ value: string; label: string; count?: number }>;
  value?: any;
  min?: number;
  max?: number;
  placeholder?: string;
}

interface IntelligentSearchEngineProps {
  placeholder?: string;
  onSearch?: (query: string, filters: Record<string, any>) => Promise<SearchResult[]>;
  onSuggestions?: (query: string) => Promise<SearchSuggestion[]>;
  filters?: SearchFilter[];
  trending?: SearchSuggestion[];
  recent?: string[];
  maxResults?: number;
  enableVoiceSearch?: boolean;
  enableImageSearch?: boolean;
  className?: string;
}

const defaultFilters: SearchFilter[] = [
  {
    id: 'type',
    name: 'Content Type',
    type: 'multiselect',
    options: [
      { value: 'video', label: 'Videos', count: 1250 },
      { value: 'photo', label: 'Photos', count: 3420 },
      { value: 'live', label: 'Live Streams', count: 45 },
      { value: 'audio', label: 'Audio', count: 230 }
    ]
  },
  {
    id: 'category',
    name: 'Category',
    type: 'select',
    options: [
      { value: 'all', label: 'All Categories' },
      { value: 'amateur', label: 'Amateur' },
      { value: 'professional', label: 'Professional' },
      { value: 'couples', label: 'Couples' },
      { value: 'solo', label: 'Solo' }
    ]
  },
  {
    id: 'duration',
    name: 'Duration',
    type: 'range',
    min: 0,
    max: 3600,
    placeholder: 'Any duration'
  },
  {
    id: 'price',
    name: 'Price Range',
    type: 'range',
    min: 0,
    max: 100,
    placeholder: 'Any price'
  },
  {
    id: 'rating',
    name: 'Minimum Rating',
    type: 'select',
    options: [
      { value: '0', label: 'Any Rating' },
      { value: '3', label: '3+ Stars' },
      { value: '4', label: '4+ Stars' },
      { value: '4.5', label: '4.5+ Stars' }
    ]
  },
  {
    id: 'uploadDate',
    name: 'Upload Date',
    type: 'select',
    options: [
      { value: 'any', label: 'Any Time' },
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'This Week' },
      { value: 'month', label: 'This Month' },
      { value: 'year', label: 'This Year' }
    ]
  },
  {
    id: 'verified',
    name: 'Verified Only',
    type: 'boolean'
  }
];

export function IntelligentSearchEngine({
  placeholder = "Search content, creators, or communities...",
  onSearch,
  onSuggestions,
  filters = defaultFilters,
  trending = [],
  recent = [],
  maxResults = 50,
  enableVoiceSearch = false,
  enableImageSearch = false,
  className = ''
}: IntelligentSearchEngineProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [searchHistory, setSearchHistory] = useLocalStorage<string[]>('search-history', []);
  const [savedSearches, setSavedSearches] = useLocalStorage<Array<{id: string, query: string, filters: Record<string, any>, name: string}>>('saved-searches', []);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [isVoiceSearch, setIsVoiceSearch] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  const debouncedQuery = useDebounce(query, 300);

  // Auto-complete suggestions
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length > 1) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  // Perform search
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length > 2) {
      performSearch(debouncedQuery, activeFilters);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, activeFilters]);

  const fetchSuggestions = async (searchQuery: string) => {
    if (!onSuggestions) return;

    try {
      const suggestions = await onSuggestions(searchQuery);
      setSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const performSearch = async (searchQuery: string, filters: Record<string, any>) => {
    if (!onSearch) return;

    setIsSearching(true);
    announce(`Searching for ${searchQuery}`, 'polite');

    try {
      const searchResults = await onSearch(searchQuery, filters);
      setResults(searchResults.slice(0, maxResults));
      
      // Add to search history
      if (!searchHistory.includes(searchQuery)) {
        setSearchHistory(prev => [searchQuery, ...prev.slice(0, 9)]);
      }

      announce(`Found ${searchResults.length} results for ${searchQuery}`, 'polite');
    } catch (error) {
      console.error('Error performing search:', error);
      announce('Search failed. Please try again.', 'assertive');
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedResultIndex(-1);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const handleFilterChange = (filterId: string, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterId]: value
    }));
  };

  const clearFilter = (filterId: string) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[filterId];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    announce('All filters cleared', 'polite');
  };

  const saveSearch = () => {
    if (!query.trim()) return;

    const searchName = prompt('Enter a name for this saved search:');
    if (!searchName) return;

    const savedSearch = {
      id: Date.now().toString(),
      query: query.trim(),
      filters: activeFilters,
      name: searchName
    };

    setSavedSearches(prev => [...prev, savedSearch]);
    announce(`Search saved as "${searchName}"`, 'polite');
  };

  const loadSavedSearch = (savedSearch: typeof savedSearches[0]) => {
    setQuery(savedSearch.query);
    setActiveFilters(savedSearch.filters);
    announce(`Loaded saved search: ${savedSearch.name}`, 'polite');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev => 
        prev < (showSuggestions ? suggestions.length - 1 : results.length - 1) ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev => prev > 0 ? prev - 1 : prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedResultIndex >= 0) {
        if (showSuggestions && suggestions[selectedResultIndex]) {
          handleSuggestionClick(suggestions[selectedResultIndex]);
        }
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedResultIndex(-1);
    }
  };

  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      announce('Voice search is not supported in this browser', 'assertive');
      return;
    }

    setIsVoiceSearch(true);
    announce('Voice search started. Please speak now.', 'polite');

    const recognition = new ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsVoiceSearch(false);
      announce(`Voice search detected: ${transcript}`, 'polite');
    };

    recognition.onerror = () => {
      setIsVoiceSearch(false);
      announce('Voice search failed. Please try again.', 'assertive');
    };

    recognition.onend = () => {
      setIsVoiceSearch(false);
    };

    recognition.start();
  };

  const activeFilterCount = Object.keys(activeFilters).length;

  const renderSearchResult = (result: SearchResult, index: number) => (
    <motion.div
      key={result.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
        selectedResultIndex === index ? 'bg-indigo-50 border-indigo-300' : ''
      }`}
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0">
        {result.thumbnail ? (
          <img
            src={result.thumbnail}
            alt={result.title}
            className="w-16 h-16 object-cover rounded-lg"
          />
        ) : (
          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
            {result.type === 'content' && <Video className="w-6 h-6 text-gray-400" />}
            {result.type === 'creator' && <User className="w-6 h-6 text-gray-400" />}
            {result.type === 'community' && <Users className="w-6 h-6 text-gray-400" />}
            {result.type === 'tag' && <Tag className="w-6 h-6 text-gray-400" />}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-medium text-gray-900 truncate">
            {result.title}
          </h3>
          {result.creator?.verified && (
            <Verified className="w-4 h-4 text-blue-500 flex-shrink-0" />
          )}
          {result.creator?.tier === 'vip' && (
            <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          )}
        </div>

        {result.creator && (
          <p className="text-sm text-gray-600 mt-1">
            by {result.creator.name}
          </p>
        )}

        {result.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {result.description}
          </p>
        )}

        {result.tags && result.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {result.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
              >
                <Hash className="w-3 h-3 mr-1" />
                {tag}
              </span>
            ))}
            {result.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{result.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 text-right">
        {result.stats && (
          <div className="space-y-1">
            {result.stats.rating && (
              <div className="flex items-center justify-end space-x-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">
                  {result.stats.rating.toFixed(1)}
                </span>
              </div>
            )}
            {result.stats.views && (
              <div className="flex items-center justify-end space-x-1">
                <Eye className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {result.stats.views.toLocaleString()}
                </span>
              </div>
            )}
            {result.stats.price && (
              <div className="flex items-center justify-end space-x-1">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">
                  {result.stats.price === 0 ? 'Free' : `$${result.stats.price}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderFilter = (filter: SearchFilter) => {
    const value = activeFilters[filter.id];

    switch (filter.type) {
      case 'select':
        return (
          <div key={filter.id} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {filter.name}
            </label>
            <select
              value={value || ''}
              onChange={(e) => handleFilterChange(filter.id, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {filter.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'multiselect':
        return (
          <div key={filter.id}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {filter.name}
            </label>
            <div className="space-y-2">
              {filter.options?.map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={value?.includes(option.value) || false}
                    onChange={(e) => {
                      const currentValue = value || [];
                      const newValue = e.target.checked
                        ? [...currentValue, option.value]
                        : currentValue.filter((v: string) => v !== option.value);
                      handleFilterChange(filter.id, newValue.length > 0 ? newValue : undefined);
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {option.label}
                    {option.count && (
                      <span className="text-gray-500 ml-1">({option.count})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div key={filter.id}>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleFilterChange(filter.id, e.target.checked || undefined)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {filter.name}
              </span>
            </label>
          </div>
        );

      case 'range':
        return (
          <div key={filter.id}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {filter.name}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                placeholder="Min"
                value={value?.[0] || ''}
                onChange={(e) => {
                  const newValue = [Number(e.target.value) || filter.min, value?.[1] || filter.max];
                  handleFilterChange(filter.id, newValue);
                }}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                placeholder="Max"
                value={value?.[1] || ''}
                onChange={(e) => {
                  const newValue = [value?.[0] || filter.min, Number(e.target.value) || filter.max];
                  handleFilterChange(filter.id, newValue);
                }}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`relative max-w-4xl mx-auto ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
        
        <input
          ref={searchInputRef}
          type="search"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          className={`block w-full pl-10 pr-20 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
            settings.highContrast ? 'border-2' : ''
          }`}
          autoComplete="off"
        />

        {/* Search Actions */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                searchInputRef.current?.focus();
              }}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}

          {enableVoiceSearch && (
            <button
              onClick={startVoiceSearch}
              disabled={isVoiceSearch}
              className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${
                isVoiceSearch ? 'text-red-500' : 'text-gray-400'
              }`}
              aria-label="Voice search"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative p-2 hover:bg-gray-100 rounded-full transition-colors ${
              showFilters || activeFilterCount > 0 ? 'text-indigo-600' : 'text-gray-400'
            }`}
            aria-label="Toggle filters"
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Suggestions */}
      <AnimatePresence>
        {showSuggestions && (suggestions.length > 0 || trending.length > 0 || searchHistory.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-large border border-gray-200 max-h-96 overflow-y-auto"
          >
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-medium text-gray-500 px-2 py-1 uppercase tracking-wide">
                  Suggestions
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full flex items-center space-x-3 px-2 py-2 text-left hover:bg-gray-50 rounded transition-colors ${
                      selectedResultIndex === index ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{suggestion.text}</span>
                    {suggestion.count && (
                      <span className="text-xs text-gray-500">
                        {suggestion.count.toLocaleString()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Trending */}
            {trending.length > 0 && (
              <div className="p-2 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-500 px-2 py-1 uppercase tracking-wide">
                  Trending
                </div>
                {trending.slice(0, 5).map(trend => (
                  <button
                    key={trend.id}
                    onClick={() => handleSuggestionClick(trend)}
                    className="w-full flex items-center space-x-3 px-2 py-2 text-left hover:bg-gray-50 rounded transition-colors"
                  >
                    <TrendingUp className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="flex-1 truncate">{trend.text}</span>
                    {trend.count && (
                      <span className="text-xs text-gray-500">
                        {trend.count.toLocaleString()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Recent Searches */}
            {searchHistory.length > 0 && (
              <div className="p-2 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-500 px-2 py-1 uppercase tracking-wide">
                  Recent
                </div>
                {searchHistory.slice(0, 5).map(historyItem => (
                  <button
                    key={historyItem}
                    onClick={() => handleSuggestionClick({ id: historyItem, text: historyItem, type: 'recent' })}
                    className="w-full flex items-center space-x-3 px-2 py-2 text-left hover:bg-gray-50 rounded transition-colors"
                  >
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{historyItem}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            ref={filtersRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <div className="flex items-center space-x-2">
                {query && (
                  <button
                    onClick={saveSearch}
                    className="flex items-center space-x-1 px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Search</span>
                  </button>
                )}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filters.map(renderFilter)}
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(activeFilters).map(([filterId, value]) => {
                    const filter = filters.find(f => f.id === filterId);
                    if (!filter || !value) return null;

                    let displayValue = value;
                    if (Array.isArray(value)) {
                      displayValue = value.join(', ');
                    } else if (typeof value === 'object') {
                      displayValue = `${value[0]}-${value[1]}`;
                    }

                    return (
                      <span
                        key={filterId}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800"
                      >
                        <span className="mr-2">
                          {filter.name}: {displayValue}
                        </span>
                        <button
                          onClick={() => clearFilter(filterId)}
                          className="ml-1 hover:text-indigo-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Results */}
      {(isSearching || results.length > 0) && (
        <div ref={resultsRef} className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              {isSearching ? 'Searching...' : `${results.length} Results`}
              {query && ` for "${query}"`}
            </h2>
            
            {results.length > 0 && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Sort by:
                </span>
                <select className="text-sm border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                  <option value="popular">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"
                />
                <span className="ml-3 text-gray-600">Searching...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((result, index) => renderSearchResult(result, index))
            ) : query.length > 2 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-1">Try different keywords or adjust your filters</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Saved Searches */}
      {savedSearches.length > 0 && !query && !results.length && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Saved Searches</h3>
          <div className="grid gap-3">
            {savedSearches.map(savedSearch => (
              <div
                key={savedSearch.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <h4 className="font-medium text-gray-900">{savedSearch.name}</h4>
                  <p className="text-sm text-gray-600">{savedSearch.query}</p>
                </div>
                <button
                  onClick={() => loadSavedSearch(savedSearch)}
                  className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}