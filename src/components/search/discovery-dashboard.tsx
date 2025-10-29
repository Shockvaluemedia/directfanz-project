'use client';

import React, { useState } from 'react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { useTrending, useRecommendations, useFeaturedContent } from '@/hooks/use-search';
import {
  TrendingUp,
  TrendingDown,
  Fire,
  Star,
  Eye,
  Heart,
  Play,
  Users,
  Clock,
  Calendar,
  ChevronRight,
  Sparkles,
  Crown,
  Zap,
  Search,
  Filter,
  Grid,
  List
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

interface DiscoveryDashboardProps {
  userId: string;
  className?: string;
  onContentClick?: (content: any) => void;
  onCreatorClick?: (creator: any) => void;
}

export function DiscoveryDashboard({ 
  userId, 
  className, 
  onContentClick, 
  onCreatorClick 
}: DiscoveryDashboardProps) {
  const { data: trending, isLoading: trendingLoading } = useTrending();
  const { data: recommendations, isLoading: recommendationsLoading } = useRecommendations(userId);
  const { data: featured, isLoading: featuredLoading } = useFeaturedContent();

  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = [
    { id: 'all', name: 'All', icon: Grid },
    { id: 'music', name: 'Music', icon: Play },
    { id: 'art', name: 'Art', icon: Sparkles },
    { id: 'fitness', name: 'Fitness', icon: Zap },
    { id: 'gaming', name: 'Gaming', icon: Star },
    { id: 'education', name: 'Education', icon: Star }
  ];

  return (
    <div className={cn("space-y-8", className)}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover Amazing Content</h1>
        <p className="text-gray-600">Explore trending topics, featured creators, and personalized recommendations</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg text-white">
          <div className="text-2xl font-bold">2.4K</div>
          <div className="text-sm opacity-90">Live Streams</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white">
          <div className="text-2xl font-bold">156K</div>
          <div className="text-sm opacity-90">New Content</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-lg text-white">
          <div className="text-2xl font-bold">89K</div>
          <div className="text-sm opacity-90">Active Creators</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
          <div className="text-2xl font-bold">1.2M</div>
          <div className="text-sm opacity-90">Community Members</div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map(({ id, name, icon: Icon }) => (
          <EnhancedButton
            key={id}
            variant={activeCategory === id ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveCategory(id)}
            className="flex items-center gap-2"
          >
            <Icon className="w-4 h-4" />
            {name}
          </EnhancedButton>
        ))}
      </div>

      {/* Trending Section */}
      <TrendingSection
        trending={trending}
        loading={trendingLoading}
        onItemClick={(item) => {
          if (item.type === 'creator') {
            onCreatorClick?.(item);
          } else {
            onContentClick?.(item);
          }
        }}
      />

      {/* Featured Content */}
      <FeaturedSection
        featured={featured}
        loading={featuredLoading}
        onContentClick={onContentClick}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Personalized Recommendations */}
      <RecommendationsSection
        recommendations={recommendations}
        loading={recommendationsLoading}
        onContentClick={onContentClick}
      />

      {/* Live Streams */}
      <LiveStreamsSection />

      {/* Rising Creators */}
      <RisingCreatorsSection onCreatorClick={onCreatorClick} />
    </div>
  );
}

// Trending Section
interface TrendingSectionProps {
  trending: any;
  loading: boolean;
  onItemClick: (item: any) => void;
}

