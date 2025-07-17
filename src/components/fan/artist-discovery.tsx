"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface Artist {
  id: string
  displayName: string
  bio: string | null
  avatar: string | null
  socialLinks: any
  createdAt: string
  artistProfile: {
    totalSubscribers: number
    totalEarnings: string
  } | null
  tiers: {
    id: string
    name: string
    description: string
    minimumPrice: string
    subscriberCount: number
  }[]
  content: {
    id: string
    title: string
    type: string
    thumbnailUrl: string | null
    createdAt: string
  }[]
}

interface ArtistDiscoveryProps {
  initialArtists?: Artist[]
}

export default function ArtistDiscovery({ initialArtists = [] }: ArtistDiscoveryProps) {
  const [artists, setArtists] = useState<Artist[]>(initialArtists)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [initialLoad, setInitialLoad] = useState(initialArtists.length === 0)
  const router = useRouter()

  // Load initial artists if not provided
  useEffect(() => {
    if (initialLoad) {
      fetchArtists('', true)
      setInitialLoad(false)
    }
  }, [initialLoad])

  const fetchArtists = async (searchTerm = '', resetList = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: resetList ? '0' : offset.toString(),
      })
      
      if (searchTerm) {
        params.append('search', searchTerm)
      }

      const response = await fetch(`/api/fan/artists?${params}`)
      if (!response.ok) throw new Error('Failed to fetch artists')
      
      const data = await response.json()
      
      if (resetList) {
        setArtists(data.artists)
        setOffset(20)
      } else {
        setArtists(prev => [...prev, ...data.artists])
        setOffset(prev => prev + 20)
      }
      
      setHasMore(data.pagination.hasMore)
    } catch (error) {
      console.error('Error fetching artists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    fetchArtists(search, true)
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchArtists(search)
    }
  }

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(price))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Discover Artists
        </h1>
        <p className="text-gray-600">
          Find and support your favorite independent artists
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search artists by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Artists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {artists.map((artist) => (
          <div
            key={artist.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push(`/artist/${artist.id}`)}
          >
            {/* Artist Avatar */}
            <div className="aspect-square relative bg-gray-200">
              {artist.avatar ? (
                <Image
                  src={artist.avatar}
                  alt={artist.displayName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {artist.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Artist Info */}
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {artist.displayName}
              </h3>
              
              {artist.bio && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {artist.bio}
                </p>
              )}

              {/* Stats */}
              <div className="flex justify-between items-center mb-3 text-sm text-gray-500">
                <span>{artist.artistProfile?.totalSubscribers || 0} subscribers</span>
                <span>{artist.tiers.length} tier{artist.tiers.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Tiers Preview */}
              {artist.tiers.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">
                    Starting from:
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">
                        {artist.tiers[0].name}
                      </span>
                      <span className="text-green-600 font-semibold">
                        {formatPrice(artist.tiers[0].minimumPrice)}+/month
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {artist.tiers[0].description}
                    </p>
                  </div>
                </div>
              )}

              {/* Recent Content Preview */}
              {artist.content.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Recent Content:
                  </div>
                  <div className="flex gap-2">
                    {artist.content.slice(0, 3).map((content) => (
                      <div
                        key={content.id}
                        className="flex-1 bg-gray-100 rounded p-2 text-xs"
                      >
                        <div className="font-medium text-gray-800 truncate">
                          {content.title}
                        </div>
                        <div className="text-gray-500 capitalize">
                          {content.type.toLowerCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load More Artists'}
          </button>
        </div>
      )}

      {/* Empty State */}
      {artists.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No artists found
          </h3>
          <p className="text-gray-500">
            {search ? 'Try adjusting your search terms' : 'Check back later for new artists'}
          </p>
        </div>
      )}
    </div>
  )
}