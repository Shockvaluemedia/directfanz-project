'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Star,
  Eye,
  Clock,
  Heart,
  Bookmark,
  Share,
  Crown,
  Verified,
  Fire,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize2,
  MoreHorizontal,
  User,
  Calendar,
  Award,
  Zap
} from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';

interface FeaturedItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  video?: string;
  duration: number;
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
  featured: {
    badge: string;
    reason: string;
    priority: number;
  };
  gradient: string;
}

interface FeaturedCarouselProps {
  items: FeaturedItem[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showControls?: boolean;
  showIndicators?: boolean;
  onItemClick?: (item: FeaturedItem) => void;
  onCreatorClick?: (creatorId: string) => void;
  className?: string;
}

const mockFeaturedItems: FeaturedItem[] = [
  {
    id: '1',
    title: 'Master Chef\'s Ultimate Cooking Masterclass',
    description: 'Learn professional cooking techniques from a Michelin-starred chef in this comprehensive 12-part series.',
    thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&h=600&fit=crop',
    video: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    duration: 3600,
    creator: {
      id: 'chef-marco',
      name: 'Chef Marco Rossi',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
      verified: true,
      tier: 'vip'
    },
    stats: {
      views: 125000,
      likes: 8900,
      rating: 4.9,
      price: 49.99
    },
    tags: ['cooking', 'masterclass', 'professional'],
    category: 'education',
    featured: {
      badge: 'Editor\'s Choice',
      reason: 'Exceptional quality and engagement',
      priority: 1
    },
    gradient: 'from-orange-500 to-red-600'
  },
  {
    id: '2',
    title: 'Mindful Yoga & Meditation Journey',
    description: 'Transform your daily routine with this comprehensive yoga and mindfulness practice designed for all levels.',
    thumbnail: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&h=600&fit=crop',
    duration: 2700,
    creator: {
      id: 'yoga-sarah',
      name: 'Sarah Wellness',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=50&h=50&fit=crop&crop=face',
      verified: true,
      tier: 'premium'
    },
    stats: {
      views: 89000,
      likes: 12400,
      rating: 4.8,
      price: 0
    },
    tags: ['yoga', 'wellness', 'meditation'],
    category: 'lifestyle',
    featured: {
      badge: 'Trending',
      reason: 'Rapidly growing popularity',
      priority: 2
    },
    gradient: 'from-green-400 to-blue-500'
  },
  {
    id: '3',
    title: 'Digital Art Mastery: From Sketch to NFT',
    description: 'Complete guide to digital art creation, including NFT minting and marketplace strategies.',
    thumbnail: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&h=600&fit=crop',
    duration: 4200,
    creator: {
      id: 'artist-alex',
      name: 'Alex Digital',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face',
      verified: false,
      tier: 'premium'
    },
    stats: {
      views: 67000,
      likes: 5600,
      rating: 4.7,
      price: 79.99
    },
    tags: ['art', 'digital', 'nft'],
    category: 'creative',
    featured: {
      badge: 'New Release',
      reason: 'Latest premium content',
      priority: 3
    },
    gradient: 'from-purple-500 to-pink-600'
  }
];

export function FeaturedCarousel({
  items = mockFeaturedItems,
  autoPlay = true,
  autoPlayInterval = 5000,
  showControls = true,
  showIndicators = true,
  onItemClick,
  onCreatorClick,
  className = ''
}: FeaturedCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 });
  const [isMuted, setIsMuted] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && items.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
      }, autoPlayInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, items.length, autoPlayInterval]);

  // Update drag constraints
  useEffect(() => {
    if (carouselRef.current) {
      const containerWidth = carouselRef.current.offsetWidth;
      const totalWidth = containerWidth * items.length;
      setDragConstraints({
        left: -(totalWidth - containerWidth),
        right: 0
      });
    }
  }, [items.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        previousSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === ' ') {
        e.preventDefault();
        toggleAutoPlay();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
    announce(`Slide ${currentIndex + 2} of ${items.length}`, 'polite');
  }, [items.length, currentIndex, announce]);

  const previousSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    announce(`Slide ${currentIndex} of ${items.length}`, 'polite');
  }, [items.length, currentIndex, announce]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    announce(`Jumped to slide ${index + 1} of ${items.length}`, 'polite');
  };

  const toggleAutoPlay = () => {
    setIsPlaying(prev => {
      const newState = !prev;
      announce(newState ? 'Auto-play enabled' : 'Auto-play disabled', 'polite');
      return newState;
    });
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (Math.abs(velocity) > 500 || Math.abs(offset) > threshold) {
      if (velocity > 0 || offset > threshold) {
        previousSlide();
      } else if (velocity < 0 || offset < -threshold) {
        nextSlide();
      }
    }
  };

  const handleItemClick = (item: FeaturedItem) => {
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

  const currentItem = items[currentIndex];

  if (!items.length) {
    return null;
  }

  return (
    <div className={`relative w-full h-96 md:h-[500px] lg:h-[600px] overflow-hidden rounded-2xl shadow-2xl ${className}`}>
      {/* Main Carousel */}
      <div ref={carouselRef} className="relative w-full h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
            drag="x"
            dragConstraints={dragConstraints}
            onDragEnd={handleDragEnd}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src={currentItem.thumbnail}
                alt={currentItem.title}
                className="w-full h-full object-cover"
              />
              <div className={`absolute inset-0 bg-gradient-to-r ${currentItem.gradient} opacity-75`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>

            {/* Content Overlay */}
            <div className="relative h-full flex items-end p-8 md:p-12 lg:p-16">
              <div className="max-w-4xl text-white">
                {/* Featured Badge */}
                <div className="flex items-center space-x-2 mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-500 text-black">
                    <Sparkles className="w-4 h-4 mr-1" />
                    {currentItem.featured.badge}
                  </span>
                  {currentItem.creator.tier === 'vip' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-500">
                      <Crown className="w-4 h-4 mr-1" />
                      VIP Creator
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                  {currentItem.title}
                </h1>

                {/* Description */}
                <p className="text-lg md:text-xl text-gray-200 mb-6 leading-relaxed max-w-3xl">
                  {currentItem.description}
                </p>

                {/* Creator Info */}
                <div 
                  className="flex items-center space-x-4 mb-6 cursor-pointer hover:bg-white/10 p-2 -m-2 rounded-lg transition-colors"
                  onClick={() => handleCreatorClick(currentItem.creator.id, currentItem.creator.name)}
                >
                  <img
                    src={currentItem.creator.avatar}
                    alt={currentItem.creator.name}
                    className="w-12 h-12 rounded-full border-2 border-white/50"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-lg">{currentItem.creator.name}</span>
                      {currentItem.creator.verified && (
                        <Verified className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <p className="text-gray-300 text-sm">Creator</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-6 mb-8">
                  <div className="flex items-center space-x-1">
                    <Eye className="w-5 h-5 text-gray-300" />
                    <span className="font-medium">{currentItem.stats.views.toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <span className="font-medium">{currentItem.stats.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-5 h-5 text-gray-300" />
                    <span className="font-medium">
                      {Math.floor(currentItem.duration / 60)}m {currentItem.duration % 60}s
                    </span>
                  </div>
                  {currentItem.stats.price > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-green-400">${currentItem.stats.price}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleItemClick(currentItem)}
                    className="flex items-center space-x-2 bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    <span>Watch Now</span>
                  </button>

                  {currentItem.stats.price === 0 ? (
                    <span className="flex items-center space-x-2 bg-green-500 text-white px-6 py-3 rounded-xl font-semibold">
                      <Zap className="w-5 h-5" />
                      <span>Free</span>
                    </span>
                  ) : (
                    <button className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                      <Award className="w-5 h-5" />
                      <span>Get Access</span>
                    </button>
                  )}

                  <button className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-colors">
                    <Heart className="w-5 h-5" />
                  </button>

                  <button className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-colors">
                    <Bookmark className="w-5 h-5" />
                  </button>

                  <button className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-colors">
                    <Share className="w-5 h-5" />
                  </button>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-6">
                  {currentItem.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Featured Reason */}
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 max-w-xs">
              <p className="text-white text-sm">{currentItem.featured.reason}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Controls */}
      {showControls && items.length > 1 && (
        <>
          <button
            onClick={previousSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors z-10"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors z-10"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Top Controls */}
      <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
        {items.length > 1 && (
          <button
            onClick={toggleAutoPlay}
            className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-lg hover:bg-black/70 transition-colors"
            aria-label={isPlaying ? 'Pause auto-play' : 'Start auto-play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-lg hover:bg-black/70 transition-colors"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-2 bg-black/50 backdrop-blur-sm text-white rounded-lg hover:bg-black/70 transition-colors"
          aria-label="Toggle details"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Slide Indicators */}
      {showIndicators && items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-white scale-125' 
                  : 'bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {isPlaying && items.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <motion.div
            className="h-full bg-white"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: autoPlayInterval / 1000, ease: 'linear' }}
            key={currentIndex}
          />
        </div>
      )}

      {/* Additional Details Panel */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-black/90 backdrop-blur-md text-white p-6 overflow-y-auto z-20"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Content Details</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-white/20 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-gray-300 mb-1">Category</h4>
                <p className="capitalize">{currentItem.category}</p>
              </div>

              <div>
                <h4 className="font-medium text-sm text-gray-300 mb-1">Featured Priority</h4>
                <p>#{currentItem.featured.priority}</p>
              </div>

              <div>
                <h4 className="font-medium text-sm text-gray-300 mb-1">Engagement</h4>
                <p>{currentItem.stats.likes.toLocaleString()} likes</p>
              </div>

              <div>
                <h4 className="font-medium text-sm text-gray-300 mb-1">Content Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {currentItem.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-white/20 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}