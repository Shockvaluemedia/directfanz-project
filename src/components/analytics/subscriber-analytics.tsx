'use client';

import React, { useState, useMemo } from 'react';
import { format, subDays, subMonths, subWeeks, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { ModernLineChart, ModernAreaChart, ModernBarChart, ModernPieChart } from '@/components/ui/charts';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle, EnhancedCardDescription } from '@/components/ui/enhanced-card';
import { StatsWidget, StatsGrid } from '@/components/ui/stats-widget';
import { Users, UserPlus, UserMinus, Heart, Eye, MessageCircle, Clock, TrendingUp } from 'lucide-react';

// Time period type
type TimePeriod = '7d' | '30d' | '90d' | '1y';

interface SubscriberData {
  date: string;
  totalSubscribers: number;
  newSubscribers: number;
  churnedSubscribers: number;
  netGrowth: number;
  engagementRate: number;
  activeSubscribers: number;
}

interface SubscriptionTierBreakdown {
  tier: string;
  count: number;
  percentage: number;
  avgEngagement: number;
  avgRevenue: number;
}

interface GeographicData {
  country: string;
  subscribers: number;
  percentage: number;
  avgEngagement: number;
}

interface EngagementMetrics {
  metric: string;
  value: number;
  change: number;
  description: string;
}

// Demo data generators
function generateSubscriberData(period: TimePeriod): SubscriberData[] {
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
      dates = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
      break;
  }

  let cumulativeSubscribers = 150; // Starting base

  return dates.map((date, index) => {
    const newSubs = Math.round(8 + Math.random() * 12 + Math.sin(index / 3) * 5);
    const churnSubs = Math.round(2 + Math.random() * 4);
    const netGrowth = newSubs - churnSubs;
    
    cumulativeSubscribers += netGrowth;
    
    return {
      date: format(date, period === '1y' ? 'MMM yyyy' : period === '90d' ? 'MMM dd' : 'MMM dd'),
      totalSubscribers: Math.max(cumulativeSubscribers, 0),
      newSubscribers: newSubs,
      churnedSubscribers: churnSubs,
      netGrowth,
      engagementRate: Math.round(60 + Math.random() * 25), // 60-85% engagement
      activeSubscribers: Math.round(cumulativeSubscribers * (0.7 + Math.random() * 0.2)),
    };
  });
}

function generateTierBreakdown(): SubscriptionTierBreakdown[] {
  return [
    { tier: 'Basic ($5)', count: 245, percentage: 47.8, avgEngagement: 72, avgRevenue: 5 },
    { tier: 'Premium ($15)', count: 156, percentage: 30.4, avgEngagement: 84, avgRevenue: 15 },
    { tier: 'VIP ($30)', count: 78, percentage: 15.2, avgEngagement: 91, avgRevenue: 30 },
    { tier: 'Exclusive ($50)', count: 34, percentage: 6.6, avgEngagement: 95, avgRevenue: 50 },
  ];
}

function generateGeographicData(): GeographicData[] {
  return [
    { country: 'United States', subscribers: 189, percentage: 36.9, avgEngagement: 78 },
    { country: 'United Kingdom', subscribers: 87, percentage: 17.0, avgEngagement: 82 },
    { country: 'Canada', subscribers: 65, percentage: 12.7, avgEngagement: 81 },
    { country: 'Australia', subscribers: 43, percentage: 8.4, avgEngagement: 79 },
    { country: 'Germany', subscribers: 38, percentage: 7.4, avgEngagement: 75 },
    { country: 'Other', subscribers: 91, percentage: 17.6, avgEngagement: 73 },
  ];
}

function generateEngagementMetrics(): EngagementMetrics[] {
  return [
    { metric: 'Average Session Time', value: 12.5, change: 8.2, description: 'minutes per session' },
    { metric: 'Content Completion Rate', value: 74, change: -2.1, description: 'percentage of content viewed' },
    { metric: 'Comments per Post', value: 8.3, change: 15.7, description: 'average comments' },
    { metric: 'Likes per Post', value: 47, change: 12.4, description: 'average likes' },
  ];
}

interface SubscriberAnalyticsProps {
  className?: string;
}

