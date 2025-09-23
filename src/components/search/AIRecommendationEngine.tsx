'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  Star,
  Eye,
  Clock,
  Heart,
  Bookmark,
  User,
  Users,
  Video,
  Image as ImageIcon,
  Mic,
  Play,
  Crown,
  Verified,
  ChevronRight,
  RefreshCw,
  Settings,
  Filter,
  ThumbsUp,
  ThumbsDown,
  X,
  Sparkles,
  Target,
  Zap,
  Award,
  Calendar,
  MapPin,
  Tag,
  Globe,
  Activity
} from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';

interface RecommendationItem {
  id: string;
  type: 'content' | 'creator' | 'community' | 'collection';
  title: string;
  description?: string;
  thumbnail?: string;
  creator?: {
    id: string;
    name: string;
    avatar?: string;
    verified?: boolean;
    tier?: 'free' | 'premium' | 'vip';
  };
  stats?: {
    views?: number;
    likes?: number;
    rating?: number;
    duration?: number;
    price?: number;
    subscribers?: number;
    members?: number;
  };
  tags?: string[];
  category?: string;
  aiScore?: number;
  reasons?: string[];
  createdAt?: Date;
  isNew?: boolean;
  isExclusive?: boolean;
}

interface RecommendationSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  items: RecommendationItem[];
  algorithm: 'collaborative' | 'content_based' | 'trending' | 'personalized' | 'similar_users';
  priority: number;
}

interface UserPreferences {
  categories: string[];
  creators: string[];
  contentTypes: string[];
  priceRange: [number, number];
  duration: [number, number];
  excludeExplicit: boolean;
  languages: string[];
}

interface AIRecommendationEngineProps {
  userId?: string;
  preferences?: UserPreferences;
  onItemClick?: (item: RecommendationItem) => void;
  onLike?: (itemId: string) => void;
  onDislike?: (itemId: string) => void;
  onBookmark?: (itemId: string) => void;
  onFeedback?: (feedback: {
    itemId: string;
    rating: number;
    comment?: string;
    reasons?: string[];
  }) => void;
  className?: string;
  maxSections?: number;
  maxItemsPerSection?: number;
}

const defaultPreferences: UserPreferences = {
  categories: [],
  creators: [],
  contentTypes: ['video', 'photo', 'live'],
  priceRange: [0, 100],
  duration: [0, 3600],
  excludeExplicit: false,
  languages: ['en']
};

// Mock recommendation algorithms
const generateRecommendations = async (
  userId: string,
  preferences: UserPreferences,
  algorithm: string
): Promise<RecommendationItem[]> => {
  // This would be replaced with actual AI/ML API calls
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

  const mockItems: RecommendationItem[] = [
    {
      id: '1',
      type: 'content',
      title: 'Sunrise Yoga Session',
      description: 'A peaceful morning yoga routine to start your day with positive energy',
      thumbnail: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
      creator: {
        id: 'creator1',
        name: 'Wellness with Sarah',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=50&h=50&fit=crop&crop=face',
        verified: true,
        tier: 'premium'
      },
      stats: {
        views: 15420,
        likes: 890,
        rating: 4.8,
        duration: 1800,
        price: 0
      },
      tags: ['yoga', 'wellness', 'morning', 'meditation'],
      category: 'fitness',
      aiScore: 0.92,
      reasons: ['Similar to your recent activity', 'Popular in your area', 'High rating match'],
      createdAt: new Date('2024-01-15'),
      isNew: true
    },
    {
      id: '2',
      type: 'creator',
      title: 'Chef Marco\'s Kitchen',
      description: 'Professional chef sharing authentic Italian recipes and cooking techniques',
      thumbnail: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=300&fit=crop',
      creator: {
        id: 'creator2',
        name: 'Chef Marco Rossi',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
        verified: true,
        tier: 'vip'
      },
      stats: {
        subscribers: 25600,
        views: 450000,
        rating: 4.9
      },
      tags: ['cooking', 'italian', 'professional', 'recipes'],
      category: 'food',
      aiScore: 0.87,
      reasons: ['Matches your cooking interests', 'Highly rated by similar users'],
      isExclusive: true
    },
    {
      id: '3',
      type: 'content',
      title: 'Digital Art Masterclass',
      description: 'Learn advanced digital painting techniques using Procreate and Photoshop',
      thumbnail: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=300&fit=crop',
      creator: {
        id: 'creator3',
        name: 'ArtByAlex',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face',
        verified: false,
        tier: 'premium'
      },
      stats: {
        views: 8750,
        likes: 1240,
        rating: 4.7,
        duration: 3600,
        price: 29.99
      },
      tags: ['art', 'digital', 'tutorial', 'procreate'],
      category: 'education',
      aiScore: 0.85,
      reasons: ['Based on your art preferences', 'Premium content match']
    }
  ];

  return mockItems.slice(0, Math.floor(Math.random() * 5) + 3);
};

