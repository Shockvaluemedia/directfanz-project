'use client';

import React, { useState, useMemo } from 'react';
import { format, subDays, subMonths, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
import { ModernLineChart, ModernAreaChart, ModernBarChart, ModernPieChart } from '@/components/ui/charts';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle, EnhancedCardDescription } from '@/components/ui/enhanced-card';
import { StatsWidget, StatsGrid } from '@/components/ui/stats-widget';
import { Play, Heart, Eye, MessageCircle, Share2, Download, Star, Clock, Music, Image, Video, Mic } from 'lucide-react';

// Time period type
type TimePeriod = '7d' | '30d' | '90d' | '1y';

// Content type
type ContentType = 'all' | 'video' | 'audio' | 'photo' | 'live';

interface ContentPerformanceData {
  date: string;
  totalViews: number;
  likes: number;
  comments: number;
  shares: number;
  downloads: number;
  engagementRate: number;
}

interface ContentItem {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'photo' | 'live';
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  downloads: number;
  revenue: number;
  duration?: string;
  engagementRate: number;
}

interface ContentTypeStats {
  type: string;
  icon: React.ComponentType<any>;
  count: number;
  totalViews: number;
  avgEngagement: number;
  totalRevenue: number;
  color: string;
}

interface PopularityMetrics {
  metric: string;
  value: number;
  change: number;
  description: string;
}

// Demo data generators
function generateContentPerformanceData(period: TimePeriod): ContentPerformanceData[] {
  const now = new Date();
  let dates: Date[] = [];
  
  switch (period) {
    case '7d':
      dates = eachDayOfInterval({ start: subDays(now, 6), end: now });
      break;
    case '30d':
      dates = eachDayOfInterval({ start: subDays(now, 29), end: now });
      break;
    case '90d':
      dates = eachWeekOfInterval({ start: subDays(now, 89), end: now });
      break;
    case '1y':
      dates = eachWeekOfInterval({ start: subDays(now, 365), end: now });
      break;
  }

  return dates.map((date, index) => {
    const baseViews = 120 + Math.random() * 80;
    const views = Math.round(baseViews + Math.sin(index / 4) * 30);
    const likes = Math.round(views * (0.08 + Math.random() * 0.07)); // 8-15% like rate
    const comments = Math.round(views * (0.02 + Math.random() * 0.03)); // 2-5% comment rate
    const shares = Math.round(views * (0.01 + Math.random() * 0.02)); // 1-3% share rate
    const downloads = Math.round(views * (0.05 + Math.random() * 0.05)); // 5-10% download rate
    
    return {
      date: format(date, period === '1y' ? 'MMM yyyy' : period === '90d' ? 'MMM dd' : 'MMM dd'),
      totalViews: views,
      likes,
      comments,
      shares,
      downloads,
      engagementRate: Math.round(((likes + comments + shares) / views) * 100),
    };
  });
}

function generateContentItems(): ContentItem[] {
  const titles = [
    'Acoustic Session: New Song Preview',
    'Behind the Scenes: Studio Time',
    'Exclusive Photo Set: Concert Prep',
    'Live Stream: Q&A with Fans',
    'Music Video: Latest Single',
    'Voice Message: Thank You Fans',
    'Photography: Sunset Vibes',
    'Live Performance: Acoustic Cover',
    'Studio Session: Recording Process',
    'Personal Update: Tour Announcement',
  ];

  const types: ContentItem['type'][] = ['video', 'audio', 'photo', 'live'];

  return titles.map((title, index) => {
    const type = types[index % types.length];
    const views = Math.round(50 + Math.random() * 300);
    const likes = Math.round(views * (0.08 + Math.random() * 0.07));
    const comments = Math.round(views * (0.02 + Math.random() * 0.03));
    const shares = Math.round(views * (0.01 + Math.random() * 0.02));
    const downloads = Math.round(views * (0.05 + Math.random() * 0.05));
    const revenue = Math.round(views * (0.1 + Math.random() * 0.3)); // $0.10-$0.40 per view

    return {
      id: `content-${index}`,
      title,
      type,
      createdAt: format(subDays(new Date(), Math.floor(Math.random() * 30)), 'MMM dd, yyyy'),
      views,
      likes,
      comments,
      shares,
      downloads,
      revenue,
      duration: type === 'video' || type === 'audio' ? `${Math.floor(Math.random() * 10) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}` : undefined,
      engagementRate: Math.round(((likes + comments + shares) / views) * 100),
    };
  });
}

function generateContentTypeStats(): ContentTypeStats[] {
  return [
    {
      type: 'Music Videos',
      icon: Video,
      count: 12,
      totalViews: 2840,
      avgEngagement: 14.2,
      totalRevenue: 568,
      color: '#6366f1',
    },
    {
      type: 'Audio Tracks',
      icon: Music,
      count: 28,
      totalViews: 4560,
      avgEngagement: 11.8,
      totalRevenue: 912,
      color: '#10b981',
    },
    {
      type: 'Photo Sets',
      icon: Image,
      count: 45,
      totalViews: 3120,
      avgEngagement: 9.5,
      totalRevenue: 624,
      color: '#f59e0b',
    },
    {
      type: 'Live Streams',
      icon: Mic,
      count: 8,
      totalViews: 1890,
      avgEngagement: 18.7,
      totalRevenue: 378,
      color: '#ef4444',
    },
  ];
}

