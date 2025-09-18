"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  UserIcon,
  MusicalNoteIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import { useApi } from '@/hooks/use-api'
import { LoadingState, LoadingSpinner, SkeletonCard } from '@/components/ui/loading'
import { useDebounce } from '@/hooks/use-debounce'

interface SearchResult {
  id: string
  type: 'artist' | 'content'
  title: string
  description?: string
  creator?: {
    id: string
    displayName: string
    avatar?: string
  }
  thumbnail?: string
  tags?: string[]
  price?: number
  rating?: number
  createdAt: string
}

interface SearchFilters {
  query: string
  type: 'all' | 'artists' | 'content'
  genre: string
  priceRange: [number, number]
  sortBy: 'relevance' | 'newest' | 'oldest' | 'price_low' | 'price_high' | 'rating'
  tags: string[]
}

const GENRES = [
  'All Genres',
  'Pop',
  'Rock',
  'Hip Hop',
  'Electronic',
  'Jazz',
  'Classical',
  'Country',
  'R&B',
  'Indie',
  'Alternative'
]

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
]

export default function SearchInterface() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: searchParams.get('q') || '',
    type: (searchParams.get('type') as any) || 'all',
    genre: searchParams.get('genre') || 'All Genres',
    priceRange: [0, 100],
    sortBy: (searchParams.get('sort') as any) || 'relevance',
    tags: []
  })
  
  const [showFilters, setShowFilters] = useState(false)
  const debouncedQuery = useDebounce(filters.query, 300)

  // Search API call
  const [searchResponse, setSearchResponse] = useState<{
    results: SearchResult[]
    total: number
    suggestions?: string[]
  } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Recommendations for when no query
  const {
    data: recommendationsResponse,
    loading: loadingRecommendations
  } = useApi<{
    featured: SearchResult[]
    trending: SearchResult[]
    new: SearchResult[]
  }>('/api/recommendations', {
    immediate: !debouncedQuery
  })

  // Execute search when query or filters change
  useEffect(() => {
    if (debouncedQuery) {
      const params = new URLSearchParams({
        q: debouncedQuery,
        type: filters.type,
        genre: filters.genre !== 'All Genres' ? filters.genre : '',
        sort: filters.sortBy,
        minPrice: filters.priceRange[0].toString(),
        maxPrice: filters.priceRange[1].toString(),
      }).toString()
      
      // Execute search with parameters
      setSearching(true)
      setSearchError(null)
      
      fetch(`/api/search?${params}`, { 
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(async res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
          }
          return res.json()
        })
        .then(data => {
          setSearchResponse(data)
          setSearching(false)
        })
        .catch(err => {
          setSearchError(err.message)
          setSearching(false)
        })

      // Update URL
      router.push(`/search?${params}`, { scroll: false })
    }
  }, [debouncedQuery, filters, router])

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const results = searchResponse?.results || []
  const total = searchResponse?.total || 0
  const suggestions = searchResponse?.suggestions || []

  const featured = recommendationsResponse?.featured || []
  const trending = recommendationsResponse?.trending || []
  const newContent = recommendationsResponse?.new || []

  const renderSearchResult = (item: SearchResult) => (
    <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-w-16 aspect-h-9">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
            {item.type === 'artist' ? (
              <UserIcon className="w-16 h-16 text-gray-400" />
            ) : (
              <MusicalNoteIcon className="w-16 h-16 text-gray-400" />
            )}
          </div>
        )}
      </div>
      
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
            {item.creator && (
              <p className="text-sm text-gray-600 mb-2">
                by {item.creator.displayName}
              </p>
            )}
            {item.description && (
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
          
          <div className="ml-4 text-right">
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              item.type === 'artist' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'
            }`}>
              {item.type}
            </span>
            {item.price && (
              <p className="text-lg font-bold text-gray-900 mt-2">
                ${item.price}
              </p>
            )}
          </div>
        </div>

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {item.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors">
            View Details
          </button>
        </div>
      </div>
    </div>
  )

  const renderSection = (title: string, items: SearchResult[], loading = false) => (
    <div className="mb-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
      <LoadingState
        loading={loading}
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} lines={4} />
            ))}
          </div>
        }
      >
        {items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map(renderSearchResult)}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No items found</p>
        )}
      </LoadingState>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Discover Artists & Content
          </h1>
          
          {/* Search Bar */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search for artists, music, videos, and more..."
              value={filters.query}
              onChange={(e) => handleFilterChange('query', e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
            />
            {searching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleFilterChange('type', 'all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filters.type === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleFilterChange('type', 'artists')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filters.type === 'artists'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Artists
              </button>
              <button
                onClick={() => handleFilterChange('type', 'content')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filters.type === 'content'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Content
              </button>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genre
                  </label>
                  <select
                    value={filters.genre}
                    onChange={(e) => handleFilterChange('genre', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {GENRES.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.priceRange[1]}
                    onChange={(e) => handleFilterChange('priceRange', [0, parseInt(e.target.value)])}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {debouncedQuery ? (
          <div>
            {/* Search Results Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {total > 0 ? `${total} results for "${debouncedQuery}"` : `No results for "${debouncedQuery}"`}
              </h2>
            </div>

            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Did you mean:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleFilterChange('query', suggestion)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            <LoadingState
              loading={searching}
              fallback={
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} lines={4} />
                  ))}
                </div>
              }
            >
              {searchError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-2">Failed to search</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-indigo-600 hover:text-indigo-500 font-medium"
                  >
                    Try again
                  </button>
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {results.map(renderSearchResult)}
                </div>
              ) : !searching ? (
                <div className="text-center py-8">
                  <MagnifyingGlassIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No results found. Try adjusting your search terms or filters.</p>
                </div>
              ) : null}
            </LoadingState>
          </div>
        ) : (
          /* Discovery Sections */
          <div>
            {renderSection('Featured Content', featured, loadingRecommendations)}
            {renderSection('Trending Now', trending, loadingRecommendations)}
            {renderSection('New Releases', newContent, loadingRecommendations)}
          </div>
        )}
      </div>
    </div>
  )
}