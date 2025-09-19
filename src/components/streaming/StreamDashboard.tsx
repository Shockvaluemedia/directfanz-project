'use client';

/**
 * Stream Management Dashboard - Client Component
 *
 * This component provides a comprehensive dashboard for managing live streams:
 * - Browse and discover live streams
 * - Create new streams
 * - Manage user's own streams
 * - View stream analytics and performance
 * - Search and filter streams
 * - Featured and trending streams
 * - Stream categories and recommendations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  HeartIcon,
  ClockIcon,
  CalendarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  FireIcon,
  StarIcon,
  PlayIcon,
  VideoCameraIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  ArrowPathIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  StarIcon as StarIconSolid,
  PlayIcon as PlayIconSolid,
} from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Types
interface Stream {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail?: string;
  status: 'scheduled' | 'starting' | 'live' | 'ending' | 'ended';
  streamer: {
    id: string;
    userName: string;
    displayName: string;
    avatar?: string;
    followers: number;
    isVerified: boolean;
    isOnline: boolean;
  };
  metadata: {
    currentViewers: number;
    totalViews: number;
    duration: number;
    totalDonations: number;
    likes: number;
    shares: number;
    chatMessages: number;
    quality: string[];
    maxQuality: string;
  };
  settings: {
    enableChat: boolean;
    enableDonations: boolean;
    chatModeration: string;
    subscribersOnly: boolean;
    isPrivate: boolean;
  };
  scheduledStart?: Date;
  startedAt?: Date;
  createdAt: Date;
}

interface StreamFilters {
  category: string;
  status: string;
  quality: string;
  sortBy: 'viewers' | 'recent' | 'trending' | 'duration';
  timeRange: 'all' | '24h' | '7d' | '30d';
}

interface StreamStats {
  totalLiveStreams: number;
  totalViewers: number;
  popularCategories: Array<{ name: string; count: number }>;
  trendingStreams: Stream[];
}

const categories = [
  'All',
  'Music',
  'Talk Show',
  'Gaming',
  'Art & Creative',
  'Education',
  'Sports',
  'Technology',
  'Comedy',
  'News',
  'Other',
];

const viewModes = ['grid', 'list'] as const;
type ViewMode = (typeof viewModes)[number];

export default function StreamDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [myStreams, setMyStreams] = useState<Stream[]>([]);
  const [featuredStreams, setFeaturedStreams] = useState<Stream[]>([]);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'discover' | 'my-streams' | 'analytics'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<StreamFilters>({
    category: 'All',
    status: 'all',
    quality: 'all',
    sortBy: 'viewers',
    timeRange: 'all',
  });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Load streams data
  useEffect(() => {
    loadStreams();
    loadStreamStats();

    if (session?.user?.id) {
      loadMyStreams();
    }
  }, [session?.user?.id, filters]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'discover') {
        loadStreams();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, filters]);

  const loadStreams = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        category: filters.category === 'All' ? '' : filters.category,
        status: filters.status === 'all' ? '' : filters.status,
        quality: filters.quality === 'all' ? '' : filters.quality,
        sortBy: filters.sortBy,
        timeRange: filters.timeRange,
        search: searchQuery,
      });

      const response = await fetch(`/api/streams?${params}`);
      const data = await response.json();

      if (data.success) {
        setStreams(data.streams || []);
        setFeaturedStreams(data.featured || []);
      }
    } catch (error) {
      console.error('Failed to load streams:', error);
      toast.error('Failed to load streams');
    } finally {
      setIsLoading(false);
    }
  }, [filters, searchQuery]);

  const loadMyStreams = useCallback(async () => {
    try {
      const response = await fetch('/api/streams/my-streams');
      const data = await response.json();

      if (data.success) {
        setMyStreams(data.streams || []);
      }
    } catch (error) {
      console.error('Failed to load my streams:', error);
    }
  }, []);

  const loadStreamStats = useCallback(async () => {
    try {
      const response = await fetch('/api/streams/stats');
      const data = await response.json();

      if (data.success) {
        setStreamStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stream stats:', error);
    }
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterChange = useCallback((key: keyof StreamFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleStreamClick = useCallback(
    (stream: Stream) => {
      if (stream.status === 'live') {
        router.push(`/stream/${stream.id}`);
      } else {
        // Handle scheduled or ended streams
        toast.info('Stream is not currently live');
      }
    },
    [router]
  );

  const handleCreateStream = useCallback(() => {
    if (!session?.user) {
      toast.error('Please sign in to create a stream');
      return;
    }
    router.push('/studio');
  }, [session?.user, router]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatViewers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const StreamCard = ({ stream, compact = false }: { stream: Stream; compact?: boolean }) => (
    <div
      onClick={() => handleStreamClick(stream)}
      className={cn(
        'bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors cursor-pointer group',
        compact && 'flex gap-3 p-3'
      )}
    >
      <div className={cn('relative', compact ? 'w-24 h-16 flex-shrink-0' : 'aspect-video')}>
        <img
          src={stream.thumbnail || '/default-stream-thumbnail.jpg'}
          alt={stream.title}
          className='w-full h-full object-cover'
        />

        {/* Status Indicator */}
        {stream.status === 'live' && (
          <div className='absolute top-2 left-2 bg-red-600 px-2 py-1 rounded text-xs font-semibold'>
            LIVE
          </div>
        )}

        {stream.status === 'scheduled' && stream.scheduledStart && (
          <div className='absolute top-2 left-2 bg-blue-600 px-2 py-1 rounded text-xs font-semibold'>
            {formatDistanceToNow(stream.scheduledStart, { addSuffix: true })}
          </div>
        )}

        {/* Viewer Count */}
        <div className='absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs flex items-center gap-1'>
          <EyeIcon className='w-3 h-3' />
          <span>{formatViewers(stream.metadata.currentViewers)}</span>
        </div>

        {/* Duration for live streams */}
        {stream.status === 'live' && (
          <div className='absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs'>
            {formatDuration(stream.metadata.duration)}
          </div>
        )}

        {/* Play button overlay */}
        <div className='absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
          <PlayIconSolid className='w-12 h-12 text-white' />
        </div>
      </div>

      <div className={cn('p-4', compact && 'p-0 flex-1')}>
        <div className='flex items-start gap-3'>
          <img
            src={stream.streamer.avatar || '/default-avatar.png'}
            alt={stream.streamer.displayName}
            className={cn('rounded-full flex-shrink-0', compact ? 'w-6 h-6' : 'w-8 h-8')}
          />

          <div className='flex-1 min-w-0'>
            <h3 className={cn('font-semibold truncate', compact ? 'text-sm' : 'text-base')}>
              {stream.title}
            </h3>

            <p
              className={cn(
                'text-gray-400 flex items-center gap-1',
                compact ? 'text-xs' : 'text-sm'
              )}
            >
              <span>{stream.streamer.displayName}</span>
              {stream.streamer.isVerified && <span className='text-blue-500'>✓</span>}
            </p>

            <div className={cn('flex items-center gap-4 mt-1', compact ? 'text-xs' : 'text-sm')}>
              <span className='text-gray-500'>{stream.category}</span>

              <div className='flex items-center gap-1 text-gray-500'>
                <HeartIcon className='w-3 h-3' />
                <span>{formatViewers(stream.metadata.likes)}</span>
              </div>

              {stream.metadata.totalDonations > 0 && (
                <div className='flex items-center gap-1 text-green-400'>
                  <CurrencyDollarIcon className='w-3 h-3' />
                  <span>{stream.metadata.totalDonations}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className='min-h-screen bg-gray-900 text-white'>
      {/* Header */}
      <div className='bg-gray-800 border-b border-gray-700 sticky top-0 z-40'>
        <div className='max-w-7xl mx-auto px-4 py-4'>
          <div className='flex items-center justify-between mb-4'>
            <h1 className='text-2xl font-bold'>Streams Dashboard</h1>

            <div className='flex items-center gap-4'>
              {session?.user && (
                <button
                  onClick={handleCreateStream}
                  className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                >
                  <PlusIcon className='w-5 h-5' />
                  Create Stream
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className='flex items-center gap-6'>
            {[
              { id: 'discover', label: 'Discover', icon: MagnifyingGlassIcon },
              { id: 'my-streams', label: 'My Streams', icon: VideoCameraIcon },
              { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                )}
              >
                <tab.icon className='w-5 h-5' />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 py-6'>
        {/* Discover Tab */}
        {activeTab === 'discover' && (
          <div className='space-y-6'>
            {/* Search and Filters */}
            <div className='flex flex-col md:flex-row gap-4'>
              <div className='flex-1 relative'>
                <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search streams...'
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  className='w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>

              <div className='flex items-center gap-3'>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className='flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors'
                >
                  <FunnelIcon className='w-5 h-5' />
                  Filters
                </button>

                <div className='flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden'>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-3 transition-colors',
                      viewMode === 'grid' ? 'bg-blue-600' : 'hover:bg-gray-700'
                    )}
                  >
                    <Squares2X2Icon className='w-5 h-5' />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-3 transition-colors',
                      viewMode === 'list' ? 'bg-blue-600' : 'hover:bg-gray-700'
                    )}
                  >
                    <ListBulletIcon className='w-5 h-5' />
                  </button>
                </div>

                <button
                  onClick={loadStreams}
                  className='p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors'
                >
                  <ArrowPathIcon className='w-5 h-5' />
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className='bg-gray-800 rounded-lg p-4 border border-gray-700'>
                <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                  <div>
                    <label className='block text-sm font-medium mb-2'>Category</label>
                    <select
                      value={filters.category}
                      onChange={e => handleFilterChange('category', e.target.value)}
                      className='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500'
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-2'>Status</label>
                    <select
                      value={filters.status}
                      onChange={e => handleFilterChange('status', e.target.value)}
                      className='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500'
                    >
                      <option value='all'>All Status</option>
                      <option value='live'>Live</option>
                      <option value='scheduled'>Scheduled</option>
                      <option value='ended'>Ended</option>
                    </select>
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-2'>Sort By</label>
                    <select
                      value={filters.sortBy}
                      onChange={e => handleFilterChange('sortBy', e.target.value)}
                      className='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500'
                    >
                      <option value='viewers'>Most Viewers</option>
                      <option value='recent'>Recently Started</option>
                      <option value='trending'>Trending</option>
                      <option value='duration'>Longest Running</option>
                    </select>
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-2'>Time Range</label>
                    <select
                      value={filters.timeRange}
                      onChange={e => handleFilterChange('timeRange', e.target.value)}
                      className='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500'
                    >
                      <option value='all'>All Time</option>
                      <option value='24h'>Last 24 Hours</option>
                      <option value='7d'>Last 7 Days</option>
                      <option value='30d'>Last 30 Days</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Overview */}
            {streamStats && (
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <div className='bg-gray-800 rounded-lg p-6'>
                  <div className='flex items-center gap-3'>
                    <div className='p-3 bg-blue-600 rounded-full'>
                      <VideoCameraIcon className='w-6 h-6' />
                    </div>
                    <div>
                      <p className='text-2xl font-bold'>{streamStats.totalLiveStreams}</p>
                      <p className='text-sm text-gray-400'>Live Streams</p>
                    </div>
                  </div>
                </div>

                <div className='bg-gray-800 rounded-lg p-6'>
                  <div className='flex items-center gap-3'>
                    <div className='p-3 bg-green-600 rounded-full'>
                      <EyeIcon className='w-6 h-6' />
                    </div>
                    <div>
                      <p className='text-2xl font-bold'>
                        {formatViewers(streamStats.totalViewers)}
                      </p>
                      <p className='text-sm text-gray-400'>Total Viewers</p>
                    </div>
                  </div>
                </div>

                <div className='bg-gray-800 rounded-lg p-6'>
                  <div className='flex items-center gap-3'>
                    <div className='p-3 bg-red-600 rounded-full'>
                      <FireIcon className='w-6 h-6' />
                    </div>
                    <div>
                      <p className='text-lg font-bold'>
                        {streamStats.popularCategories[0]?.name || 'N/A'}
                      </p>
                      <p className='text-sm text-gray-400'>Top Category</p>
                    </div>
                  </div>
                </div>

                <div className='bg-gray-800 rounded-lg p-6'>
                  <div className='flex items-center gap-3'>
                    <div className='p-3 bg-yellow-600 rounded-full'>
                      <StarIcon className='w-6 h-6' />
                    </div>
                    <div>
                      <p className='text-2xl font-bold'>{streamStats.trendingStreams.length}</p>
                      <p className='text-sm text-gray-400'>Trending</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Featured Streams */}
            {featuredStreams.length > 0 && (
              <div>
                <h2 className='text-xl font-bold mb-4 flex items-center gap-2'>
                  <StarIconSolid className='w-6 h-6 text-yellow-500' />
                  Featured Streams
                </h2>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {featuredStreams.map(stream => (
                    <StreamCard key={stream.id} stream={stream} />
                  ))}
                </div>
              </div>
            )}

            {/* Live Streams */}
            <div>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-xl font-bold flex items-center gap-2'>
                  <PlayIconSolid className='w-6 h-6 text-red-500' />
                  Live Streams
                </h2>
                <p className='text-gray-400'>{streams.length} streams</p>
              </div>

              {isLoading ? (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className='bg-gray-800 rounded-lg animate-pulse'>
                      <div className='aspect-video bg-gray-700'></div>
                      <div className='p-4 space-y-3'>
                        <div className='h-4 bg-gray-700 rounded w-3/4'></div>
                        <div className='h-3 bg-gray-700 rounded w-1/2'></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : streams.length === 0 ? (
                <div className='text-center py-12'>
                  <VideoCameraIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
                  <p className='text-gray-400 text-lg'>No streams found</p>
                  <p className='text-gray-500'>Try adjusting your filters or search terms</p>
                </div>
              ) : (
                <div
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                      : 'space-y-4'
                  )}
                >
                  {streams.map(stream => (
                    <StreamCard key={stream.id} stream={stream} compact={viewMode === 'list'} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Streams Tab */}
        {activeTab === 'my-streams' && (
          <div className='space-y-6'>
            {!session?.user ? (
              <div className='text-center py-12'>
                <VideoCameraIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
                <p className='text-gray-400 text-lg'>Sign in to view your streams</p>
              </div>
            ) : myStreams.length === 0 ? (
              <div className='text-center py-12'>
                <VideoCameraIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
                <p className='text-gray-400 text-lg'>No streams yet</p>
                <button
                  onClick={handleCreateStream}
                  className='mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                >
                  Create Your First Stream
                </button>
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {myStreams.map(stream => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className='space-y-6'>
            <div className='text-center py-12'>
              <ChartBarIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
              <p className='text-gray-400 text-lg'>Analytics Coming Soon</p>
              <p className='text-gray-500'>Detailed analytics and insights for your streams</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
