'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Search,
  Eye,
  Clock,
  Users,
  Target,
  Zap,
  Award,
  Filter,
  Calendar,
  Download,
  Share,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronRight,
  PieChart,
  Activity,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  Hash,
  User,
  Heart,
  Bookmark,
  MessageCircle,
  Settings,
  Info,
  AlertCircle,
  X
} from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';
import { useSession } from 'next-auth/react';

interface SearchMetric {
  id: string;
  label: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  trend: number[];
  format: 'number' | 'percentage' | 'time' | 'currency';
  icon: React.ReactNode;
  color: string;
}

interface SearchQuery {
  query: string;
  count: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  successRate: number;
  avgResultsFound: number;
  avgClickThrough: number;
  categories: string[];
  devices: Record<string, number>;
  locations: Record<string, number>;
}

interface SearchTrend {
  date: string;
  searches: number;
  uniqueSearches: number;
  successRate: number;
  avgSessionTime: number;
  bounceRate: number;
}

interface UserSegment {
  segment: string;
  count: number;
  percentage: number;
  avgSearchesPerSession: number;
  topQueries: string[];
  conversionRate: number;
}

interface AIInsight {
  type: 'trend' | 'opportunity' | 'warning' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface SearchAnalyticsProps {
  dateRange?: 'today' | 'week' | 'month' | 'quarter' | 'year';
  userId?: string;
  creatorId?: string; // For creator-specific analytics
  onExport?: (data: any, format: 'json' | 'csv' | 'pdf') => void;
  className?: string;
  enableAI?: boolean; // Enable AI-powered insights
}

// Mock data - in real app, this would come from your analytics API
const mockMetrics: SearchMetric[] = [
  {
    id: 'total_searches',
    label: 'Total Searches',
    value: 125847,
    change: 12.5,
    changeType: 'increase',
    trend: [95000, 102000, 108000, 115000, 119000, 125847],
    format: 'number',
    icon: <Search className="w-5 h-5" />,
    color: 'blue'
  },
  {
    id: 'unique_queries',
    label: 'Unique Queries',
    value: 8432,
    change: 8.3,
    changeType: 'increase',
    trend: [7200, 7500, 7800, 8000, 8200, 8432],
    format: 'number',
    icon: <Target className="w-5 h-5" />,
    color: 'green'
  },
  {
    id: 'success_rate',
    label: 'Search Success Rate',
    value: 87.3,
    change: 2.1,
    changeType: 'increase',
    trend: [82, 84, 85, 86, 87, 87.3],
    format: 'percentage',
    icon: <Award className="w-5 h-5" />,
    color: 'purple'
  },
  {
    id: 'avg_search_time',
    label: 'Avg. Search Time',
    value: 0.342,
    change: -0.08,
    changeType: 'decrease',
    trend: [0.420, 0.400, 0.380, 0.365, 0.355, 0.342],
    format: 'time',
    icon: <Zap className="w-5 h-5" />,
    color: 'yellow'
  },
  {
    id: 'click_through_rate',
    label: 'Click-through Rate',
    value: 23.4,
    change: 1.2,
    changeType: 'increase',
    trend: [21.2, 21.8, 22.1, 22.5, 23.0, 23.4],
    format: 'percentage',
    icon: <Eye className="w-5 h-5" />,
    color: 'indigo'
  },
  {
    id: 'avg_results_per_query',
    label: 'Avg. Results per Query',
    value: 127.5,
    change: -2.3,
    changeType: 'decrease',
    trend: [145, 140, 135, 132, 130, 127.5],
    format: 'number',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'red'
  }
];

const mockTopQueries: SearchQuery[] = [
  {
    query: 'fitness workout',
    count: 12450,
    change: 15.3,
    changeType: 'increase',
    successRate: 94.2,
    avgResultsFound: 142,
    avgClickThrough: 28.5,
    categories: ['fitness', 'health', 'lifestyle'],
    devices: { mobile: 65, desktop: 30, tablet: 5 },
    locations: { 'United States': 45, 'Canada': 15, 'United Kingdom': 12, 'Australia': 8, 'Other': 20 }
  },
  {
    query: 'cooking tutorial',
    count: 9876,
    change: 8.7,
    changeType: 'increase',
    successRate: 91.5,
    avgResultsFound: 156,
    avgClickThrough: 32.1,
    categories: ['cooking', 'food', 'tutorial'],
    devices: { mobile: 58, desktop: 35, tablet: 7 },
    locations: { 'United States': 42, 'United Kingdom': 18, 'Canada': 14, 'Germany': 10, 'Other': 16 }
  },
  {
    query: 'yoga for beginners',
    count: 8234,
    change: 22.1,
    changeType: 'increase',
    successRate: 88.9,
    avgResultsFound: 98,
    avgClickThrough: 35.7,
    categories: ['yoga', 'wellness', 'beginner'],
    devices: { mobile: 72, desktop: 22, tablet: 6 },
    locations: { 'United States': 38, 'Canada': 16, 'Australia': 12, 'United Kingdom': 11, 'Other': 23 }
  },
  {
    query: 'digital art',
    count: 6789,
    change: -5.2,
    changeType: 'decrease',
    successRate: 85.4,
    avgResultsFound: 203,
    avgClickThrough: 19.8,
    categories: ['art', 'digital', 'creative'],
    devices: { desktop: 48, mobile: 42, tablet: 10 },
    locations: { 'United States': 35, 'United Kingdom': 15, 'Germany': 12, 'Japan': 10, 'Other': 28 }
  },
  {
    query: 'music production',
    count: 5432,
    change: 12.8,
    changeType: 'increase',
    successRate: 82.7,
    avgResultsFound: 178,
    avgClickThrough: 24.3,
    categories: ['music', 'production', 'audio'],
    devices: { desktop: 52, mobile: 38, tablet: 10 },
    locations: { 'United States': 40, 'United Kingdom': 14, 'Canada': 12, 'Germany': 11, 'Other': 23 }
  }
];

const mockTrendData: SearchTrend[] = [
  { date: '2024-01-15', searches: 95000, uniqueSearches: 12000, successRate: 85.2, avgSessionTime: 4.2, bounceRate: 32.1 },
  { date: '2024-01-16', searches: 102000, uniqueSearches: 13200, successRate: 86.1, avgSessionTime: 4.5, bounceRate: 30.8 },
  { date: '2024-01-17', searches: 108000, uniqueSearches: 14100, successRate: 87.0, avgSessionTime: 4.8, bounceRate: 29.5 },
  { date: '2024-01-18', searches: 115000, uniqueSearches: 14800, successRate: 87.5, avgSessionTime: 5.1, bounceRate: 28.2 },
  { date: '2024-01-19', searches: 119000, uniqueSearches: 15200, successRate: 88.1, avgSessionTime: 5.3, bounceRate: 27.6 },
  { date: '2024-01-20', searches: 125847, uniqueSearches: 15900, successRate: 88.7, avgSessionTime: 5.6, bounceRate: 26.3 }
];

const mockUserSegments: UserSegment[] = [
  {
    segment: 'Power Users',
    count: 2580,
    percentage: 15.2,
    avgSearchesPerSession: 8.3,
    topQueries: ['advanced tutorials', 'professional content', 'exclusive access'],
    conversionRate: 45.6
  },
  {
    segment: 'Casual Browsers',
    count: 8924,
    percentage: 52.8,
    avgSearchesPerSession: 2.1,
    topQueries: ['trending', 'popular', 'recommended'],
    conversionRate: 18.2
  },
  {
    segment: 'New Users',
    count: 3456,
    percentage: 20.4,
    avgSearchesPerSession: 3.7,
    topQueries: ['getting started', 'beginner', 'how to'],
    conversionRate: 12.8
  },
  {
    segment: 'Mobile-First',
    count: 1980,
    percentage: 11.6,
    avgSearchesPerSession: 1.8,
    topQueries: ['quick videos', 'short content', 'mobile-friendly'],
    conversionRate: 22.3
  }
];

export function SearchAnalytics({
  dateRange = 'week',
  userId,
  creatorId,
  onExport,
  className = '',
  enableAI = true
}: SearchAnalyticsProps) {
  const [selectedMetric, setSelectedMetric] = useState<SearchMetric | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<SearchQuery | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'queries' | 'trends' | 'segments' | 'ai-insights'>('overview');
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  
  const { data: session } = useSession();

  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  const refreshData = async () => {
    setRefreshing(true);
    try {
      // Refresh both regular data and AI insights
      await Promise.all([
        // Simulate regular analytics refresh
        new Promise(resolve => setTimeout(resolve, 1500)),
        // Fetch AI insights if enabled
        enableAI ? fetchAIInsights() : Promise.resolve()
      ]);
    } finally {
      setRefreshing(false);
      announce('Analytics data refreshed', 'polite');
    }
  };

  const fetchAIInsights = async () => {
    if (!enableAI || !session || aiLoading) return;
    
    setAiLoading(true);
    try {
      const response = await fetch(`/api/ai/analytics?artistId=${session.user.id}&type=trends&timeframe=${dateRange}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Convert AI response to insights format
        const insights: AIInsight[] = [
          ...(data.data.insights || []).map((insight: string, index: number) => ({
            type: 'trend' as const,
            title: `Search Trend ${index + 1}`,
            description: insight,
            confidence: 0.85 + Math.random() * 0.1,
            actionable: true,
            priority: index === 0 ? 'high' as const : 'medium' as const
          })),
          ...(data.data.recommendations || []).map((rec: string, index: number) => ({
            type: 'recommendation' as const,
            title: `AI Recommendation ${index + 1}`,
            description: rec,
            confidence: 0.8 + Math.random() * 0.15,
            actionable: true,
            priority: 'medium' as const
          }))
        ];
        
        setAiInsights(insights);
        announce(`${insights.length} AI insights loaded`, 'polite');
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
      announce('Failed to load AI insights', 'assertive');
    } finally {
      setAiLoading(false);
    }
  };

  // Fetch AI insights on component mount and when parameters change
  useEffect(() => {
    if (enableAI && session) {
      fetchAIInsights();
    }
  }, [enableAI, session, dateRange]);

  const exportData = (format: 'json' | 'csv' | 'pdf') => {
    if (onExport) {
      const data = {
        metrics: mockMetrics,
        queries: mockTopQueries,
        trends: mockTrendData,
        segments: mockUserSegments,
        dateRange,
        exportedAt: new Date().toISOString()
      };
      onExport(data, format);
    }
    announce(`Data exported as ${format.toUpperCase()}`, 'polite');
  };

  const formatMetricValue = (value: number, format: SearchMetric['format']) => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'time':
        return `${value.toFixed(3)}s`;
      case 'currency':
        return `$${value.toFixed(2)}`;
      default:
        return value.toLocaleString();
    }
  };

  const getChangeIcon = (changeType: 'increase' | 'decrease' | 'neutral') => {
    switch (changeType) {
      case 'increase':
        return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'decrease':
        return <ArrowDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderMetricCard = (metric: SearchMetric) => (
    <motion.div
      key={metric.id}
      layout
      whileHover={{ scale: 1.02 }}
      className={`bg-white p-6 rounded-xl shadow-lg border-l-4 cursor-pointer transition-all duration-300 ${
        selectedMetric?.id === metric.id 
          ? `border-${metric.color}-500 ring-2 ring-${metric.color}-100` 
          : `border-${metric.color}-300 hover:border-${metric.color}-400`
      }`}
      onClick={() => setSelectedMetric(selectedMetric?.id === metric.id ? null : metric)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-${metric.color}-100 rounded-lg`}>
          <div className={`text-${metric.color}-600`}>
            {metric.icon}
          </div>
        </div>
        <div className="flex items-center space-x-1">
          {getChangeIcon(metric.changeType)}
          <span className={`text-sm font-medium ${
            metric.changeType === 'increase' ? 'text-green-600' : 
            metric.changeType === 'decrease' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {Math.abs(metric.change)}%
          </span>
        </div>
      </div>

      <div className="mb-2">
        <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.label}</h3>
        <div className="text-2xl font-bold text-gray-900">
          {formatMetricValue(metric.value, metric.format)}
        </div>
      </div>

      {/* Mini trend chart */}
      <div className="flex items-end space-x-1 h-8">
        {metric.trend.map((value, index) => {
          const height = ((value - Math.min(...metric.trend)) / (Math.max(...metric.trend) - Math.min(...metric.trend))) * 100;
          return (
            <div
              key={index}
              className={`bg-${metric.color}-300 rounded-t opacity-60 hover:opacity-100 transition-opacity`}
              style={{ height: `${Math.max(height, 10)}%`, width: '12px' }}
            />
          );
        })}
      </div>
    </motion.div>
  );

  const renderQueryRow = (query: SearchQuery, index: number) => (
    <motion.div
      key={query.query}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
        selectedQuery?.query === query.query ? 'bg-indigo-50 border-indigo-300' : ''
      }`}
      onClick={() => setSelectedQuery(selectedQuery?.query === query.query ? null : query)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-mono text-gray-500">#{index + 1}</span>
          <h4 className="font-semibold text-gray-900">"{query.query}"</h4>
          <div className="flex items-center space-x-1">
            {getChangeIcon(query.changeType)}
            <span className={`text-xs ${
              query.changeType === 'increase' ? 'text-green-600' : 
              query.changeType === 'decrease' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {Math.abs(query.change)}%
            </span>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${
          selectedQuery?.query === query.query ? 'rotate-90' : ''
        }`} />
      </div>

      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Searches:</span>
          <div className="font-medium">{query.count.toLocaleString()}</div>
        </div>
        <div>
          <span className="text-gray-500">Success Rate:</span>
          <div className="font-medium">{query.successRate}%</div>
        </div>
        <div>
          <span className="text-gray-500">Avg Results:</span>
          <div className="font-medium">{query.avgResultsFound}</div>
        </div>
        <div>
          <span className="text-gray-500">Click-through:</span>
          <div className="font-medium">{query.avgClickThrough}%</div>
        </div>
      </div>

      <AnimatePresence>
        {selectedQuery?.query === query.query && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Categories */}
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Top Categories</h5>
                <div className="space-y-1">
                  {query.categories.map(category => (
                    <span key={category} className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs mr-1">
                      #{category}
                    </span>
                  ))}
                </div>
              </div>

              {/* Devices */}
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Device Breakdown</h5>
                <div className="space-y-2">
                  {Object.entries(query.devices).map(([device, percentage]) => (
                    <div key={device} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {device === 'mobile' && <Smartphone className="w-4 h-4 text-gray-500" />}
                        {device === 'desktop' && <Monitor className="w-4 h-4 text-gray-500" />}
                        {device === 'tablet' && <Tablet className="w-4 h-4 text-gray-500" />}
                        <span className="text-sm capitalize">{device}</span>
                      </div>
                      <span className="text-sm font-medium">{percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Top Locations</h5>
                <div className="space-y-2">
                  {Object.entries(query.locations).slice(0, 3).map(([location, percentage]) => (
                    <div key={location} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{location}</span>
                      </div>
                      <span className="text-sm font-medium">{percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const renderUserSegment = (segment: UserSegment) => (
    <div key={segment.segment} className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">{segment.segment}</h4>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">{segment.count.toLocaleString()}</div>
          <div className="text-sm text-gray-500">{segment.percentage}% of users</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-sm text-gray-500">Avg Searches/Session</span>
          <div className="text-lg font-medium">{segment.avgSearchesPerSession}</div>
        </div>
        <div>
          <span className="text-sm text-gray-500">Conversion Rate</span>
          <div className="text-lg font-medium">{segment.conversionRate}%</div>
        </div>
      </div>

      <div>
        <span className="text-sm text-gray-500 mb-2 block">Top Queries</span>
        <div className="flex flex-wrap gap-1">
          {segment.topQueries.map(query => (
            <span key={query} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
              {query}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'queries', label: 'Top Queries', icon: <Search className="w-4 h-4" /> },
    { id: 'trends', label: 'Trends', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'segments', label: 'User Segments', icon: <Users className="w-4 h-4" /> },
    ...(enableAI ? [{ id: 'ai-insights', label: 'AI Insights', icon: <Zap className="w-4 h-4" /> }] : [])
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search Analytics</h1>
          <p className="text-gray-600">
            Insights and performance metrics for your search functionality
            {creatorId && ' for your content'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select 
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            value={dateRange}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>

          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <div className="relative">
            <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockMetrics.map(renderMetricCard)}
            </div>

            {/* Selected Metric Details */}
            <AnimatePresence>
              {selectedMetric && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white p-6 rounded-xl shadow-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedMetric.label} - Detailed View
                    </h3>
                    <button
                      onClick={() => setSelectedMetric(null)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Trend Analysis</h4>
                      <div className="h-32 bg-gray-50 rounded-lg flex items-end justify-center space-x-2 p-4">
                        {selectedMetric.trend.map((value, index) => {
                          const height = ((value - Math.min(...selectedMetric.trend)) / (Math.max(...selectedMetric.trend) - Math.min(...selectedMetric.trend))) * 100;
                          return (
                            <div
                              key={index}
                              className={`bg-${selectedMetric.color}-400 rounded-t transition-all hover:bg-${selectedMetric.color}-500`}
                              style={{ height: `${Math.max(height, 15)}%`, width: '24px' }}
                              title={formatMetricValue(value, selectedMetric.format)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Key Insights</h4>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Info className="w-4 h-4 text-blue-500" />
                          <span>Current value is {selectedMetric.change > 0 ? 'above' : 'below'} historical average</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Activity className="w-4 h-4 text-green-500" />
                          <span>Showing {selectedMetric.changeType} trend over selected period</span>
                        </div>
                        {selectedMetric.changeType === 'increase' && (
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span>Performance improvement detected</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'queries' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Popular Search Queries</h2>
              <div className="space-y-4">
                {mockTopQueries.map((query, index) => renderQueryRow(query, index))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Trends Over Time</h2>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Interactive trend chart would be rendered here</p>
                  <p className="text-sm">Using your preferred charting library (Chart.js, D3, etc.)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mockTrendData.slice(-1).map(trend => (
                <div key={trend.date} className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-700 mb-2">Latest Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Searches:</span>
                      <span className="font-medium">{trend.searches.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate:</span>
                      <span className="font-medium">{trend.successRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Session Time:</span>
                      <span className="font-medium">{trend.avgSessionTime}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bounce Rate:</span>
                      <span className="font-medium">{trend.bounceRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'segments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mockUserSegments.map(renderUserSegment)}
            </div>
          </div>
        )}

        {activeTab === 'ai-insights' && enableAI && (
          <div className="space-y-6">
            {/* AI Insights Header */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Zap className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">AI-Powered Insights</h2>
                    <p className="text-gray-600">Advanced analytics and recommendations powered by AI</p>
                  </div>
                </div>
                <button
                  onClick={() => fetchAIInsights()}
                  disabled={aiLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>{aiLoading ? 'Analyzing...' : 'Refresh Insights'}</span>
                </button>
              </div>
              
              {aiInsights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{aiInsights.length}</div>
                    <div className="text-gray-600">Total Insights</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {aiInsights.filter(i => i.priority === 'high' || i.priority === 'critical').length}
                    </div>
                    <div className="text-gray-600">High Priority</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(aiInsights.reduce((sum, i) => sum + i.confidence, 0) / aiInsights.length * 100)}%
                    </div>
                    <div className="text-gray-600">Avg Confidence</div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Insights Grid */}
            {aiLoading ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Your Data</h3>
                  <p className="text-gray-600">AI is processing your search analytics to generate insights...</p>
                </div>
              </div>
            ) : aiInsights.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {aiInsights.map((insight, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-white rounded-xl shadow-lg border-l-4 p-6 ${
                      insight.priority === 'critical' ? 'border-red-500' :
                      insight.priority === 'high' ? 'border-orange-500' :
                      insight.priority === 'medium' ? 'border-yellow-500' :
                      'border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          insight.type === 'trend' ? 'bg-blue-100' :
                          insight.type === 'recommendation' ? 'bg-green-100' :
                          insight.type === 'opportunity' ? 'bg-purple-100' :
                          'bg-red-100'
                        }`}>
                          {insight.type === 'trend' && <TrendingUp className="w-5 h-5 text-blue-600" />}
                          {insight.type === 'recommendation' && <Target className="w-5 h-5 text-green-600" />}
                          {insight.type === 'opportunity' && <Star className="w-5 h-5 text-purple-600" />}
                          {insight.type === 'warning' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            insight.priority === 'critical' ? 'bg-red-100 text-red-700' :
                            insight.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {insight.priority.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {Math.round(insight.confidence * 100)}%
                        </div>
                        <div className="text-xs text-gray-500">confidence</div>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 mb-4">{insight.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        {insight.actionable && (
                          <>
                            <Activity className="w-4 h-4" />
                            <span>Actionable</span>
                          </>
                        )}
                      </div>
                      
                      {insight.actionable && (
                        <button className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200 transition-colors">
                          Take Action
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12">
                <div className="text-center">
                  <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No AI Insights Available</h3>
                  <p className="text-gray-600 mb-4">We need more data to generate meaningful insights.</p>
                  <button
                    onClick={() => fetchAIInsights()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SearchAnalytics;