export function AIRecommendationEngine({
  userId = 'user123',
  preferences = defaultPreferences,
  onItemClick,
  onLike,
  onDislike,
  onBookmark,
  onFeedback,
  className = '',
  maxSections = 6,
  maxItemsPerSection = 8
}: AIRecommendationEngineProps) {
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [showPreferences, setShowPreferences] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(preferences);
  const [feedbackItems, setFeedbackItems] = useState<Set<string>>(new Set());

  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  // Load recommendations
  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    announce('Loading personalized recommendations', 'polite');

    try {
      const recommendationTypes: Array<{
        id: string;
        title: string;
        description: string;
        icon: React.ReactNode;
        algorithm: RecommendationSection['algorithm'];
        priority: number;
      }> = [
        {
          id: 'for-you',
          title: 'For You',
          description: 'Personalized recommendations based on your activity',
          icon: <Sparkles className="w-5 h-5" />,
          algorithm: 'personalized',
          priority: 1
        },
        {
          id: 'trending',
          title: 'Trending Now',
          description: 'What\'s popular on the platform right now',
          icon: <TrendingUp className="w-5 h-5" />,
          algorithm: 'trending',
          priority: 2
        },
        {
          id: 'similar-taste',
          title: 'Users Like You',
          description: 'Recommendations from users with similar interests',
          icon: <Users className="w-5 h-5" />,
          algorithm: 'similar_users',
          priority: 3
        },
        {
          id: 'collaborative',
          title: 'Collaborative Picks',
          description: 'Based on what others who like similar content enjoy',
          icon: <Target className="w-5 h-5" />,
          algorithm: 'collaborative',
          priority: 4
        },
        {
          id: 'content-match',
          title: 'More Like This',
          description: 'Content similar to what you\'ve enjoyed before',
          icon: <Brain className="w-5 h-5" />,
          algorithm: 'content_based',
          priority: 5
        },
        {
          id: 'discover',
          title: 'Discover Something New',
          description: 'Expand your horizons with diverse content',
          icon: <Globe className="w-5 h-5" />,
          algorithm: 'collaborative',
          priority: 6
        }
      ];

      const loadedSections = await Promise.all(
        recommendationTypes.slice(0, maxSections).map(async (type) => {
          const items = await generateRecommendations(userId, userPreferences, type.algorithm);
          return {
            ...type,
            items: items.slice(0, maxItemsPerSection)
          } as RecommendationSection;
        })
      );

      setSections(loadedSections.filter(section => section.items.length > 0));
      announce(`Loaded ${loadedSections.length} recommendation sections`, 'polite');
    } catch (error) {
      console.error('Error loading recommendations:', error);
      announce('Failed to load recommendations. Please try again.', 'assertive');
    } finally {
      setIsLoading(false);
    }
  }, [userId, userPreferences, maxSections, maxItemsPerSection]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const handleItemClick = (item: RecommendationItem) => {
    if (onItemClick) {
      onItemClick(item);
    }
    announce(`Opening ${item.title}`, 'polite');
  };

  const handleLike = (itemId: string) => {
    setFeedbackItems(prev => new Set([...prev, itemId]));
    if (onLike) {
      onLike(itemId);
    }
    announce('Marked as liked', 'polite');
  };

  const handleDislike = (itemId: string) => {
    setFeedbackItems(prev => new Set([...prev, itemId]));
    if (onDislike) {
      onDislike(itemId);
    }
    announce('Marked as not interested', 'polite');
  };

  const handleBookmark = (itemId: string) => {
    if (onBookmark) {
      onBookmark(itemId);
    }
    announce('Added to bookmarks', 'polite');
  };

  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    setUserPreferences(prev => ({ ...prev, ...newPreferences }));
  };

  const renderRecommendationItem = (item: RecommendationItem) => (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      className={`group relative bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden ${
        feedbackItems.has(item.id) ? 'opacity-60' : ''
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            {item.type === 'content' && <Video className="w-8 h-8 text-indigo-400" />}
            {item.type === 'creator' && <User className="w-8 h-8 text-indigo-400" />}
            {item.type === 'community' && <Users className="w-8 h-8 text-indigo-400" />}
            {item.type === 'collection' && <ImageIcon className="w-8 h-8 text-indigo-400" />}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {item.isNew && (
            <span className="px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-full">
              NEW
            </span>
          )}
          {item.isExclusive && (
            <span className="px-2 py-1 text-xs font-bold bg-purple-500 text-white rounded-full">
              EXCLUSIVE
            </span>
          )}
        </div>

        {/* AI Score */}
        {item.aiScore && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center space-x-1 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs text-white">
              <Brain className="w-3 h-3" />
              <span>{Math.round(item.aiScore * 100)}%</span>
            </div>
          </div>
        )}

        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleItemClick(item)}
            className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors"
            aria-label={`Play ${item.title}`}
          >
            <Play className="w-6 h-6 text-gray-800 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
            {item.title}
          </h3>
          {item.stats?.price !== undefined && (
            <div className="flex-shrink-0 ml-2">
              {item.stats.price === 0 ? (
                <span className="text-green-600 font-medium text-sm">Free</span>
              ) : (
                <span className="text-gray-600 font-medium text-sm">${item.stats.price}</span>
              )}
            </div>
          )}
        </div>

        {item.creator && (
          <div className="flex items-center space-x-2 mb-2">
            {item.creator.avatar ? (
              <img
                src={item.creator.avatar}
                alt={item.creator.name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-600">{item.creator.name}</span>
              {item.creator.verified && (
                <Verified className="w-4 h-4 text-blue-500" />
              )}
              {item.creator.tier === 'vip' && (
                <Crown className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          </div>
        )}

        {item.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {item.description}
          </p>
        )}

        {/* Stats */}
        {item.stats && (
          <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
            {item.stats.rating && (
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span>{item.stats.rating.toFixed(1)}</span>
              </div>
            )}
            {item.stats.views && (
              <div className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{item.stats.views.toLocaleString()}</span>
              </div>
            )}
            {item.stats.duration && (
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{Math.floor(item.stats.duration / 60)}m</span>
              </div>
            )}
            {item.stats.subscribers && (
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{item.stats.subscribers.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
              >
                #{tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-xs text-gray-400">
                +{item.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* AI Reasons */}
        {item.reasons && item.reasons.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">Why this was recommended:</div>
            <div className="space-y-1">
              {item.reasons.slice(0, 2).map((reason, index) => (
                <div key={index} className="flex items-center space-x-1 text-xs text-gray-500">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleLike(item.id)}
              className="p-1 hover:bg-green-50 rounded transition-colors group/like"
              aria-label="Like"
              disabled={feedbackItems.has(item.id)}
            >
              <ThumbsUp className="w-4 h-4 text-gray-400 group-hover/like:text-green-600" />
            </button>
            <button
              onClick={() => handleDislike(item.id)}
              className="p-1 hover:bg-red-50 rounded transition-colors group/dislike"
              aria-label="Not interested"
              disabled={feedbackItems.has(item.id)}
            >
              <ThumbsDown className="w-4 h-4 text-gray-400 group-hover/dislike:text-red-600" />
            </button>
            <button
              onClick={() => handleBookmark(item.id)}
              className="p-1 hover:bg-blue-50 rounded transition-colors group/bookmark"
              aria-label="Bookmark"
            >
              <Bookmark className="w-4 h-4 text-gray-400 group-hover/bookmark:text-blue-600" />
            </button>
          </div>

          <button
            onClick={() => handleItemClick(item)}
            className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-full hover:bg-indigo-700 transition-colors"
          >
            View
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderSection = (section: RecommendationSection) => (
    <div key={section.id} className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            {section.icon}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
            <p className="text-sm text-gray-600">{section.description}</p>
          </div>
        </div>

        <button
          onClick={() => setSelectedSection(selectedSection === section.id ? '' : section.id)}
          className="flex items-center space-x-1 px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span>View All</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className={`grid gap-4 ${
        selectedSection === section.id
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
      }`}>
        <AnimatePresence>
          {section.items.slice(0, selectedSection === section.id ? section.items.length : 5).map(renderRecommendationItem)}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Recommendations</h1>
            <p className="text-gray-600">Personalized content curated just for you</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Preferences</span>
          </button>
          
          <button
            onClick={loadRecommendations}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Preferences Panel */}
      <AnimatePresence>
        {showPreferences && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Recommendation Preferences</h3>
              <button
                onClick={() => setShowPreferences(false)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Content Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Types
                </label>
                <div className="space-y-2">
                  {['video', 'photo', 'live', 'audio'].map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={userPreferences.contentTypes.includes(type)}
                        onChange={(e) => {
                          const newTypes = e.target.checked
                            ? [...userPreferences.contentTypes, type]
                            : userPreferences.contentTypes.filter(t => t !== type);
                          updatePreferences({ contentTypes: newTypes });
                        }}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={userPreferences.priceRange[0]}
                    onChange={(e) => updatePreferences({ 
                      priceRange: [Number(e.target.value), userPreferences.priceRange[1]] 
                    })}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={userPreferences.priceRange[1]}
                    onChange={(e) => updatePreferences({ 
                      priceRange: [userPreferences.priceRange[0], Number(e.target.value)] 
                    })}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Other Preferences */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={userPreferences.excludeExplicit}
                    onChange={(e) => updatePreferences({ excludeExplicit: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Exclude explicit content</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"
            />
            <span className="text-gray-600">Loading personalized recommendations...</span>
          </div>
        </div>
      )}

      {/* Recommendation Sections */}
      {!isLoading && sections.length > 0 && (
        <div>
          {sections.map(renderSection)}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && sections.length === 0 && (
        <div className="text-center py-12">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Recommendations Available</h3>
          <p className="text-gray-600 mb-4">
            We're still learning your preferences. Try interacting with more content to get personalized recommendations.
          </p>
          <button
            onClick={loadRecommendations}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}