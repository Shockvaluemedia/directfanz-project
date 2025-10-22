'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ListBulletIcon,
  Squares2X2Icon,
  HeartIcon,
  PlayIcon,
  EyeIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  FireIcon,
  TrendingUpIcon as TrendingUp,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid, PlayIcon as PlayIconSolid } from '@heroicons/react/24/solid';
import { useDebounce } from '@/hooks/useDebounce';
import Image from 'next/image';
import Link from 'next/link';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT';
  thumbnailUrl?: string;
  fileUrl: string;
  duration?: number;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  isLiked: boolean;
  visibility: 'PUBLIC' | 'SUBSCRIBERS' | 'TIER';
  tags: string[];
  artist: {
    id: string;
    name: string;
    avatar?: string;
    isVerified: boolean;
    subscriberCount: number;
  };
  tier?: {
    id: string;
    name: string;
    price: number;
  };
}

interface FilterOptions {
  type: 'ALL' | 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT';
  sortBy: 'RECENT' | 'POPULAR' | 'TRENDING' | 'RECOMMENDED';
  timeRange: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
  tags: string[];
  priceRange: 'ALL' | 'FREE' | 'PAID';
}

const initialFilters: FilterOptions = {
  type: 'ALL',
  sortBy: 'RECENT',
  timeRange: 'ALL',
  tags: [],
  priceRange: 'ALL',
};

const typeOptions = [
  { value: 'ALL', label: 'All Content', icon: Squares2X2Icon },
  { value: 'AUDIO', label: 'Audio', icon: PlayIcon },
  { value: 'VIDEO', label: 'Video', icon: PlayIcon },
  { value: 'IMAGE', label: 'Images', icon: EyeIcon },
  { value: 'DOCUMENT', label: 'Documents', icon: ListBulletIcon },
];

const sortOptions = [
  { value: 'RECENT', label: 'Most Recent', icon: CalendarIcon },
  { value: 'POPULAR', label: 'Most Popular', icon: HeartIcon },
  { value: 'TRENDING', label: 'Trending', icon: TrendingUpIcon as TrendingUp },
  { value: 'RECOMMENDED', label: 'Recommended', icon: SparklesIcon },
];

