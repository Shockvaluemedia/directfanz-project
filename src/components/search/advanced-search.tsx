'use client';

import React, { useState, useRef, useEffect } from 'react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { useSearch, useSearchSuggestions, SearchFilters } from '@/hooks/use-search';
import {
  Search,
  Filter,
  X,
  Clock,
  TrendingUp,
  User,
  Tag,
  Calendar,
  DollarSign,
  Star,
  Play,
  Image,
  Music,
  FileText,
  Video,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Loader
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdvancedSearchProps {
  className?: string;
  initialQuery?: string;
  onResultSelect?: (result: any) => void;
}

export function AdvancedSearch({ 
  className, 
  initialQuery = '', 
  onResultSelect 
}: AdvancedSearchProps) {
  const {
    query,
    setQuery,
    filters,
    updateFilters,
    clearFilters,
    results,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    recentSearches,
    clearRecentSearches,
    totalResults
  } = useSearch(initialQuery);

  const { data: suggestions } = useSearchSuggestions(query);
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState(0);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Count active filters
  useEffect(() => {
    const count = Object.values(filters).reduce((acc, value) => {
      if (Array.isArray(value)) {
        return acc + value.length;
      } else if (typeof value === 'object' && value !== null) {
        return acc + Object.values(value).filter(v => v !== undefined && v !== '').length;
      } else if (value !== undefined && value !== '' && value !== 'relevance') {
        return acc + 1;
      }
      return acc;
    }, 0);
    setActiveFilters(count);
  }, [filters]);

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  // Handle filter change
  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    updateFilters({ [key]: value });
  };

  // Handle clear all filters
  const handleClearFilters = () => {
    clearFilters();
  };

  return (
    <div className={cn("max-w-4xl mx-auto", className)}>
      {/* Search Header */}
      <div className="mb-6">
        <div className="relative">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search for creators, content, or topics..."
              className="w-full pl-12 pr-12 py-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setShowSuggestions(false);
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && (query || recentSearches.length > 0) && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
            >
              {/* Search Suggestions */}
              {suggestions && suggestions.length > 0 && (
                <div className="p-3 border-b border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Suggestions</h4>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion.text)}
                      className="w-full text-left p-2 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                    >
                      {suggestion.type === 'creator' && <User className="w-4 h-4 text-gray-400" />}
                      {suggestion.type === 'tag' && <Tag className="w-4 h-4 text-gray-400" />}
                      {suggestion.type === 'query' && <Search className="w-4 h-4 text-gray-400" />}
                      <span className="text-gray-900">{suggestion.text}</span>
                      {suggestion.count && (
                        <span className="ml-auto text-sm text-gray-500">{suggestion.count} results</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Recent Searches</h4>
                    <button
                      onClick={clearRecentSearches}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear all
                    </button>
                  </div>
                  {recentSearches.slice(0, 5).map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(search)}
                      className="w-full text-left p-2 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                    >
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{search}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between mt-4">
          <EnhancedButton
            variant={showFilters ? "primary" : "ghost"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                {activeFilters}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </EnhancedButton>

          {totalResults > 0 && (
            <span className="text-sm text-gray-600">
              {totalResults.toLocaleString()} results found
            </span>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && <SearchFilters filters={filters} onFilterChange={handleFilterChange} onClear={handleClearFilters} />}

      {/* Search Results */}
      <SearchResults 
        results={results}
        isLoading={isLoading}
        onLoadMore={fetchNextPage}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
        onResultSelect={onResultSelect}
      />
    </div>
  );
}

// Search Filters Component
interface SearchFiltersProps {
  filters: SearchFilters;
  onFilterChange: (key: keyof SearchFilters, value: any) => void;
  onClear: () => void;
}

function SearchFilters({ filters, onFilterChange, onClear }: SearchFiltersProps) {
  const categories = ['Music', 'Art', 'Fitness', 'Gaming', 'Education', 'Comedy', 'Fashion', 'Cooking'];
  const contentTypes = [
    { value: 'image', label: 'Images', icon: Image },
    { value: 'video', label: 'Videos', icon: Video },
    { value: 'audio', label: 'Audio', icon: Music },
    { value: 'document', label: 'Documents', icon: FileText }
  ];

  return (
    <EnhancedCard variant="elevated" className="mb-6">
      <EnhancedCardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Content Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
            <div className="space-y-2">
              {contentTypes.map(({ value, label, icon: Icon }) => (
                <label key={value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.contentTypes.includes(value)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...filters.contentTypes, value]
                        : filters.contentTypes.filter(t => t !== value);
                      onFilterChange('contentTypes', newTypes);
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <Icon className="w-4 h-4 text-gray-500 ml-2 mr-1" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {categories.map(category => (
                <label key={category} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={(e) => {
                      const newCategories = e.target.checked
                        ? [...filters.categories, category]
                        : filters.categories.filter(c => c !== category);
                      onFilterChange('categories', newCategories);
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.priceRange.min || ''}
                  onChange={(e) => onFilterChange('priceRange', { 
                    ...filters.priceRange, 
                    min: e.target.value ? parseFloat(e.target.value) : undefined 
                  })}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.priceRange.max || ''}
                  onChange={(e) => onFilterChange('priceRange', { 
                    ...filters.priceRange, 
                    max: e.target.value ? parseFloat(e.target.value) : undefined 
                  })}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.isPremium === true}
                  onChange={(e) => onFilterChange('isPremium', e.target.checked ? true : undefined)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Premium content only</span>
              </label>
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => onFilterChange('sortBy', e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="relevance">Relevance</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-gray-500" />
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={filters.minRating || 1}
                onChange={(e) => onFilterChange('minRating', parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 w-8">
                {filters.minRating || 1}+
              </span>
            </div>
          </div>

          {/* Special Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Special</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.isLive === true}
                  onChange={(e) => onFilterChange('isLive', e.target.checked ? true : undefined)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <Play className="w-4 h-4 text-red-500 ml-2 mr-1" />
                <span className="text-sm text-gray-700">Live now</span>
              </label>
            </div>
          </div>
        </div>

        {/* Filter Actions */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
          <EnhancedButton
            variant="ghost"
            size="sm"
            onClick={onClear}
          >
            Clear All Filters
          </EnhancedButton>
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Search Results Component
interface SearchResultsProps {
  results: any[];
  isLoading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onResultSelect?: (result: any) => void;
}

function SearchResults({ 
  results, 
  isLoading, 
  onLoadMore, 
  hasMore, 
  isLoadingMore, 
  onResultSelect 
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-2 text-gray-600">Searching...</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">No results found</h3>
        <p className="text-gray-500">Try adjusting your search terms or filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result) => (
        <SearchResultCard 
          key={result.id} 
          result={result} 
          onClick={() => onResultSelect?.(result)}
        />
      ))}

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center py-6">
          <EnhancedButton
            variant="ghost"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="min-w-[120px]"
          >
            {isLoadingMore ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </EnhancedButton>
        </div>
      )}
    </div>
  );
}

// Search Result Card Component
interface SearchResultCardProps {
  result: any;
  onClick?: () => void;
}

function SearchResultCard({ result, onClick }: SearchResultCardProps) {
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <EnhancedCard 
      variant="elevated" 
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <EnhancedCardContent className="p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="relative w-32 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
            {result.thumbnailUrl ? (
              <img
                src={result.thumbnailUrl}
                alt={result.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                {getContentTypeIcon(result.contentType)}
              </div>
            )}

            {/* Live Badge */}
            {result.isLive && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-xs font-medium rounded">
                LIVE
              </div>
            )}

            {/* Duration */}
            {result.duration && (
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black bg-opacity-75 text-white text-xs rounded">
                {formatDuration(result.duration)}
              </div>
            )}

            {/* Premium Badge */}
            {result.isPremium && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded">
                PREMIUM
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-lg text-gray-900 line-clamp-2">
                {result.title}
              </h3>
              {result.price && (
                <span className="text-lg font-bold text-green-600 ml-2">
                  ${result.price}
                </span>
              )}
            </div>

            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {result.description}
            </p>

            {/* Creator Info */}
            {result.creator && (
              <div className="flex items-center gap-2 mb-3">
                <img
                  src={result.creator.avatar}
                  alt={result.creator.name}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm text-gray-700">{result.creator.name}</span>
                {result.creator.verified && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
            )}

            {/* Metrics */}
            {result.metrics && (
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                <span>{result.metrics.views.toLocaleString()} views</span>
                <span>{result.metrics.likes.toLocaleString()} likes</span>
                {result.metrics.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span>{result.metrics.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {result.tags && result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.tags.slice(0, 3).map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
                {result.tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{result.tags.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}