function generatePopularityMetrics(): PopularityMetrics[] {
  return [
    { metric: 'Average Views per Post', value: 187, change: 12.5, description: 'per content item' },
    { metric: 'Engagement Rate', value: 13.4, change: 8.2, description: 'likes, comments, shares' },
    { metric: 'Content Upload Frequency', value: 4.2, change: -5.1, description: 'posts per week' },
    { metric: 'Subscriber Conversion', value: 2.8, change: 15.3, description: 'views to subscribers' },
  ];
}

interface ContentPerformanceAnalyticsProps {
  className?: string;
}

export function ContentPerformanceAnalytics({ className }: ContentPerformanceAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30d');
  const [selectedContentType, setSelectedContentType] = useState<ContentType>('all');
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'trends'>('overview');

  // Generate data based on selected period
  const performanceData = useMemo(() => generateContentPerformanceData(selectedPeriod), [selectedPeriod]);
  const contentItems = useMemo(() => generateContentItems(), []);
  const contentTypeStats = useMemo(() => generateContentTypeStats(), []);
  const popularityMetrics = useMemo(() => generatePopularityMetrics(), []);

  // Filter content items based on selected type
  const filteredContent = useMemo(() => {
    if (selectedContentType === 'all') return contentItems;
    return contentItems.filter(item => item.type === selectedContentType);
  }, [contentItems, selectedContentType]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalViews = performanceData.reduce((sum, item) => sum + item.totalViews, 0);
    const totalLikes = performanceData.reduce((sum, item) => sum + item.likes, 0);
    const totalComments = performanceData.reduce((sum, item) => sum + item.comments, 0);
    const totalShares = performanceData.reduce((sum, item) => sum + item.shares, 0);
    const totalDownloads = performanceData.reduce((sum, item) => sum + item.downloads, 0);
    const avgEngagement = performanceData.reduce((sum, item) => sum + item.engagementRate, 0) / performanceData.length;

    return {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalDownloads,
      avgEngagement,
      totalContent: filteredContent.length,
      avgViewsPerContent: Math.round(totalViews / Math.max(filteredContent.length, 1)),
    };
  }, [performanceData, filteredContent.length]);

  const periodOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
  ];

  const contentTypeOptions = [
    { value: 'all', label: 'All Content' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'photo', label: 'Photos' },
    { value: 'live', label: 'Live Streams' },
  ];

  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  // Top performing content for display
  const topContent = [...filteredContent]
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 5);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Performance</h1>
          <p className="text-gray-600 mt-1">Analyze content engagement and performance metrics</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Content Type Filter */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {contentTypeOptions.map((option) => (
              <EnhancedButton
                key={option.value}
                variant={selectedContentType === option.value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedContentType(option.value as ContentType)}
                className="text-xs"
              >
                {option.label}
              </EnhancedButton>
            ))}
          </div>

          {/* Period Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {periodOptions.map((option) => (
              <EnhancedButton
                key={option.value}
                variant={selectedPeriod === option.value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod(option.value as TimePeriod)}
                className="text-xs"
              >
                {option.label}
              </EnhancedButton>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <StatsGrid columns={4}>
        <StatsWidget
          title="Total Views"
          value={formatNumber(summaryStats.totalViews)}
          icon={<Eye className="w-5 h-5" />}
          trend="up"
          trendValue="+15.2%"
          description="This period"
          variant="success"
          showSparkline={true}
          sparklineData={performanceData.map(d => d.totalViews)}
        />
        
        <StatsWidget
          title="Engagement Rate"
          value={formatPercentage(summaryStats.avgEngagement)}
          icon={<Heart className="w-5 h-5" />}
          trend="up"
          trendValue="+8.7%"
          description="Avg engagement"
          variant="info"
        />
        
        <StatsWidget
          title="Total Content"
          value={formatNumber(summaryStats.totalContent)}
          icon={<Play className="w-5 h-5" />}
          trend="up"
          trendValue="+12"
          description="Content pieces"
          variant="warning"
        />
        
        <StatsWidget
          title="Avg Views/Content"
          value={formatNumber(summaryStats.avgViewsPerContent)}
          icon={<Star className="w-5 h-5" />}
          trend="up"
          trendValue="+23%"
          description="Per content item"
          variant="default"
        />
      </StatsGrid>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Performance Trend Chart */}
        <div className="lg:col-span-2">
          <ModernAreaChart
            title="Content Performance Over Time"
            description="Track views, engagement, and interactions across all content"
            data={performanceData}
            height={400}
            variant="elevated"
            xAxisKey="date"
            areas={[
              { dataKey: 'totalViews', name: 'Total Views', gradient: true },
              { dataKey: 'likes', name: 'Likes', color: '#f87171' },
              { dataKey: 'comments', name: 'Comments', color: '#60a5fa' },
              { dataKey: 'shares', name: 'Shares', color: '#34d399' },
            ]}
            formatXAxis={(value) => value}
            formatTooltip={formatNumber}
            stacked={false}
            actions={
              <div className="flex gap-2">
                <EnhancedButton
                  variant={selectedView === 'overview' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedView('overview')}
                >
                  Overview
                </EnhancedButton>
                <EnhancedButton
                  variant={selectedView === 'detailed' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedView('detailed')}
                >
                  Detailed
                </EnhancedButton>
                <EnhancedButton
                  variant={selectedView === 'trends' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedView('trends')}
                >
                  Trends
                </EnhancedButton>
              </div>
            }
          />
        </div>

        {/* Content Type Performance */}
        <ModernBarChart
          title="Performance by Content Type"
          description="Views and engagement across different content types"
          data={contentTypeStats}
          height={350}
          variant="elevated"
          xAxisKey="type"
          bars={[
            { dataKey: 'totalViews', name: 'Views', color: '#6366f1' },
            { dataKey: 'avgEngagement', name: 'Engagement %', color: '#10b981' },
          ]}
          formatTooltip={(value, name) => 
            name === 'Engagement %' ? formatPercentage(value) : formatNumber(value)
          }
        />

        {/* Content Distribution */}
        <ModernPieChart
          title="Content Distribution"
          description="Breakdown of content types by volume"
          data={contentTypeStats.map(item => ({
            name: item.type,
            value: item.count,
          }))}
          height={350}
          variant="elevated"
          formatTooltip={formatNumber}
          innerRadius={60}
          showLabels={true}
        />
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Performing Content */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Top Performing Content</EnhancedCardTitle>
            <EnhancedCardDescription>Highest engagement content this period</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-4">
              {topContent.map((item, index) => {
                const getTypeIcon = (type: ContentItem['type']) => {
                  switch (type) {
                    case 'video': return Video;
                    case 'audio': return Music;
                    case 'photo': return Image;
                    case 'live': return Mic;
                  }
                };
                const Icon = getTypeIcon(item.type);

                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <Icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>{formatNumber(item.views)} views</span>
                        <span>{formatPercentage(item.engagementRate)} engagement</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </EnhancedCardContent>
        </EnhancedCard>

        {/* Popularity Metrics */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Popularity Metrics</EnhancedCardTitle>
            <EnhancedCardDescription>Key performance indicators</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-4">
              {popularityMetrics.map((metric) => (
                <div key={metric.metric} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900 text-sm">{metric.metric}</h4>
                    <div className={`flex items-center gap-1 text-xs ${
                      metric.change > 0 ? 'text-green-600' : 'text-red-500'
                    }`}>
                      <Clock className={`w-3 h-3 ${metric.change < 0 ? 'rotate-180' : ''}`} />
                      {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-bold text-gray-900">
                      {metric.metric.includes('Rate') || metric.metric.includes('Conversion') 
                        ? formatPercentage(metric.value)
                        : formatNumber(metric.value)
                      }
                    </span>
                    <span className="text-xs text-gray-500">{metric.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </EnhancedCardContent>
        </EnhancedCard>

        {/* Content Type Breakdown */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Content Type Stats</EnhancedCardTitle>
            <EnhancedCardDescription>Performance breakdown by content type</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-4">
              {contentTypeStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" style={{ color: stat.color }} />
                        <span className="font-medium text-gray-900 text-sm">{stat.type}</span>
                      </div>
                      <span className="text-sm text-gray-500">{stat.count} items</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Total Views</span>
                        <p className="font-semibold text-gray-900">{formatNumber(stat.totalViews)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Avg Engagement</span>
                        <p className="font-semibold text-gray-900">{formatPercentage(stat.avgEngagement)}</p>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(stat.avgEngagement * 5, 100)}%`,
                          backgroundColor: stat.color 
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </EnhancedCardContent>
        </EnhancedCard>
      </div>

      {/* Recent Content Performance */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle>Recent Content Performance</EnhancedCardTitle>
          <EnhancedCardDescription>Latest content items with detailed metrics</EnhancedCardDescription>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Content</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Type</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Views</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Likes</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Comments</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Engagement</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filteredContent.slice(0, 8).map((item) => {
                  const getTypeIcon = (type: ContentItem['type']) => {
                    switch (type) {
                      case 'video': return Video;
                      case 'audio': return Music;
                      case 'photo': return Image;
                      case 'live': return Mic;
                    }
                  };
                  const Icon = getTypeIcon(item.type);

                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-xs">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.createdAt}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-600" />
                          <span className="capitalize text-gray-700">{item.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-gray-900">
                        {formatNumber(item.views)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-700">
                        {formatNumber(item.likes)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-700">
                        {formatNumber(item.comments)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          item.engagementRate > 15 
                            ? 'bg-green-100 text-green-700'
                            : item.engagementRate > 10
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {formatPercentage(item.engagementRate)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-gray-900">
                        ${item.revenue}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>
    </div>
  );
}