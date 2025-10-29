'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  PlayIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  type: 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT';
  fileUrl: string;
  thumbnailUrl: string | null;
  fileSize: number;
  format: string;
  tags: string[];
  visibility: 'PUBLIC' | 'PRIVATE' | 'TIER_LOCKED';
  createdAt: string;
  updatedAt: string;
  views: number;
  likes: number;
  hasLiked: boolean;
  commentsCount: number;
  artist: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  tier?: {
    id: string;
    name: string;
  };
}

interface FeedResponse {
  success: boolean;
  data: {
    content: ContentItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export default function FeedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [feedType, setFeedType] = useState<'subscriptions' | 'discover' | 'trending'>('subscriptions');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (session.user.role !== 'FAN') {
      router.push('/dashboard/artist');
      return;
    }
    
    fetchContent();
  }, [session, status, router, currentPage, searchQuery, typeFilter, feedType]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
        feedType,
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/fan/feed?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }

      const data: FeedResponse = await response.json();
      setContent(data.data.content);
      setTotalPages(data.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (contentId: string) => {
    try {
      const response = await fetch(`/api/content/${contentId}/like`, {
        method: 'POST',
      });

      if (response.ok) {
        setContent(prev => prev.map(item => 
          item.id === contentId 
            ? { 
                ...item, 
                hasLiked: !item.hasLiked,
                likes: item.hasLiked ? item.likes - 1 : item.likes + 1
              }
            : item
        ));
      }
    } catch (error) {
      console.error('Error liking content:', error);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'VIDEO': return '🎥';
      case 'AUDIO': return '🎵';
      case 'IMAGE': return '🖼️';
      default: return '📄';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const formatViews = (views: number) => {
    if (views < 1000) return views.toString();
    if (views < 1000000) return `${(views / 1000).toFixed(1)}K`;
    return `${(views / 1000000).toFixed(1)}M`;
  };

  const parseTags = (tags: string | string[]) => {
    if (Array.isArray(tags)) return tags;
    try {
      return JSON.parse(tags || '[]');
    } catch {
      return [];
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session || session.user.role !== 'FAN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Content Feed</h1>
          <p className="mt-2 text-gray-600">Discover amazing content from artists you love</p>
        </div>

        {/* Feed Type Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'subscriptions', label: 'My Subscriptions', icon: '❤️' },
              { key: 'discover', label: 'Discover', icon: '🌟' },
              { key: 'trending', label: 'Trending', icon: '🔥' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setFeedType(tab.key as typeof feedType);
                  setCurrentPage(1);
                }}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  feedType === tab.key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="VIDEO">Videos</option>
                <option value="AUDIO">Audio</option>
                <option value="IMAGE">Images</option>
                <option value="DOCUMENT">Documents</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-200"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : content.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <div className="text-6xl mb-4">
              {feedType === 'subscriptions' ? '❤️' : feedType === 'discover' ? '🌟' : '🔥'}
            </div>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No content found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {feedType === 'subscriptions' && !searchQuery && typeFilter === 'all'
                ? 'Subscribe to artists to see their content here'
                : searchQuery || typeFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Check back later for new content'
              }
            </p>
            {feedType === 'subscriptions' && !searchQuery && typeFilter === 'all' && (
              <div className="mt-6">
                <button
                  onClick={() => router.push('/discover')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Discover Artists
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.map((item) => {
              const tags = parseTags(item.tags);
              
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer group"
                  onClick={() => router.push(`/content/${item.id}`)}
                >
                  {/* Content Thumbnail/Preview */}
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <span className="text-4xl">{getContentIcon(item.type)}</span>
                      </div>
                    )}
                    
                    {/* Play Button Overlay */}
                    {(item.type === 'VIDEO' || item.type === 'AUDIO') && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300">
                        <div className="w-16 h-16 rounded-full bg-white bg-opacity-90 flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300">
                          <PlayIcon className="h-8 w-8 text-gray-800 ml-1" />
                        </div>
                      </div>
                    )}

                    {/* Type Badge */}
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-black bg-opacity-60 text-white">
                        {item.type.toLowerCase()}
                      </span>
                    </div>

                    {/* Tier Badge */}
                    {item.tier && (
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-purple-600 text-white">
                          {item.tier.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content Details */}
                  <div className="p-4">
                    {/* Title & Description */}
                    <h3 className="font-semibold text-gray-900 truncate mb-1">
                      {item.title}
                    </h3>
                    
                    {item.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    )}

                    {/* Artist Info */}
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                        {item.artist.avatar ? (
                          <img
                            src={item.artist.avatar}
                            alt={item.artist.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-2 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.artist.displayName}
                        </p>
                        <div className="flex items-center text-xs text-gray-500">
                          <ClockIcon className="h-3 w-3 mr-1" />
                          {formatDate(item.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {tags.slice(0, 3).map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            +{tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Engagement Metrics */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <EyeIcon className="h-4 w-4 mr-1" />
                          {formatViews(item.views)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(item.id);
                          }}
                          className="flex items-center hover:text-red-500 transition-colors"
                        >
                          {item.hasLiked ? (
                            <HeartSolid className="h-4 w-4 mr-1 text-red-500" />
                          ) : (
                            <HeartIcon className="h-4 w-4 mr-1" />
                          )}
                          {item.likes}
                        </button>
                        <div className="flex items-center">
                          <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                          {item.commentsCount}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex space-x-2">
              {currentPage > 1 && (
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Previous
                </button>
              )}
              
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => 
                  page === 1 || 
                  page === totalPages || 
                  Math.abs(page - currentPage) <= 2
                )
                .map((page, index, array) => (
                  <React.Fragment key={page}>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-3 py-2 text-sm text-gray-500">...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 text-sm border rounded-md ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
              
              {currentPage < totalPages && (
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}