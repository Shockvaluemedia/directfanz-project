'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Brain,
  TrendingUp,
  Filter,
  BarChart3,
  Grid,
  List,
  Bookmark,
  History,
  Settings,
  Share,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Eye,
  Star,
  ThumbsUp,
  Users,
  Tag,
  ArrowRight,
  Sparkles,
  Target,
  Globe,
  RefreshCw,
  SlidersHorizontal,
  FileText,
  BarChart,
  PieChart
} from 'lucide-react';
import { IntelligentSearchEngine } from './IntelligentSearchEngine';
import { AIRecommendationEngine } from './AIRecommendationEngine';
import { AdvancedFilters } from './AdvancedFilters';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface SearchAnalytics {
  totalSearches: number;
  uniqueQueries: number;
  avgResultsPerQuery: number;
  popularQueries: Array<{ query: string; count: number; trend: 'up' | 'down' | 'stable' }>;
  searchSuccess: number;
  avgSearchTime: number;
  topCategories: Array<{ category: string; percentage: number }>;
  userEngagement: {
    clickThrough: number;
    timeOnResults: number;
    bookmarks: number;
    shares: number;
  };
}

interface SearchDiscoveryDashboardProps {
  userId?: string;
  className?: string;
}

const mockAnalytics: SearchAnalytics = {
  totalSearches: 15678,
  uniqueQueries: 3421,
  avgResultsPerQuery: 127.5,
  popularQueries: [
    { query: 'fitness workout', count: 1240, trend: 'up' },
    { query: 'cooking tutorial', count: 890, trend: 'up' },
    { query: 'yoga for beginners', count: 670, trend: 'stable' },
    { query: 'digital art', count: 540, trend: 'down' },
    { query: 'music production', count: 430, trend: 'up' }
  ],
  searchSuccess: 87.3,
  avgSearchTime: 0.34,
  topCategories: [
    { category: 'Education', percentage: 35.2 },
    { category: 'Entertainment', percentage: 28.7 },
    { category: 'Lifestyle', percentage: 18.9 },
    { category: 'Arts', percentage: 12.4 },
    { category: 'Technology', percentage: 4.8 }
  ],
  userEngagement: {
    clickThrough: 23.4,
    timeOnResults: 3.2,
    bookmarks: 156,
    shares: 89
  }
};