export function SubscriberAnalytics({ className }: SubscriberAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'growth' | 'engagement' | 'demographics'>('growth');

  // Generate data based on selected period
  const subscriberData = useMemo(() => generateSubscriberData(selectedPeriod), [selectedPeriod]);
  const tierData = useMemo(() => generateTierBreakdown(), []);
  const geoData = useMemo(() => generateGeographicData(), []);
  const engagementMetrics = useMemo(() => generateEngagementMetrics(), []);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const currentSubs = subscriberData[subscriberData.length - 1]?.totalSubscribers || 0;
    const previousSubs = subscriberData[0]?.totalSubscribers || 0;
    const totalNewSubs = subscriberData.reduce((sum, item) => sum + item.newSubscribers, 0);
    const totalChurnSubs = subscriberData.reduce((sum, item) => sum + item.churnedSubscribers, 0);
    const avgEngagement = subscriberData.reduce((sum, item) => sum + item.engagementRate, 0) / subscriberData.length;
    const growthRate = previousSubs > 0 ? ((currentSubs - previousSubs) / previousSubs) * 100 : 0;
    
    return {
      totalSubscribers: currentSubs,
      newSubscribers: totalNewSubs,
      churnedSubscribers: totalChurnSubs,
      netGrowth: totalNewSubs - totalChurnSubs,
      growthRate,
      avgEngagement,
      churnRate: totalChurnSubs > 0 ? (totalChurnSubs / (currentSubs + totalChurnSubs)) * 100 : 0,
    };
  }, [subscriberData]);

  const periodOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
  ];

  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscriber Analytics</h1>
          <p className="text-gray-600 mt-1">Track subscriber growth and engagement patterns</p>
        </div>
        
        <div className="flex items-center gap-3">
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
          title="Total Subscribers"
          value={formatNumber(summaryStats.totalSubscribers)}
          icon={<Users className="w-5 h-5" />}
          trend={summaryStats.growthRate > 0 ? 'up' : 'down'}
          trendValue={formatPercentage(Math.abs(summaryStats.growthRate))}
          description="Active subscribers"
          variant="success"
          showSparkline={true}
          sparklineData={subscriberData.map(d => d.totalSubscribers)}
        />
        
        <StatsWidget
          title="New Subscribers"
          value={formatNumber(summaryStats.newSubscribers)}
          icon={<UserPlus className="w-5 h-5" />}
          trend="up"
          trendValue="+18%"
          description="This period"
          variant="info"
        />
        
        <StatsWidget
          title="Churn Rate"
          value={formatPercentage(summaryStats.churnRate)}
          icon={<UserMinus className="w-5 h-5" />}
          trend="down"
          trendValue="-2.4%"
          description="Monthly churn"
          variant="warning"
        />
        
        <StatsWidget
          title="Engagement Rate"
          value={formatPercentage(summaryStats.avgEngagement)}
          icon={<Heart className="w-5 h-5" />}
          trend="up"
          trendValue="+5.3%"
          description="Average engagement"
          variant="default"
        />
      </StatsGrid>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Subscriber Growth Chart */}
        <div className="lg:col-span-2">
          <ModernAreaChart
            title="Subscriber Growth Over Time"
            description="Track total subscribers, new acquisitions, and churn"
            data={subscriberData}
            height={400}
            variant="elevated"
            xAxisKey="date"
            areas={[
              { dataKey: 'totalSubscribers', name: 'Total Subscribers', gradient: true },
              { dataKey: 'newSubscribers', name: 'New Subscribers', color: '#10b981' },
              { dataKey: 'churnedSubscribers', name: 'Churned Subscribers', color: '#f87171' },
            ]}
            formatXAxis={(value) => value}
            formatTooltip={formatNumber}
            stacked={false}
            actions={
              <div className="flex gap-2">
                <EnhancedButton
                  variant={selectedMetric === 'growth' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedMetric('growth')}
                >
                  Growth
                </EnhancedButton>
                <EnhancedButton
                  variant={selectedMetric === 'engagement' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedMetric('engagement')}
                >
                  Engagement
                </EnhancedButton>
                <EnhancedButton
                  variant={selectedMetric === 'demographics' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedMetric('demographics')}
                >
                  Demographics
                </EnhancedButton>
              </div>
            }
          />
        </div>

        {/* Subscription Tiers Distribution */}
        <ModernPieChart
          title="Subscription Tiers"
          description="Distribution of subscribers across subscription tiers"
          data={tierData.map(item => ({
            name: item.tier,
            value: item.count,
          }))}
          height={350}
          variant="elevated"
          formatTooltip={formatNumber}
          innerRadius={60}
          showLabels={true}
        />

        {/* Geographic Distribution */}
        <ModernBarChart
          title="Geographic Distribution"
          description="Subscriber distribution by country"
          data={geoData}
          height={350}
          variant="elevated"
          xAxisKey="country"
          bars={[
            { dataKey: 'subscribers', name: 'Subscribers', color: '#6366f1' },
          ]}
          formatTooltip={formatNumber}
          formatXAxis={(value) => value.length > 10 ? value.substring(0, 10) + '...' : value}
        />
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Engagement Metrics */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Engagement Metrics</EnhancedCardTitle>
            <EnhancedCardDescription>Key engagement indicators</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-4">
              {engagementMetrics.map((metric, index) => (
                <div key={metric.metric} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900 text-sm">{metric.metric}</h4>
                    <div className={`flex items-center gap-1 text-xs ${
                      metric.change > 0 ? 'text-green-600' : 'text-red-500'
                    }`}>
                      <TrendingUp className={`w-3 h-3 ${metric.change < 0 ? 'rotate-180' : ''}`} />
                      {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-bold text-gray-900">
                      {metric.metric.includes('Rate') || metric.metric.includes('Percentage') 
                        ? formatPercentage(metric.value)
                        : metric.value
                      }
                    </span>
                    <span className="text-xs text-gray-500">{metric.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </EnhancedCardContent>
        </EnhancedCard>

        {/* Tier Performance */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Tier Performance</EnhancedCardTitle>
            <EnhancedCardDescription>Engagement and revenue by subscription tier</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-4">
              {tierData.map((tier, index) => (
                <div key={tier.tier} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">{tier.tier}</span>
                    <span className="text-sm text-gray-500">{tier.count} subscribers</span>
                  </div>
                  
                  {/* Engagement Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Engagement</span>
                      <span className="text-xs font-semibold text-gray-700">{tier.avgEngagement}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${tier.avgEngagement}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Revenue Info */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Avg Revenue</span>
                    <span className="font-semibold text-gray-700">${tier.avgRevenue}/month</span>
                  </div>
                </div>
              ))}
            </div>
          </EnhancedCardContent>
        </EnhancedCard>

        {/* Recent Activity */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Recent Activity</EnhancedCardTitle>
            <EnhancedCardDescription>Latest subscriber actions and trends</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => {
                const actions = [
                  { icon: UserPlus, text: 'New subscription', color: 'text-green-600 bg-green-100' },
                  { icon: Heart, text: 'Content liked', color: 'text-pink-600 bg-pink-100' },
                  { icon: MessageCircle, text: 'Comment posted', color: 'text-blue-600 bg-blue-100' },
                  { icon: Eye, text: 'Content viewed', color: 'text-indigo-600 bg-indigo-100' },
                ];
                const action = actions[index % actions.length];
                const Icon = action.icon;
                
                return (
                  <div key={index} className="flex items-center gap-3 py-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${action.color}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{action.text}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {Math.floor(Math.random() * 60)} minutes ago
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </EnhancedCardContent>
        </EnhancedCard>
      </div>

      {/* Growth Insights */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle>Growth Insights</EnhancedCardTitle>
          <EnhancedCardDescription>Key insights and recommendations for subscriber growth</EnhancedCardDescription>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <h4 className="font-semibold text-green-900">Growth Rate</h4>
              </div>
              <p className="text-2xl font-bold text-green-700">{formatPercentage(summaryStats.growthRate)}</p>
              <p className="text-sm text-green-600 mt-1">This period vs. last period</p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Retention</h4>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatPercentage(100 - summaryStats.churnRate)}</p>
              <p className="text-sm text-blue-600 mt-1">Monthly retention rate</p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-purple-600" />
                <h4 className="font-semibold text-purple-900">Engagement</h4>
              </div>
              <p className="text-2xl font-bold text-purple-700">{formatPercentage(summaryStats.avgEngagement)}</p>
              <p className="text-sm text-purple-600 mt-1">Average engagement rate</p>
            </div>
            
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-orange-600" />
                <h4 className="font-semibold text-orange-900">Conversion</h4>
              </div>
              <p className="text-2xl font-bold text-orange-700">
                {formatPercentage((summaryStats.newSubscribers / (summaryStats.newSubscribers * 3)) * 100)}
              </p>
              <p className="text-sm text-orange-600 mt-1">Visitor to subscriber rate</p>
            </div>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>
    </div>
  );
}