function TrendingSection({ trending, loading, onItemClick }: TrendingSectionProps) {
  if (loading) {
    return (
      <EnhancedCard variant="elevated">
        <EnhancedCardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>
    );
  }

  return (
    <EnhancedCard variant="elevated">
      <EnhancedCardHeader>
        <EnhancedCardTitle className="flex items-center gap-2">
          <Fire className="w-5 h-5 text-orange-500" />
          Trending Now
        </EnhancedCardTitle>
      </EnhancedCardHeader>
      <EnhancedCardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trending?.map((item: any, index: number) => (
            <div
              key={item.id}
              onClick={() => onItemClick(item)}
              className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  index < 3 ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white" :
                  "bg-gray-100 text-gray-600"
                )}>
                  {index + 1}
                </div>
                {item.change > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>

              {item.thumbnailUrl && (
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="capitalize">{item.type}</span>
                  {item.creator && <span>• by {item.creator}</span>}
                  <span className={cn(
                    "ml-auto font-medium",
                    item.change > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {item.change > 0 ? '+' : ''}{item.change}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Featured Section
interface FeaturedSectionProps {
  featured: any;
  loading: boolean;
  onContentClick?: (content: any) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

function FeaturedSection({ 
  featured, 
  loading, 
  onContentClick, 
  viewMode, 
  onViewModeChange 
}: FeaturedSectionProps) {
  if (loading) {
    return (
      <EnhancedCard variant="elevated">
        <EnhancedCardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="aspect-video bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>
    );
  }

  return (
    <EnhancedCard variant="elevated">
      <EnhancedCardHeader>
        <div className="flex items-center justify-between">
          <EnhancedCardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            Featured Content
          </EnhancedCardTitle>
          <div className="flex items-center gap-2">
            <EnhancedButton
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
            >
              <Grid className="w-4 h-4" />
            </EnhancedButton>
            <EnhancedButton
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('list')}
            >
              <List className="w-4 h-4" />
            </EnhancedButton>
          </div>
        </div>
      </EnhancedCardHeader>
      <EnhancedCardContent>
        <div className={cn(
          viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-4"
        )}>
          {featured?.slice(0, 6).map((item: any) => (
            <div
              key={item.id}
              onClick={() => onContentClick?.(item)}
              className={cn(
                "cursor-pointer group",
                viewMode === 'grid' 
                  ? "space-y-3"
                  : "flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg"
              )}
            >
              <div className={cn(
                "relative overflow-hidden rounded-lg",
                viewMode === 'grid' 
                  ? "aspect-video"
                  : "w-24 h-16 flex-shrink-0"
              )}>
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {item.isPremium && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded">
                    PREMIUM
                  </div>
                )}
                {item.duration && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black bg-opacity-75 text-white text-xs rounded">
                    {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {item.title}
                </h3>
                {item.creator && (
                  <div className="flex items-center gap-2 mt-1">
                    <img
                      src={item.creator.avatar}
                      alt={item.creator.name}
                      className="w-4 h-4 rounded-full"
                    />
                    <span className="text-sm text-gray-600">{item.creator.name}</span>
                  </div>
                )}
                {item.metrics && (
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {item.metrics.views.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {item.metrics.likes.toLocaleString()}
                    </span>
                    {item.metrics.rating && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        {item.metrics.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 text-center">
          <EnhancedButton variant="ghost" className="flex items-center gap-2 mx-auto">
            View All Featured Content
            <ChevronRight className="w-4 h-4" />
          </EnhancedButton>
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Recommendations Section
interface RecommendationsSectionProps {
  recommendations: any;
  loading: boolean;
  onContentClick?: (content: any) => void;
}

function RecommendationsSection({ 
  recommendations, 
  loading, 
  onContentClick 
}: RecommendationsSectionProps) {
  if (loading) {
    return (
      <EnhancedCard variant="elevated">
        <EnhancedCardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="flex gap-4 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-64">
                  <div className="aspect-video bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>
    );
  }

  return (
    <EnhancedCard variant="elevated">
      <EnhancedCardHeader>
        <EnhancedCardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Recommended For You
        </EnhancedCardTitle>
      </EnhancedCardHeader>
      <EnhancedCardContent>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {recommendations?.map((item: any) => (
            <div
              key={item.id}
              onClick={() => onContentClick?.(item)}
              className="flex-shrink-0 w-64 cursor-pointer group"
            >
              <div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden mb-3">
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {item.isPremium && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded">
                    PREMIUM
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors mb-1">
                {item.title}
              </h3>
              {item.creator && (
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={item.creator.avatar}
                    alt={item.creator.name}
                    className="w-4 h-4 rounded-full"
                  />
                  <span className="text-sm text-gray-600">{item.creator.name}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Eye className="w-3 h-3" />
                <span>{item.metrics?.views.toLocaleString()} views</span>
              </div>
            </div>
          ))}
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Live Streams Section
function LiveStreamsSection() {
  // Mock live streams data
  const liveStreams = [
    {
      id: '1',
      title: 'Music Production Live Session',
      creator: { name: 'BeatMaker Pro', avatar: 'https://picsum.photos/100/100?random=20' },
      viewers: 1250,
      category: 'Music',
      thumbnail: 'https://picsum.photos/400/300?random=20'
    },
    {
      id: '2',
      title: 'Digital Art Speed Painting',
      creator: { name: 'ArtMaster', avatar: 'https://picsum.photos/100/100?random=21' },
      viewers: 890,
      category: 'Art',
      thumbnail: 'https://picsum.photos/400/300?random=21'
    },
    {
      id: '3',
      title: 'Fitness Morning Routine',
      creator: { name: 'FitLife Coach', avatar: 'https://picsum.photos/100/100?random=22' },
      viewers: 567,
      category: 'Fitness',
      thumbnail: 'https://picsum.photos/400/300?random=22'
    }
  ];

  return (
    <EnhancedCard variant="elevated">
      <EnhancedCardHeader>
        <EnhancedCardTitle className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          Live Now
        </EnhancedCardTitle>
      </EnhancedCardHeader>
      <EnhancedCardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveStreams.map((stream) => (
            <div key={stream.id} className="group cursor-pointer">
              <div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden mb-3">
                <img
                  src={stream.thumbnail}
                  alt={stream.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute top-2 left-2 flex items-center gap-2">
                  <div className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    LIVE
                  </div>
                  <div className="px-2 py-1 bg-black bg-opacity-75 text-white text-xs rounded">
                    {stream.viewers.toLocaleString()}
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="absolute bottom-4 left-4 right-4">
                    <EnhancedButton size="sm" className="w-full">
                      <Play className="w-4 h-4 mr-2" />
                      Watch Live
                    </EnhancedButton>
                  </div>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors mb-1">
                {stream.title}
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={stream.creator.avatar}
                    alt={stream.creator.name}
                    className="w-4 h-4 rounded-full"
                  />
                  <span className="text-sm text-gray-600">{stream.creator.name}</span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {stream.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Rising Creators Section
interface RisingCreatorsSectionProps {
  onCreatorClick?: (creator: any) => void;
}

function RisingCreatorsSection({ onCreatorClick }: RisingCreatorsSectionProps) {
  // Mock rising creators data
  const risingCreators = [
    {
      id: '1',
      name: 'Emma Creative',
      avatar: 'https://picsum.photos/100/100?random=30',
      category: 'Art',
      followers: 15420,
      growth: 156,
      verified: true,
      recentContent: 'https://picsum.photos/400/300?random=30'
    },
    {
      id: '2',
      name: 'Tech Guru Mike',
      avatar: 'https://picsum.photos/100/100?random=31',
      category: 'Education',
      followers: 8930,
      growth: 89,
      verified: false,
      recentContent: 'https://picsum.photos/400/300?random=31'
    },
    {
      id: '3',
      name: 'Melody Maker',
      avatar: 'https://picsum.photos/100/100?random=32',
      category: 'Music',
      followers: 23150,
      growth: 234,
      verified: true,
      recentContent: 'https://picsum.photos/400/300?random=32'
    }
  ];

  return (
    <EnhancedCard variant="elevated">
      <EnhancedCardHeader>
        <EnhancedCardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Rising Creators
        </EnhancedCardTitle>
      </EnhancedCardHeader>
      <EnhancedCardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {risingCreators.map((creator) => (
            <div
              key={creator.id}
              onClick={() => onCreatorClick?.(creator)}
              className="text-center group cursor-pointer"
            >
              <div className="relative mb-4">
                <img
                  src={creator.avatar}
                  alt={creator.name}
                  className="w-20 h-20 rounded-full mx-auto mb-3 group-hover:scale-105 transition-transform duration-200"
                />
                {creator.verified && (
                  <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {creator.name}
              </h3>
              <p className="text-sm text-gray-600 mb-2">{creator.category}</p>
              
              <div className="flex items-center justify-center gap-4 text-sm mb-4">
                <div>
                  <div className="font-semibold text-gray-900">{creator.followers.toLocaleString()}</div>
                  <div className="text-gray-500">Followers</div>
                </div>
                <div>
                  <div className="font-semibold text-green-600">+{creator.growth}</div>
                  <div className="text-gray-500">This week</div>
                </div>
              </div>
              
              <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden mb-3">
                <img
                  src={creator.recentContent}
                  alt="Recent content"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              
              <EnhancedButton variant="ghost" size="sm" className="w-full">
                <Users className="w-4 h-4 mr-2" />
                Follow
              </EnhancedButton>
            </div>
          ))}
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}