'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Fire,
  Star,
  Eye,
  Clock,
  Heart,
  Bookmark,
  Share,
  MoreHorizontal,
  Play,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Crown,
  Verified,
  Filter,
  Grid,
  List,
  RefreshCw,
  Zap,
  Award,
  Calendar,
  MapPin,
  Tag,
  ThumbsUp,
  MessageCircle,
  Download,
  Settings,
  Sparkles,
  Target,
  Globe,
  Shuffle,
  ArrowUp
} from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface ContentItem {
  id: string;
  type: 'video' | 'photo' | 'live' | 'audio' | 'collection';
  title: string;
  description?: string;
  thumbnail: string;
  preview?: string;
  duration?: number;
  creator: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    tier: 'free' | 'premium' | 'vip';
    followers: number;
  };
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    rating: number;
    price: number;
  };
  tags: string[];
  category: string;
  createdAt: Date;
  isLive?: boolean;
  isTrending?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  isExclusive?: boolean;
  trendingScore?: number;
}

interface DiscoverySection {
  id: string;
  title: string;
  description: string;
  type: 'trending' | 'featured' | 'recent' | 'popular' | 'recommended' | 'category';
  items: ContentItem[];
  layout: 'carousel' | 'grid' | 'masonry' | 'list';
  priority: number;
  refreshable: boolean;
  viewAll?: boolean;
}

interface DiscoveryFeedProps {
  userId?: string;
  preferences?: {
    categories: string[];
    excludeExplicit: boolean;
    preferredCreators: string[];
    interests: string[];
  };
  onContentClick?: (content: ContentItem) => void;
  onCreatorClick?: (creatorId: string) => void;
  onLike?: (contentId: string) => void;
  onBookmark?: (contentId: string) => void;
  onShare?: (contentId: string) => void;
  className?: string;
}

// Mock data generator
const generateMockContent = (count: number): ContentItem[] => {
  const categories = ['fitness', 'cooking', 'art', 'music', 'gaming', 'lifestyle', 'education', 'comedy', 'travel', 'fashion'];
  const creators = [
    { name: 'Sarah Fitness', verified: true, tier: 'vip' as const },
    { name: 'Chef Marcus', verified: true, tier: 'premium' as const },
    { name: 'Digital Artist', verified: false, tier: 'free' as const },
    { name: 'Travel Blogger', verified: true, tier: 'premium' as const },
    { name: 'Music Producer', verified: true, tier: 'vip' as const }
  ];

  return Array.from({ length: count }, (_, i) => {
    const creator = creators[Math.floor(Math.random() * creators.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    return {
      id: `content-${i + 1}`,
      type: ['video', 'photo', 'audio'][Math.floor(Math.random() * 3)] as 'video' | 'photo' | 'audio',
      title: `Amazing ${category} content ${i + 1}`,
      description: `This is an engaging piece of ${category} content that showcases amazing techniques and creativity.`,
      thumbnail: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 500000000)}?w=400&h=300&fit=crop`,
      duration: Math.floor(Math.random() * 3600),
      creator: {
        id: `creator-${i % 5 + 1}`,
        name: creator.name,
        avatar: `https://images.unsplash.com/photo-${1400000000000 + Math.floor(Math.random() * 500000000)}?w=50&h=50&fit=crop&crop=face`,
        verified: creator.verified,
        tier: creator.tier,
        followers: Math.floor(Math.random() * 100000)
      },
      stats: {
        views: Math.floor(Math.random() * 100000),
        likes: Math.floor(Math.random() * 10000),
        comments: Math.floor(Math.random() * 1000),
        shares: Math.floor(Math.random() * 500),
        rating: 3.5 + Math.random() * 1.5,
        price: Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0
      },
      tags: [category, 'trending', 'popular'].slice(0, Math.floor(Math.random() * 3) + 1),
      category,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      isTrending: Math.random() > 0.8,
      isFeatured: Math.random() > 0.9,
      isNew: Math.random() > 0.85,
      isExclusive: Math.random() > 0.95,
      trendingScore: Math.random()
    };
  });
};

const mockSections: DiscoverySection[] = [
  {
    id: 'trending',
    title: 'Trending Now',
    description: 'Hot content that everyone is talking about',
    type: 'trending',
    items: [],
    layout: 'carousel',
    priority: 1,
    refreshable: true,
    viewAll: true
  },
  {
    id: 'featured',
    title: 'Featured Content',
    description: 'Handpicked premium content from top creators',
    type: 'featured',
    items: [],
    layout: 'grid',
    priority: 2,
    refreshable: true,
    viewAll: true
  },
  {
    id: 'recommended',
    title: 'Recommended for You',
    description: 'Personalized picks based on your interests',
    type: 'recommended',
    items: [],
    layout: 'masonry',
    priority: 3,
    refreshable: true,
    viewAll: true
  },
  {
    id: 'recent',
    title: 'Fresh & New',
    description: 'Latest uploads from your favorite creators',
    type: 'recent',
    items: [],
    layout: 'list',
    priority: 4,
    refreshable: true,
    viewAll: true
  }
];

