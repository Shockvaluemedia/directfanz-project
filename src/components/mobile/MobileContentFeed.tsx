'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw, ChevronUp, Search, Filter, Grid, List } from 'lucide-react';
import { TouchOptimizedCard } from './TouchOptimizedCard';

interface ContentItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  avatar?: string;
  artistName: string;
  duration?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  isBookmarked: boolean;
}

interface MobileContentFeedProps {
  initialContent: ContentItem[];
  onRefresh: () => Promise<ContentItem[]>;
  onLoadMore: () => Promise<ContentItem[]>;
  onSearch?: (query: string) => void;
  onFilter?: () => void;
  className?: string;
}

type ViewMode = 'grid' | 'list';

export function MobileContentFeed({
  initialContent,
  onRefresh,
  onLoadMore,
  onSearch,
  onFilter,
  className = ''
}: MobileContentFeedProps) {
  const [content, setContent] = useState<ContentItem[]>(initialContent);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const pullToRefreshY = useMotionValue(0);
  const refreshRotation = useTransform(pullToRefreshY, [0, 100], [0, 180]);
  const refreshOpacity = useTransform(pullToRefreshY, [0, 50, 100], [0, 0.5, 1]);

  // Handle pull-to-refresh
  const handlePullToRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const newContent = await onRefresh();
      setContent(newContent);
      pullToRefreshY.set(0);
    } catch (error) {
      console.error('Failed to refresh content:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh, pullToRefreshY]);

  // Handle infinite scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    
    // Show/hide scroll to top button
    setShowScrollTop(scrollTop > 300);
    
    // Load more content when near bottom
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && !isLoadingMore) {
      setIsLoadingMore(true);
      onLoadMore().then(newContent => {
        if (newContent.length > 0) {
          setContent(prev => [...prev, ...newContent]);
        }
      }).finally(() => {
        setIsLoadingMore(false);
      });
    }
  }, [isLoadingMore, onLoadMore]);

  // Handle search
  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      onSearch?.(searchQuery);
    }
  }, [searchQuery, onSearch]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // Handle content interactions
  const handleLike = useCallback((id: string) => {
    setContent(prev => prev.map(item => 
      item.id === id ? { 
        ...item, 
        isLiked: !item.isLiked,
        likes: item.isLiked ? item.likes - 1 : item.likes + 1
      } : item
    ));
  }, []);

  const handleBookmark = useCallback((id: string) => {
    setContent(prev => prev.map(item => 
      item.id === id ? { ...item, isBookmarked: !item.isBookmarked } : item
    ));
  }, []);

  return (
    <div className={`relative h-full bg-gray-50 ${className}`}>
      {/* Enhanced Header with Search */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        {/* Main header */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Discover</h1>
            
            <div className="flex items-center space-x-3">
              {/* Search Toggle */}
              <motion.button
                onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <Search className="w-5 h-5 text-gray-600" />
              </motion.button>

              {/* Filter Button */}
              {onFilter && (
                <motion.button
                  onClick={onFilter}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <Filter className="w-5 h-5 text-gray-600" />
                </motion.button>
              )}

              {/* View Mode Toggle */}
              <motion.button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                {viewMode === 'grid' ? (
                  <List className="w-5 h-5 text-gray-600" />
                ) : (
                  <Grid className="w-5 h-5 text-gray-600" />
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Expandable Search */}
        <AnimatePresence>
          {isSearchExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-gray-200 px-4 py-3"
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  placeholder="Search artists, content..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pull-to-refresh indicator */}
      <motion.div
        style={{ 
          y: pullToRefreshY,
          opacity: refreshOpacity
        }}
        className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-full p-3 shadow-medium"
      >
        <motion.div style={{ rotate: refreshRotation }}>
          <RefreshCw className="w-6 h-6 text-indigo-600" />
        </motion.div>
      </motion.div>

      {/* Content Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto pb-20 lg:pb-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Pull-to-refresh gesture area */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 100 }}
          dragElastic={{ top: 0, bottom: 0.3 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100) {
              handlePullToRefresh();
            } else {
              pullToRefreshY.set(0);
            }
          }}
          style={{ y: pullToRefreshY }}
          className="px-4 pt-4"
        >
          {/* Content Grid/List */}
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'
                  : 'space-y-6'
              }
            >
              {content.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: Math.min(index * 0.1, 0.5) 
                  }}
                >
                  <TouchOptimizedCard
                    {...item}
                    onLike={() => handleLike(item.id)}
                    onBookmark={() => handleBookmark(item.id)}
                    onComment={() => console.log('Comment on', item.id)}
                    onShare={() => console.log('Share', item.id)}
                    onTap={() => console.log('Open content', item.id)}
                    className={viewMode === 'grid' ? 'aspect-square' : ''}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoadingMore && (
            <div className="flex justify-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="w-6 h-6 text-indigo-600" />
              </motion.div>
            </div>
          )}

          {/* Empty state */}
          {content.length === 0 && !isRefreshing && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
              <p className="text-gray-500 text-center max-w-sm">
                Try adjusting your search or filters to find what you're looking for.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Scroll to top button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={scrollToTop}
            className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 bg-indigo-600 text-white p-3 rounded-full shadow-large hover:bg-indigo-700 active:bg-indigo-800 transition-colors z-20"
          >
            <ChevronUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Refreshing overlay */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-30"
          >
            <div className="bg-white rounded-xl p-6 shadow-large flex flex-col items-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="w-8 h-8 text-indigo-600 mb-3" />
              </motion.div>
              <p className="text-gray-700 font-medium">Refreshing content...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}