export function SearchDiscoveryDashboard({
  userId = 'user123',
  className = ''
}: SearchDiscoveryDashboardProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'recommendations' | 'analytics' | 'filters'>('search');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<SearchAnalytics>(mockAnalytics);
  const [savedSearches, setSavedSearches] = useLocalStorage('search-discovery-saves', []);
  const [searchHistory, setSearchHistory] = useLocalStorage('search-discovery-history', []);
  const [preferences, setPreferences] = useLocalStorage('search-discovery-prefs', {
    enableAI: true,
    enableVoice: false,
    enableAnalytics: true,
    maxResults: 50,
    autoSave: true
  });

  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  // Mock search function
  const performSearch = useCallback(async (query: string, filters: Record<string, any>) => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Mock search results based on query and filters
    const mockResults = [
      {
        id: '1',
        type: 'content',
        title: `Results for "${query}"`,
        description: 'This is a mock search result demonstrating the search functionality.',
        thumbnail: `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop`,
        creator: {
          id: 'creator1',
          name: 'Content Creator',
          verified: true,
          tier: 'premium'
        },
        stats: {
          views: Math.floor(Math.random() * 10000),
          likes: Math.floor(Math.random() * 1000),
          rating: 4.2 + Math.random() * 0.8,
          duration: Math.floor(Math.random() * 3600),
          price: Math.random() > 0.5 ? 0 : Math.floor(Math.random() * 50)
        },
        tags: ['demo', 'search', 'content'],
        category: 'education',
        relevanceScore: 0.85 + Math.random() * 0.15
      }
    ];

    setSearchResults(mockResults);
    setIsLoading(false);
    return mockResults;
  }, []);

  // Mock suggestions function
  const fetchSuggestions = useCallback(async (query: string) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return [
      { id: '1', text: `${query} tutorial`, type: 'suggestion', count: 150 },
      { id: '2', text: `${query} for beginners`, type: 'suggestion', count: 89 },
      { id: '3', text: `advanced ${query}`, type: 'suggestion', count: 67 }
    ];
  }, []);

  const tabs = [
    {
      id: 'search' as const,
      name: 'Smart Search',
      icon: <Search className="w-4 h-4" />,
      description: 'Intelligent search with auto-complete and filters'
    },
    {
      id: 'recommendations' as const,
      name: 'AI Recommendations',
      icon: <Brain className="w-4 h-4" />,
      description: 'Personalized content recommendations'
    },
    {
      id: 'analytics' as const,
      name: 'Search Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'Insights and search performance metrics'
    },
    {
      id: 'filters' as const,
      name: 'Advanced Filters',
      icon: <SlidersHorizontal className="w-4 h-4" />,
      description: 'Detailed filtering and saved searches'
    }
  ];

  const renderAnalyticsCard = (title: string, value: string | number, change?: string, icon?: React.ReactNode) => (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">{change}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-indigo-100 rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  const renderSearchTab = () => (
    <div className="space-y-6">
      <IntelligentSearchEngine
        onSearch={performSearch}
        onSuggestions={fetchSuggestions}
        enableVoiceSearch={preferences.enableVoice}
        maxResults={preferences.maxResults}
        className="w-full"
      />
      
      {searchResults.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Search Results</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderRecommendationsTab = () => (
    <AIRecommendationEngine
      userId={userId}
      className="w-full"
    />
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {renderAnalyticsCard(
          'Total Searches',
          analytics.totalSearches.toLocaleString(),
          '+12.5%',
          <Search className="w-5 h-5 text-indigo-600" />
        )}
        {renderAnalyticsCard(
          'Unique Queries',
          analytics.uniqueQueries.toLocaleString(),
          '+8.3%',
          <Target className="w-5 h-5 text-green-600" />
        )}
        {renderAnalyticsCard(
          'Search Success Rate',
          `${analytics.searchSuccess}%`,
          '+2.1%',
          <CheckCircle className="w-5 h-5 text-blue-600" />
        )}
        {renderAnalyticsCard(
          'Avg Search Time',
          `${analytics.avgSearchTime}s`,
          '-0.05s',
          <Zap className="w-5 h-5 text-yellow-600" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Queries */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Search Queries</h3>
          <div className="space-y-3">
            {analytics.popularQueries.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-500 font-mono">#{index + 1}</span>
                  <span className="text-sm font-medium text-gray-900">{item.query}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{item.count}</span>
                  {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {item.trend === 'down' && <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />}
                  {item.trend === 'stable' && <div className="w-4 h-4 bg-gray-400 rounded-full" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Categories</h3>
          <div className="space-y-3">
            {analytics.topCategories.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{category.category}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {category.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">User Engagement</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {analytics.userEngagement.clickThrough}%
            </div>
            <div className="text-sm text-gray-600">Click-through Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {analytics.userEngagement.timeOnResults}m
            </div>
            <div className="text-sm text-gray-600">Avg. Time on Results</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {analytics.userEngagement.bookmarks}
            </div>
            <div className="text-sm text-gray-600">Bookmarks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {analytics.userEngagement.shares}
            </div>
            <div className="text-sm text-gray-600">Shares</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFiltersTab = () => (
    <div className="space-y-6">
      <AdvancedFilters
        onFiltersChange={(filters) => {
          console.log('Filters changed:', filters);
        }}
        className="w-full"
        allowSaving={true}
        showCounts={true}
      />
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'search':
        return renderSearchTab();
      case 'recommendations':
        return renderRecommendationsTab();
      case 'analytics':
        return renderAnalyticsTab();
      case 'filters':
        return renderFiltersTab();
      default:
        return renderSearchTab();
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Search & Discovery</h1>
                  <p className="text-sm text-gray-600">Find exactly what you're looking for</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  showFilters 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>

              <button className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  announce(`Switched to ${tab.name} tab`, 'polite');
                }}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`${showFilters ? 'grid grid-cols-1 lg:grid-cols-4 gap-8' : ''}`}>
          {/* Sidebar Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, x: -300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -300 }}
                className="lg:col-span-1"
              >
                <div className="sticky top-24">
                  <AdvancedFilters
                    onFiltersChange={(filters) => {
                      console.log('Sidebar filters changed:', filters);
                    }}
                    maxHeight={600}
                    compactMode={true}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <div className={showFilters ? 'lg:col-span-3' : 'col-span-1'}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center space-x-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"
                />
                <span className="text-gray-700">Processing your search...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}