const timeRangeOptions = [
  { value: 'ALL', label: 'All Time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'WEEK', label: 'This Week' },
  { value: 'MONTH', label: 'This Month' },
];

const priceRangeOptions = [
  { value: 'ALL', label: 'All Content' },
  { value: 'FREE', label: 'Free Only' },
  { value: 'PAID', label: 'Premium Only' },
];

interface ContentDiscoveryProps {
  onContentSelect?: (content: ContentItem) => void;
  className?: string;
}

export default function ContentDiscovery({ onContentSelect, className }: ContentDiscoveryProps) {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [filteredContent, setFilteredContent] = useState<ContentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [popularTags, setPopularTags] = useState<string[]>([]);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Mock data - in real app, this would come from API
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockContent: ContentItem[] = [
        {
          id: '1',
          title: 'Midnight Melodies',
          description: 'A collection of soothing piano pieces perfect for late-night listening.',
          type: 'AUDIO',
          thumbnailUrl: '/api/placeholder/400/300',
          fileUrl: '/content/audio/midnight-melodies.mp3',
          duration: 240,
          createdAt: '2024-01-15T10:00:00Z',
          viewCount: 1250,
          likeCount: 89,
          isLiked: false,
          visibility: 'PUBLIC',
          tags: ['piano', 'ambient', 'relaxing', 'instrumental'],
          artist: {
            id: 'artist1',
            name: 'Elena Rodriguez',
            avatar: '/api/placeholder/100/100',
            isVerified: true,
            subscriberCount: 15430,
          },
        },
        {
          id: '2',
          title: 'Behind the Scenes: Recording Session',
          description: 'Exclusive footage from our latest album recording session.',
          type: 'VIDEO',
          thumbnailUrl: '/api/placeholder/400/300',
          fileUrl: '/content/video/recording-session.mp4',
          duration: 480,
          createdAt: '2024-01-14T15:30:00Z',
          viewCount: 892,
          likeCount: 156,
          isLiked: true,
          visibility: 'SUBSCRIBERS',
          tags: ['behind-the-scenes', 'recording', 'studio'],
          artist: {
            id: 'artist2',
            name: 'The Midnight Collective',
            avatar: '/api/placeholder/100/100',
            isVerified: true,
            subscriberCount: 28920,
          },
          tier: {
            id: 'tier1',
            name: 'Premium Fan',
            price: 9.99,
          },
        },
        // Add more mock content...
      ];

      setContent(mockContent);
      setFilteredContent(mockContent);
      setLoading(false);

      // Extract popular tags
      const allTags = mockContent.flatMap(item => item.tags);
      const tagCounts = allTags.reduce(
        (acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const popular = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag);

      setPopularTags(popular);
    }, 1000);
  }, []);

  // Filter and search content
  useEffect(() => {
    let filtered = [...content];

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.artist.name.toLowerCase().includes(query) ||
          item.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply type filter
    if (filters.type !== 'ALL') {
      filtered = filtered.filter(item => item.type === filters.type);
    }

    // Apply price filter
    if (filters.priceRange === 'FREE') {
      filtered = filtered.filter(item => item.visibility === 'PUBLIC');
    } else if (filters.priceRange === 'PAID') {
      filtered = filtered.filter(item => item.visibility !== 'PUBLIC');
    }

    // Apply tag filters
    if (filters.tags.length > 0) {
      filtered = filtered.filter(item => filters.tags.some(tag => item.tags.includes(tag)));
    }

    // Apply time range filter
    if (filters.timeRange !== 'ALL') {
      const now = new Date();
      const timeThreshold = new Date(now);

      switch (filters.timeRange) {
        case 'TODAY':
          timeThreshold.setDate(now.getDate() - 1);
          break;
        case 'WEEK':
          timeThreshold.setDate(now.getDate() - 7);
          break;
        case 'MONTH':
          timeThreshold.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter(item => new Date(item.createdAt) >= timeThreshold);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'RECENT':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'POPULAR':
          return b.viewCount - a.viewCount;
        case 'TRENDING':
          // Simple trending algorithm based on likes and recent views
          const trendingScoreA = a.likeCount * 2 + a.viewCount * 0.1;
          const trendingScoreB = b.likeCount * 2 + b.viewCount * 0.1;
          return trendingScoreB - trendingScoreA;
        case 'RECOMMENDED':
          // Mock recommendation score
          return Math.random() - 0.5;
        default:
          return 0;
      }
    });

    setFilteredContent(filtered);
  }, [content, debouncedSearchQuery, filters]);

  const handleLike = useCallback(async (contentId: string) => {
    // Optimistic update
    setFilteredContent(prev =>
      prev.map(item =>
        item.id === contentId
          ? {
              ...item,
              isLiked: !item.isLiked,
              likeCount: item.isLiked ? item.likeCount - 1 : item.likeCount + 1,
            }
          : item
      )
    );

    // In real app, make API call here
    try {
      // await likeContent(contentId);
    } catch (error) {
      // Revert on error
      setFilteredContent(prev =>
        prev.map(item =>
          item.id === contentId
            ? {
                ...item,
                isLiked: item.isLiked,
                likeCount: item.isLiked ? item.likeCount + 1 : item.likeCount - 1,
              }
            : item
        )
      );
    }
  }, []);

  const toggleTag = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }));
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setSearchQuery('');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search and Controls */}
      <div className='flex flex-col lg:flex-row gap-4'>
        {/* Search Bar */}
        <div className='relative flex-1'>
          <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400' />
          <input
            type='text'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder='Search content, artists, or tags...'
            className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors'
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
            >
              <XMarkIcon className='w-5 h-5' />
            </button>
          )}
        </div>

        {/* Controls */}
        <div className='flex gap-2'>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-3 rounded-lg border transition-colors ${
              showFilters
                ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className='w-5 h-5 mr-2' />
            Filters
            {(filters.type !== 'ALL' ||
              filters.tags.length > 0 ||
              filters.priceRange !== 'ALL' ||
              filters.timeRange !== 'ALL') && (
              <span className='ml-2 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full'>
                {[
                  filters.type !== 'ALL' ? 1 : 0,
                  filters.tags.length,
                  filters.priceRange !== 'ALL' ? 1 : 0,
                  filters.timeRange !== 'ALL' ? 1 : 0,
                ].reduce((a, b) => a + b, 0)}
              </span>
            )}
          </button>

          <div className='flex border border-gray-300 rounded-lg overflow-hidden'>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Squares2X2Icon className='w-5 h-5' />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-3 transition-colors ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ListBulletIcon className='w-5 h-5' />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className='bg-white border border-gray-200 rounded-lg p-6 space-y-6 overflow-hidden'
          >
            <div className='flex justify-between items-center'>
              <h3 className='text-lg font-medium text-gray-900'>Filters</h3>
              <button
                onClick={clearFilters}
                className='text-sm text-indigo-600 hover:text-indigo-800 transition-colors'
              >
                Clear All
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
              {/* Content Type */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-3'>Content Type</label>
                <div className='space-y-2'>
                  {typeOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setFilters(prev => ({ ...prev, type: option.value as any }))}
                      className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.type === option.value
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <option.icon className='w-4 h-4 mr-2' />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-3'>Sort By</label>
                <div className='space-y-2'>
                  {sortOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setFilters(prev => ({ ...prev, sortBy: option.value as any }))}
                      className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.sortBy === option.value
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <option.icon className='w-4 h-4 mr-2' />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Range */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-3'>Time Range</label>
                <div className='space-y-2'>
                  {timeRangeOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() =>
                        setFilters(prev => ({ ...prev, timeRange: option.value as any }))
                      }
                      className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.timeRange === option.value
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-3'>Access Type</label>
                <div className='space-y-2'>
                  {priceRangeOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() =>
                        setFilters(prev => ({ ...prev, priceRange: option.value as any }))
                      }
                      className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.priceRange === option.value
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Popular Tags */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-3'>Popular Tags</label>
              <div className='flex flex-wrap gap-2'>
                {popularTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`flex items-center px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.tags.includes(tag)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <TagIcon className='w-3 h-3 mr-1' />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Summary */}
      <div className='flex justify-between items-center'>
        <p className='text-gray-600'>
          {loading ? 'Loading...' : `${filteredContent.length} content items found`}
        </p>
        {filteredContent.length > 0 && !loading && (
          <p className='text-sm text-gray-500'>
            Showing results for "{debouncedSearchQuery || 'all content'}"
          </p>
        )}
      </div>

      {/* Content Grid/List */}
      {loading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='animate-pulse'>
              <div className='bg-gray-200 aspect-video rounded-lg mb-4'></div>
              <div className='h-4 bg-gray-200 rounded mb-2'></div>
              <div className='h-3 bg-gray-200 rounded w-2/3'></div>
            </div>
          ))}
        </div>
      ) : filteredContent.length > 0 ? (
        <div
          className={`grid gap-6 ${
            viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
          }`}
        >
          {filteredContent.map(item => (
            <ContentCard
              key={item.id}
              content={item}
              viewMode={viewMode}
              onLike={handleLike}
              onSelect={onContentSelect}
            />
          ))}
        </div>
      ) : (
        <div className='text-center py-12'>
          <MagnifyingGlassIcon className='w-12 h-12 text-gray-400 mx-auto mb-4' />
          <p className='text-lg text-gray-600 mb-2'>No content found</p>
          <p className='text-gray-500'>Try adjusting your search terms or filters</p>
          {(searchQuery || filters.type !== 'ALL' || filters.tags.length > 0) && (
            <button
              onClick={clearFilters}
              className='mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors'
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Content Card Component
interface ContentCardProps {
  content: ContentItem;
  viewMode: 'grid' | 'list';
  onLike: (contentId: string) => void;
  onSelect?: (content: ContentItem) => void;
}

function ContentCard({ content, viewMode, onLike, onSelect }: ContentCardProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  if (viewMode === 'list') {
    return (
      <div className='flex space-x-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow'>
        <div className='relative w-32 h-20 flex-shrink-0'>
          <Image
            src={content.thumbnailUrl || '/api/placeholder/400/300'}
            alt={content.title}
            fill
            className='rounded-lg object-cover'
          />
          {content.duration && (
            <span className='absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded'>
              {formatDuration(content.duration)}
            </span>
          )}
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex justify-between items-start mb-2'>
            <h3 className='text-lg font-semibold text-gray-900 truncate'>{content.title}</h3>
            <button
              onClick={() => onLike(content.id)}
              className='flex items-center space-x-1 text-sm text-gray-500 hover:text-red-500 transition-colors ml-4'
            >
              {content.isLiked ? (
                <HeartIconSolid className='w-5 h-5 text-red-500' />
              ) : (
                <HeartIcon className='w-5 h-5' />
              )}
              <span>{formatCount(content.likeCount)}</span>
            </button>
          </div>

          <p className='text-gray-600 text-sm mb-2 line-clamp-2'>{content.description}</p>

          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2 text-sm text-gray-500'>
              <UserIcon className='w-4 h-4' />
              <span>{content.artist.name}</span>
              <span>•</span>
              <EyeIcon className='w-4 h-4' />
              <span>{formatCount(content.viewCount)} views</span>
            </div>

            {content.visibility !== 'PUBLIC' && content.tier && (
              <span className='px-2 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs rounded-full'>
                ${content.tier.price}/month
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className='bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer'
      onClick={() => onSelect?.(content)}
    >
      <div className='relative aspect-video'>
        <Image
          src={content.thumbnailUrl || '/api/placeholder/400/300'}
          alt={content.title}
          fill
          className='object-cover'
        />
        {content.duration && (
          <span className='absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded'>
            {formatDuration(content.duration)}
          </span>
        )}
        {content.visibility !== 'PUBLIC' && (
          <div className='absolute top-2 left-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs px-2 py-1 rounded-full'>
            Premium
          </div>
        )}
      </div>

      <div className='p-4'>
        <h3 className='font-semibold text-gray-900 mb-2 line-clamp-2'>{content.title}</h3>

        <p className='text-gray-600 text-sm mb-3 line-clamp-2'>{content.description}</p>

        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center space-x-2'>
            <div className='w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center'>
              <span className='text-white text-xs font-medium'>
                {content.artist.name.charAt(0)}
              </span>
            </div>
            <div>
              <p className='text-sm font-medium text-gray-900'>{content.artist.name}</p>
              <p className='text-xs text-gray-500'>
                {formatCount(content.artist.subscriberCount)} subscribers
              </p>
            </div>
          </div>

          <button
            onClick={e => {
              e.stopPropagation();
              onLike(content.id);
            }}
            className='flex items-center space-x-1 text-sm text-gray-500 hover:text-red-500 transition-colors'
          >
            {content.isLiked ? (
              <HeartIconSolid className='w-5 h-5 text-red-500' />
            ) : (
              <HeartIcon className='w-5 h-5' />
            )}
            <span>{formatCount(content.likeCount)}</span>
          </button>
        </div>

        <div className='flex flex-wrap gap-1'>
          {content.tags.slice(0, 3).map(tag => (
            <span key={tag} className='px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full'>
              {tag}
            </span>
          ))}
          {content.tags.length > 3 && (
            <span className='px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full'>
              +{content.tags.length - 3} more
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
