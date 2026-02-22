'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Grid,
  List,
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  Star,
  Heart,
  Bookmark,
  Share,
  MoreHorizontal,
  Play,
  Clock,
  Crown,
  Verified,
  TrendingUp,
  Sparkles,
  Award,
  ChevronUp,
  Settings,
  Shuffle
} from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface GridItem {
  id: string;
  type: 'video' | 'photo' | 'live' | 'audio' | 'collection';
  title: string;
  description?: string;
  thumbnail: string;
  duration?: number;
  creator: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    tier: 'free' | 'premium' | 'vip';
  };
  stats: {
    views: number;
    likes: number;
    rating: number;
    price: number;
  };
  tags: string[];
  category: string;
  createdAt: Date;
  isNew?: boolean;
  isTrending?: boolean;
  isExclusive?: boolean;
}

interface InfiniteScrollGridProps {
  loadMore: (page: number, limit: number) => Promise<{ items: GridItem[]; hasMore: boolean; total: number }>;
  itemsPerPage?: number;
  columns?: number;
  gap?: number;
  onItemClick?: (item: GridItem) => void;
  onCreatorClick?: (creatorId: string) => void;
  className?: string;
  enableVirtualization?: boolean;
  sortBy?: 'newest' | 'popular' | 'rating' | 'trending';
  filterBy?: string[];
  searchQuery?: string;
}

// Virtual scrolling configuration
const ITEM_HEIGHT = 320;
const BUFFER_SIZE = 5;

// Mock data generator for demonstration
const generateMockItem = (index: number): GridItem => {
  const categories = ['fitness', 'cooking', 'art', 'music', 'gaming', 'lifestyle', 'education'];
  const creators = [
    { name: 'Sarah Creator', verified: true, tier: 'vip' as const },
    { name: 'Mike Artist', verified: false, tier: 'premium' as const },
    { name: 'Anna Chef', verified: true, tier: 'premium' as const },
    { name: 'David Gamer', verified: true, tier: 'free' as const },
    { name: 'Lisa Fitness', verified: true, tier: 'vip' as const }
  ];

  const creator = creators[index % creators.length];
  const category = categories[index % categories.length];

  return {
    id: `item-${index}`,
    type: ['video', 'photo', 'audio'][Math.floor(Math.random() * 3)] as any,
    title: `${category} content ${index + 1}`,
    description: `This is an engaging ${category} content piece with amazing quality and creativity.`,
    thumbnail: `https://images.unsplash.com/photo-${1500000000000 + (index * 1000)}?w=400&h=300&fit=crop`,
    duration: Math.floor(Math.random() * 3600),
    creator: {
      id: `creator-${index % 5}`,
      name: creator.name,
      avatar: `https://images.unsplash.com/photo-${1400000000000 + (index * 500)}?w=50&h=50&fit=crop&crop=face`,
      verified: creator.verified,
      tier: creator.tier
    },
    stats: {
      views: Math.floor(Math.random() * 100000),
      likes: Math.floor(Math.random() * 10000),
      rating: 3.5 + Math.random() * 1.5,
      price: Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0
    },
    tags: [category, 'trending', 'popular'].slice(0, Math.floor(Math.random() * 3) + 1),
    category,
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    isNew: Math.random() > 0.8,
    isTrending: Math.random() > 0.85,
    isExclusive: Math.random() > 0.95
  };
};

