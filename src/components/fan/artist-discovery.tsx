'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MagnifyingGlassIcon, FunnelIcon, StarIcon, HeartIcon, FireIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid';

interface Artist {
  id: string;
  displayName: string;
  bio: string | null;
  avatar: string | null;
  socialLinks: any;
  createdAt: string;
  artists: {
    totalSubscribers: number;
    totalEarnings: string;
  } | null;
  tiers: {
    id: string;
    name: string;
    description: string;
    minimumPrice: string;
    subscriberCount: number;
  }[];
  content: {
    id: string;
    title: string;
    type: string;
    thumbnailUrl: string | null;
    createdAt: string;
  }[];
}

interface ArtistDiscoveryProps {
  initialArtists?: Artist[];
}

const categories = [
  { id: 'all', name: 'All Creators', icon: '🎨' },
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'art', name: 'Visual Art', icon: '🎨' },
  { id: 'fitness', name: 'Fitness', icon: '💪' },
  { id: 'lifestyle', name: 'Lifestyle', icon: '✨' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'cooking', name: 'Cooking', icon: '👨‍🍳' },
  { id: 'tech', name: 'Technology', icon: '💻' },
];

const sortOptions = [
  { id: 'trending', name: 'Trending', icon: <FireIcon className="w-4 h-4" /> },
  { id: 'newest', name: 'Newest', icon: <StarIcon className="w-4 h-4" /> },
  { id: 'subscribers', name: 'Most Subscribers', icon: <HeartIcon className="w-4 h-4" /> },
  { id: 'price_low', name: 'Price: Low to High', icon: null },
  { id: 'price_high', name: 'Price: High to Low', icon: null },
];