export function DiscoveryFeed({
  userId = 'user123',
  preferences,
  onContentClick,
  onCreatorClick,
  onLike,
  onBookmark,
  onShare,
  className = ''
}: DiscoveryFeedProps) {
  const [sections, setSections] = useState<DiscoverySection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingSections, setRefreshingSections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'feed' | 'explore'>('feed');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [likedItems, setLikedItems] = useLocalStorage<Set<string>>('discovery-likes', new Set());
  const [bookmarkedItems, setBookmarkedItems] = useLocalStorage<Set<string>>('discovery-bookmarks', new Set());
  const [viewedItems, setViewedItems] = useLocalStorage<Set<string>>('discovery-viewed', new Set());

  const feedRef = useRef<HTMLDivElement>(null);
  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  // Load initial content
  useEffect(() => {
    loadDiscoveryContent();
  }, [userId, preferences]);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadDiscoveryContent = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API call with different content for each section
      const loadedSections = await Promise.all(
        mockSections.map(async (section) => {
          const mockContent = generateMockContent(12);
          
          // Filter content based on section type
          let filteredContent = mockContent;
          
          switch (section.type) {
            case 'trending':
              filteredContent = mockContent
                .filter(item => item.isTrending)
                .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
              break;
            case 'featured':
              filteredContent = mockContent.filter(item => item.isFeatured);
              break;
            case 'recent':
              filteredContent = mockContent.sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              break;
            case 'popular':
              filteredContent = mockContent.sort((a, b) => b.stats.views - a.stats.views);
              break;
            case 'recommended':
              // Apply user preferences if available
              if (preferences?.categories.length) {
                filteredContent = mockContent.filter(item => 
                  preferences.categories.includes(item.category)
                );
              }
              break;
          }

          return {
            ...section,
            items: filteredContent.slice(0, section.layout === 'carousel' ? 8 : 12)
          };
        })
      );

      setSections(loadedSections.filter(section => section.items.length > 0));
      announce(`Loaded ${loadedSections.length} discovery sections`, 'polite');
    } catch (error) {
      console.error('Error loading discovery content:', error);
      announce('Failed to load discovery content', 'assertive');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSection = async (sectionId: string) => {
    setRefreshingSections(prev => new Set([...prev, sectionId]));
    
    try {
      // Simulate refreshing content
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newContent = generateMockContent(12);
      setSections(prev => 
        prev.map(section => 
          section.id === sectionId 
            ? { ...section, items: newContent.slice(0, section.layout === 'carousel' ? 8 : 12) }
            : section
        )
      );
      
      announce(`Refreshed ${sectionId} section`, 'polite');
    } catch (error) {
      console.error(`Error refreshing ${sectionId}:`, error);
    } finally {
      setRefreshingSections(prev => {
        const newSet = new Set(prev);
        newSet.delete(sectionId);
        return newSet;
      });
    }
  };

  const handleContentClick = (content: ContentItem) => {
    setViewedItems(prev => new Set([...prev, content.id]));
    
    if (onContentClick) {
      onContentClick(content);
    }
    
    announce(`Opening ${content.title}`, 'polite');
  };

  const handleLike = (contentId: string) => {
    setLikedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contentId)) {
        newSet.delete(contentId);
      } else {
        newSet.add(contentId);
      }
      return newSet;
    });

    if (onLike) {
      onLike(contentId);
    }
  };

  const handleBookmark = (contentId: string) => {
    setBookmarkedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contentId)) {
        newSet.delete(contentId);
      } else {
        newSet.add(contentId);
      }
      return newSet;
    });

    if (onBookmark) {
      onBookmark(contentId);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContentCard = (content: ContentItem, size: 'small' | 'medium' | 'large' = 'medium') => {
    const isLiked = likedItems.has(content.id);
    const isBookmarked = bookmarkedItems.has(content.id);
    const isViewed = viewedItems.has(content.id);

    const sizeClasses = {
      small: 'w-48',
      medium: 'w-64',
      large: 'w-80'
    };

    return (
      <motion.div
        key={content.id}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02, y: -2 }}
        className={`${sizeClasses[size]} flex-shrink-0 bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer group transition-all duration-300 ${
          isViewed ? 'opacity-80' : ''
        }`}
        onClick={() => handleContentClick(content)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          <img
            src={content.thumbnail}
            alt={content.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          
          {/* Overlay badges */}
          <div className="absolute top-2 left-2 flex gap-1">
            {content.isLive && (
              <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">
                LIVE
              </span>
            )}
            {content.isTrending && (
              <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-full flex items-center">
                <Fire className="w-3 h-3 mr-1" />
                TRENDING
              </span>
            )}
            {content.isNew && (
              <span className="px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-full">
                NEW
              </span>
            )}
            {content.isExclusive && (
              <span className="px-2 py-1 text-xs font-bold bg-purple-500 text-white rounded-full">
                EXCLUSIVE
              </span>
            )}
          </div>

          {/* Duration */}
          {content.duration && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
              {Math.floor(content.duration / 60)}:{(content.duration % 60).toString().padStart(2, '0')}
            </div>
          )}

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Play className="w-6 h-6 text-gray-800 ml-0.5" />
            </div>
          </div>

          {/* Price */}
          {content.stats.price > 0 && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
              ${content.stats.price}
            </div>
          )}
        </div>

        {/* Content Info */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
            {content.title}
          </h3>

          {/* Creator */}
          <div 
            className="flex items-center space-x-2 mb-3 cursor-pointer hover:bg-gray-50 p-1 -m-1 rounded"
            onClick={(e) => {
              e.stopPropagation();
              if (onCreatorClick) {
                onCreatorClick(content.creator.id);
              }
            }}
          >
            <img
              src={content.creator.avatar}
              alt={content.creator.name}
              className="w-6 h-6 rounded-full"
            />
            <div className="flex items-center space-x-1 flex-1 min-w-0">
              <span className="text-sm text-gray-600 truncate">{content.creator.name}</span>
              {content.creator.verified && (
                <Verified className="w-4 h-4 text-blue-500 flex-shrink-0" />
              )}
              {content.creator.tier === 'vip' && (
                <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{content.stats.views.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span>{content.stats.rating.toFixed(1)}</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {new Date(content.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {content.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike(content.id);
                }}
                className={`p-2 rounded-full transition-colors ${
                  isLiked 
                    ? 'bg-red-50 text-red-600' 
                    : 'hover:bg-gray-50 text-gray-400'
                }`}
                aria-label={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBookmark(content.id);
                }}
                className={`p-2 rounded-full transition-colors ${
                  isBookmarked 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'hover:bg-gray-50 text-gray-400'
                }`}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onShare) {
                    onShare(content.id);
                  }
                }}
                className="p-2 rounded-full hover:bg-gray-50 text-gray-400 transition-colors"
                aria-label="Share"
              >
                <Share className="w-4 h-4" />
              </button>
            </div>

            <button className="p-1 rounded-full hover:bg-gray-50 text-gray-400 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderSection = (section: DiscoverySection) => {
    const isRefreshing = refreshingSections.has(section.id);

    return (
      <div key={section.id} className="mb-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              {section.type === 'trending' && <TrendingUp className="w-5 h-5 text-indigo-600" />}
              {section.type === 'featured' && <Star className="w-5 h-5 text-indigo-600" />}
              {section.type === 'recommended' && <Target className="w-5 h-5 text-indigo-600" />}
              {section.type === 'recent' && <Clock className="w-5 h-5 text-indigo-600" />}
              {section.type === 'popular' && <Fire className="w-5 h-5 text-indigo-600" />}
              {section.type === 'category' && <Tag className="w-5 h-5 text-indigo-600" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
              <p className="text-gray-600">{section.description}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {section.refreshable && (
              <button
                onClick={() => refreshSection(section.id)}
                disabled={isRefreshing}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            )}
            
            {section.viewAll && (
              <button className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                View All
              </button>
            )}
          </div>
        </div>

        {/* Section Content */}
        {section.layout === 'carousel' && (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex space-x-6 pb-4">
              {section.items.map(item => renderContentCard(item, 'medium'))}
            </div>
          </div>
        )}

        {section.layout === 'grid' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {section.items.map(item => renderContentCard(item, 'medium'))}
          </div>
        )}

        {section.layout === 'masonry' && (
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-6 space-y-6">
            {section.items.map(item => (
              <div key={item.id} className="break-inside-avoid">
                {renderContentCard(item, 'medium')}
              </div>
            ))}
          </div>
        )}

        {section.layout === 'list' && (
          <div className="space-y-4">
            {section.items.map(item => (
              <div key={item.id} className="flex space-x-4 bg-white p-4 rounded-lg shadow">
                <div className="flex-shrink-0">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-24 h-16 object-cover rounded"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">{item.description}</p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <span>{item.stats.views.toLocaleString()} views</span>
                    <span>⭐ {item.stats.rating.toFixed(1)}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={feedRef} className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">Discover</h1>
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('feed')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'feed' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Feed
                </button>
                <button
                  onClick={() => setViewMode('explore')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'explore' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Explore
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadDiscoveryContent()}
                disabled={isLoading}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Filter className="w-4 h-4" />
              </button>
              
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full"
              />
              <span className="text-lg text-gray-600">Discovering amazing content...</span>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {sections.map(renderSection)}
          </motion.div>
        )}
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-50"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}