export function InfiniteScrollGrid({
  loadMore,
  itemsPerPage = 20,
  columns = 4,
  gap = 24,
  onItemClick,
  onCreatorClick,
  className = '',
  enableVirtualization = false,
  sortBy = 'newest',
  filterBy = [],
  searchQuery = ''
}: InfiniteScrollGridProps) {
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentSort, setCurrentSort] = useState(sortBy);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const [likedItems, setLikedItems] = useLocalStorage<Set<string>>('infinite-likes', new Set());
  const [bookmarkedItems, setBookmarkedItems] = useLocalStorage<Set<string>>('infinite-bookmarks', new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  // Intersection Observer for infinite loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading) {
          loadMoreItems();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 800);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load initial items
  useEffect(() => {
    loadInitialItems();
  }, [sortBy, filterBy, searchQuery]);

  const loadInitialItems = async () => {
    setLoading(true);
    setError(null);
    setPage(0);
    setItems([]);

    try {
      // If no loadMore function provided, generate mock data
      if (!loadMore) {
        const mockItems = Array.from({ length: itemsPerPage }, (_, i) => generateMockItem(i));
        setItems(mockItems);
        setHasMore(true);
        setTotal(1000); // Mock total
      } else {
        const result = await loadMore(0, itemsPerPage);
        setItems(result.items);
        setHasMore(result.hasMore);
        setTotal(result.total);
      }

      announce(`Loaded ${itemsPerPage} items`, 'polite');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
      announce('Failed to load content', 'assertive');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreItems = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      
      // If no loadMore function provided, generate mock data
      if (!loadMore) {
        const startIndex = nextPage * itemsPerPage;
        const mockItems = Array.from({ length: itemsPerPage }, (_, i) => 
          generateMockItem(startIndex + i)
        );
        
        setItems(prev => [...prev, ...mockItems]);
        setHasMore(startIndex + itemsPerPage < 1000); // Mock total limit
        setPage(nextPage);
      } else {
        const result = await loadMore(nextPage, itemsPerPage);
        setItems(prev => [...prev, ...result.items]);
        setHasMore(result.hasMore);
        setTotal(result.total);
        setPage(nextPage);
      }

      announce(`Loaded ${itemsPerPage} more items`, 'polite');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more content');
      
      // Retry after delay
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      retryTimeoutRef.current = setTimeout(() => {
        loadMoreItems();
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: GridItem) => {
    if (onItemClick) {
      onItemClick(item);
    }
    announce(`Opening ${item.title}`, 'polite');
  };

  const handleCreatorClick = (creatorId: string, creatorName: string) => {
    if (onCreatorClick) {
      onCreatorClick(creatorId);
    }
    announce(`Opening ${creatorName}'s profile`, 'polite');
  };

  const handleLike = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleBookmark = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const shuffleItems = () => {
    setItems(prev => [...prev].sort(() => Math.random() - 0.5));
    announce('Items shuffled', 'polite');
  };

  const renderGridItem = (item: GridItem, index: number) => {
    const isLiked = likedItems.has(item.id);
    const isBookmarked = bookmarkedItems.has(item.id);

    return (
      <motion.div
        key={item.id}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
        onClick={() => handleItemClick(item)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />

          {/* Overlay badges */}
          <div className="absolute top-2 left-2 flex gap-1">
            {item.isNew && (
              <span className="px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-full">
                NEW
              </span>
            )}
            {item.isTrending && (
              <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-full">
                <TrendingUp className="w-3 h-3 mr-1 inline" />
                TRENDING
              </span>
            )}
            {item.isExclusive && (
              <span className="px-2 py-1 text-xs font-bold bg-purple-500 text-white rounded-full">
                EXCLUSIVE
              </span>
            )}
          </div>

          {/* Duration */}
          {item.duration && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
              {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
            </div>
          )}

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Play className="w-6 h-6 text-gray-800 ml-0.5" />
            </div>
          </div>

          {/* Price */}
          {item.stats.price > 0 && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
              ${item.stats.price}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
            {item.title}
          </h3>

          {/* Creator */}
          <div 
            className="flex items-center space-x-2 mb-3 cursor-pointer hover:bg-gray-50 p-1 -m-1 rounded"
            onClick={(e) => {
              e.stopPropagation();
              handleCreatorClick(item.creator.id, item.creator.name);
            }}
          >
            <img
              src={item.creator.avatar}
              alt={item.creator.name}
              className="w-6 h-6 rounded-full"
            />
            <div className="flex items-center space-x-1 flex-1 min-w-0">
              <span className="text-sm text-gray-600 truncate">{item.creator.name}</span>
              {item.creator.verified && (
                <Verified className="w-4 h-4 text-blue-500 flex-shrink-0" />
              )}
              {item.creator.tier === 'vip' && (
                <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{item.stats.views.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span>{item.stats.rating.toFixed(1)}</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {new Date(item.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => handleLike(item.id, e)}
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
                onClick={(e) => handleBookmark(item.id, e)}
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
                  // Handle share
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

  const renderListItem = (item: GridItem, index: number) => {
    const isLiked = likedItems.has(item.id);
    const isBookmarked = bookmarkedItems.has(item.id);

    return (
      <motion.div
        key={item.id}
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02 }}
        className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
        onClick={() => handleItemClick(item)}
      >
        <div className="flex space-x-4 p-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0">
            <div className="relative w-32 h-20 overflow-hidden rounded">
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {item.duration && (
                <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 text-white text-xs rounded">
                  {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 line-clamp-1 hover:text-indigo-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2 mt-1">{item.description}</p>
                
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <img
                      src={item.creator.avatar}
                      alt={item.creator.name}
                      className="w-4 h-4 rounded-full"
                    />
                    <span>{item.creator.name}</span>
                    {item.creator.verified && <Verified className="w-3 h-3 text-blue-500" />}
                  </div>
                  <span>{item.stats.views.toLocaleString()} views</span>
                  <span>⭐ {item.stats.rating.toFixed(1)}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center space-x-1 ml-4">
                <button
                  onClick={(e) => handleLike(item.id, e)}
                  className={`p-1 rounded transition-colors ${
                    isLiked ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={(e) => handleBookmark(item.id, e)}
                  className={`p-1 rounded transition-colors ${
                    isBookmarked ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            {items.length.toLocaleString()} of {total.toLocaleString()} items
          </div>
          
          <button
            onClick={shuffleItems}
            className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="flex items-center space-x-1 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            <span className="text-sm">{viewMode === 'grid' ? 'List' : 'Grid'}</span>
          </button>

          <select
            value={currentSort}
            onChange={(e) => setCurrentSort(e.target.value as typeof sortBy)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="trending">Trending</option>
          </select>
        </div>
      </div>

      {/* Content Grid/List */}
      <div ref={containerRef}>
        {viewMode === 'grid' ? (
          <div 
            className="grid gap-6"
            style={{ 
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: `${gap}px`
            }}
          >
            {items.map((item, index) => renderGridItem(item, index))}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => renderListItem(item, index))}
          </div>
        )}
      </div>

      {/* Loading/Error States */}
      <div ref={loadingRef} className="mt-8">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-gray-600">Loading more content...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 mb-2">{error}</p>
              <button
                onClick={() => loadMoreItems()}
                className="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {!hasMore && items.length > 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">You've reached the end!</p>
            <button
              onClick={scrollToTop}
              className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Back to Top
            </button>
          </div>
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
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}