export default function ArtistDiscovery({ initialArtists = [] }: ArtistDiscoveryProps) {
  const [artists, setArtists] = useState<Artist[]>(initialArtists);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [initialLoad, setInitialLoad] = useState(initialArtists.length === 0);
  
  // New filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 100]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  const router = useRouter();

  // Load initial artists if not provided
  useEffect(() => {
    if (initialLoad) {
      fetchArtists('', true);
      setInitialLoad(false);
    }
  }, [initialLoad]);

  const fetchArtists = async (searchTerm = '', resetList = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: resetList ? '0' : offset.toString(),
        category: selectedCategory !== 'all' ? selectedCategory : '',
        sortBy: sortBy,
        minPrice: priceRange[0].toString(),
        maxPrice: priceRange[1].toString(),
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/fan/artists?${params}`);
      if (!response.ok) throw new Error('Failed to fetch artists');

      const data = await response.json();

      if (resetList) {
        setArtists(data.artists);
        setOffset(20);
      } else {
        setArtists(prev => [...prev, ...data.artists]);
        setOffset(prev => prev + 20);
      }

      setHasMore(data.pagination.hasMore);
    } catch (error) {
      console.error('Error fetching artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchArtists(search, true);
  };

  const handleFilterChange = () => {
    setOffset(0);
    fetchArtists(search, true);
  };

  const toggleFavorite = (artistId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(artistId)) {
        newFavorites.delete(artistId);
      } else {
        newFavorites.add(artistId);
      }
      return newFavorites;
    });
  };

  // Update results when filters change
  useEffect(() => {
    if (!initialLoad) {
      handleFilterChange();
    }
  }, [selectedCategory, sortBy, priceRange]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchArtists(search);
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(price));
  };

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
      {/* Enhanced Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-4xl font-bold text-gray-900 mb-2'>Discover Creators</h1>
            <p className='text-gray-600'>Find and support amazing independent creators worldwide</p>
          </div>
          <div className='flex items-center gap-4'>
            <span className='text-sm text-gray-500'>{artists.length} creators found</span>
          </div>
        </div>
      </div>

      {/* Enhanced Search & Filters */}
      <div className='mb-8 space-y-6'>
        {/* Search Bar */}
        <form onSubmit={handleSearch}>
          <div className='relative'>
            <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
              <MagnifyingGlassIcon className='h-5 w-5 text-gray-400' />
            </div>
            <input
              type='text'
              placeholder='Search creators by name, description, or content type...'
              value={search}
              onChange={e => setSearch(e.target.value)}
              className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg'
            />
            <div className='absolute inset-y-0 right-0 pr-3 flex items-center gap-2'>
              <button
                type='button'
                onClick={() => setShowFilters(!showFilters)}
                className='p-2 text-gray-400 hover:text-gray-600 transition-colors'
              >
                <FunnelIcon className='h-5 w-5' />
              </button>
              <button
                type='submit'
                disabled={loading}
                className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {/* Category Filters */}
        <div className='flex flex-wrap gap-2'>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className='mr-2'>{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>

        {/* Sort Options */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <label className='text-sm font-medium text-gray-700'>Sort by:</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className='px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              {sortOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className='text-sm text-gray-500'>
            Showing {artists.length} of many amazing creators
          </div>
        </div>

        {/* Advanced Filters (Collapsible) */}
        {showFilters && (
          <div className='bg-gray-50 rounded-xl p-6 space-y-4'>
            <h3 className='font-semibold text-gray-800'>Advanced Filters</h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {/* Price Range */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Monthly Price Range: ${priceRange[0]} - ${priceRange[1]}
                </label>
                <div className='flex items-center gap-4'>
                  <input
                    type='range'
                    min='0'
                    max='100'
                    value={priceRange[0]}
                    onChange={e => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                    className='flex-1'
                  />
                  <input
                    type='range'
                    min='0'
                    max='100'
                    value={priceRange[1]}
                    onChange={e => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className='flex-1'
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Artists Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8'>
        {artists.map(artist => (
          <div
            key={artist.id}
            className='group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 hover:scale-[1.02]'
          >
            {/* Enhanced Artist Avatar with Overlay */}
            <div className='aspect-square relative bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden'>
              {artist.avatar ? (
                <Image 
                  src={artist.avatar} 
                  alt={artist.displayName} 
                  fill 
                  className='object-cover group-hover:scale-110 transition-transform duration-300' 
                />
              ) : (
                <div className='w-full h-full flex items-center justify-center'>
                  <div className='w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg'>
                    <span className='text-3xl font-bold text-white'>
                      {artist.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Favorite Button Overlay */}
              <div className='absolute top-3 right-3'>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(artist.id);
                  }}
                  className='p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all duration-200 hover:scale-110'
                >
                  {favorites.has(artist.id) ? (
                    <HeartSolid className='w-5 h-5 text-red-500' />
                  ) : (
                    <HeartIcon className='w-5 h-5 text-gray-600 hover:text-red-500' />
                  )}
                </button>
              </div>
              
              {/* Trending Badge */}
              {sortBy === 'trending' && Math.random() > 0.7 && (
                <div className='absolute top-3 left-3'>
                  <div className='flex items-center gap-1 bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full'>
                    <FireIcon className='w-3 h-3' />
                    Trending
                  </div>
                </div>
              )}
              
              {/* Quick Action Overlay */}
              <div className='absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center'>
                <button
                  onClick={() => router.push(`/artist/${artist.id}`)}
                  className='bg-white text-gray-900 px-6 py-2 rounded-full font-semibold transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg hover:shadow-xl'
                >
                  View Profile
                </button>
              </div>
            </div>

            {/* Enhanced Artist Info */}
            <div className='p-5'>
              <div className='flex items-start justify-between mb-3'>
                <div className='flex-1'>
                  <h3 className='text-xl font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors'>
                    {artist.displayName}
                  </h3>
                  {artist.bio && (
                    <p className='text-gray-600 text-sm line-clamp-2 leading-relaxed'>{artist.bio}</p>
                  )}
                </div>
              </div>

              {/* Enhanced Stats with Icons */}
              <div className='flex items-center gap-4 mb-4 text-sm'>
                <div className='flex items-center gap-1 text-gray-600'>
                  <HeartIcon className='w-4 h-4' />
                  <span className='font-medium'>{artist.artists?.totalSubscribers || 0}</span>
                  <span className='text-gray-500'>subscribers</span>
                </div>
                <div className='flex items-center gap-1 text-gray-600'>
                  <StarIcon className='w-4 h-4' />
                  <span className='font-medium'>{artist.tiers.length}</span>
                  <span className='text-gray-500'>tiers</span>
                </div>
                <div className='flex items-center gap-1 text-gray-600'>
                  <span className='font-medium'>{artist.content.length}</span>
                  <span className='text-gray-500'>posts</span>
                </div>
              </div>

              {/* Enhanced Pricing Display */}
              {artist.tiers.length > 0 && (
                <div className='bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-4'>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='text-sm font-semibold text-gray-700'>Starting from:</span>
                    <div className='px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full'>
                      {artist.tiers.length} {artist.tiers.length === 1 ? 'tier' : 'tiers'}
                    </div>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='font-bold text-gray-900 text-lg'>{artist.tiers[0].name}</span>
                    <span className='text-2xl font-bold text-green-600'>
                      {formatPrice(artist.tiers[0].minimumPrice)}
                      <span className='text-sm font-normal text-gray-500'>/month</span>
                    </span>
                  </div>
                  <p className='text-xs text-gray-600 mt-2 line-clamp-1'>{artist.tiers[0].description}</p>
                </div>
              )}

              {/* Enhanced Recent Content Preview */}
              {artist.content.length > 0 && (
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold text-gray-700'>Latest Content</span>
                    <span className='text-xs text-gray-500'>{artist.content.length} total</span>
                  </div>
                  <div className='grid grid-cols-3 gap-2'>
                    {artist.content.slice(0, 3).map(content => (
                      <div key={content.id} className='bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors group/content'>
                        <div className='font-semibold text-gray-800 text-xs truncate mb-1 group-hover/content:text-blue-600'>
                          {content.title}
                        </div>
                        <div className='flex items-center gap-1'>
                          <div className={`w-2 h-2 rounded-full ${
                            content.type === 'VIDEO' ? 'bg-red-400' :
                            content.type === 'IMAGE' ? 'bg-green-400' :
                            content.type === 'AUDIO' ? 'bg-purple-400' : 'bg-blue-400'
                          }`} />
                          <span className='text-xs text-gray-500 capitalize'>
                            {content.type.toLowerCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className='flex gap-2 pt-4 border-t border-gray-100'>
                <button
                  onClick={() => router.push(`/artist/${artist.id}`)}
                  className='flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors'
                >
                  View Profile
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Implement subscribe functionality
                    alert('Subscribe feature coming soon!');
                  }}
                  className='px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors'
                >
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className='text-center'>
          <button
            onClick={loadMore}
            disabled={loading}
            className='px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? 'Loading...' : 'Load More Artists'}
          </button>
        </div>
      )}

      {/* Empty State */}
      {artists.length === 0 && !loading && (
        <div className='text-center py-12'>
          <div className='text-gray-500 mb-4'>
            <svg
              className='mx-auto h-12 w-12'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
          </div>
          <h3 className='text-lg font-medium text-gray-900 mb-2'>No artists found</h3>
          <p className='text-gray-500'>
            {search ? 'Try adjusting your search terms' : 'Check back later for new artists'}
          </p>
        </div>
      )}
    </div>
  );
}
