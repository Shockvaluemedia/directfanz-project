'use client';

import React, { useState, useMemo } from 'react';
import { format, subDays, subMonths, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { ModernLineChart, ModernAreaChart, ModernBarChart, ModernPieChart } from '@/components/ui/charts';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle, EnhancedCardDescription } from '@/components/ui/enhanced-card';
import { StatsWidget, StatsGrid } from '@/components/ui/stats-widget';
import { DollarSign, TrendingUp, CreditCard, Target, Calendar, Filter, Download } from 'lucide-react';

// Time period type
type TimePeriod = '7d' | '30d' | '90d' | '1y';

interface RevenueData {
  date: string;
  revenue: number;
  subscriptions: number;
  tips: number;
  content: number;
  subscribers: number;
}

interface ContentTypeRevenue {
  type: string;
  revenue: number;
  count: number;
}

interface SubscriptionTierData {
  tier: string;
  subscribers: number;
  revenue: number;
  avgRevenue: number;
}

// Demo data generator
function generateRevenueData(period: TimePeriod): RevenueData[] {
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

  return dates.map((date, index) => {
    const baseRevenue = 150 + Math.random() * 100;
    const growth = index * 5; // Simulated growth trend
    
    return {
      date: format(date, period === '1y' ? 'MMM yyyy' : period === '90d' ? 'MMM dd' : 'MMM dd'),
      revenue: Math.round(baseRevenue + growth + Math.sin(index / 2) * 30),
      subscriptions: Math.round((baseRevenue + growth) * 0.7),
      tips: Math.round((baseRevenue + growth) * 0.2),
      content: Math.round((baseRevenue + growth) * 0.1),
      subscribers: Math.round(20 + index * 2 + Math.random() * 10),
    };
  });
}

// Generate demo content type data
function generateContentTypeData(): ContentTypeRevenue[] {
  return [
    { type: 'Music Videos', revenue: 2450, count: 12 },
    { type: 'Audio Tracks', revenue: 1890, count: 28 },
    { type: 'Photos', revenue: 1240, count: 45 },
    { type: 'Live Streams', revenue: 980, count: 8 },
    { type: 'Exclusive Content', revenue: 1650, count: 15 },
  ];
}

// Generate subscription tier data
function generateSubscriptionTierData(): SubscriptionTierData[] {
  return [
    { tier: 'Basic', subscribers: 245, revenue: 1225, avgRevenue: 5 },
    { tier: 'Premium', subscribers: 156, revenue: 2340, avgRevenue: 15 },
    { tier: 'VIP', subscribers: 78, revenue: 2340, avgRevenue: 30 },
    { tier: 'Exclusive', subscribers: 34, revenue: 1700, avgRevenue: 50 },
  ];
}

interface RevenueAnalyticsProps {
  className?: string;
}

export function RevenueAnalytics({ className }: RevenueAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30d');
  const [selectedView, setSelectedView] = useState<'revenue' | 'breakdown' | 'trends'>('revenue');

  // Generate data based on selected period
  const revenueData = useMemo(() => generateRevenueData(selectedPeriod), [selectedPeriod]);
  const contentTypeData = useMemo(() => generateContentTypeData(), []);
  const subscriptionTierData = useMemo(() => generateSubscriptionTierData(), []);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
    const avgDailyRevenue = totalRevenue / revenueData.length;
    const previousPeriodRevenue = totalRevenue * 0.85; // Simulated comparison
    const growth = ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;
    
    return {
      totalRevenue,
      avgDailyRevenue,
      growth,
      totalSubscribers: revenueData[revenueData.length - 1]?.subscribers || 0,
    };
  }, [revenueData]);

  const periodOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
  ];

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;
  const formatDate = (value: string) => value;

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Revenue Analytics</h1>
          <p className="text-gray-600 mt-1">Track your earnings and revenue trends</p>
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
          
          {/* Export Button */}
          <EnhancedButton
            variant="secondary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export
          </EnhancedButton>
        </div>
      </div>

      {/* Summary Stats */}
      <StatsGrid columns={4}>
        <StatsWidget
          title="Total Revenue"
          value={formatCurrency(summaryStats.totalRevenue)}
          icon={<DollarSign className="w-5 h-5" />}
          trend={summaryStats.growth > 0 ? 'up' : 'down'}
          trendValue={`${summaryStats.growth > 0 ? '+' : ''}${summaryStats.growth.toFixed(1)}%`}
          description="This period"
          variant="success"
          showSparkline={true}
          sparklineData={revenueData.map(d => d.revenue)}
        />
        
        <StatsWidget
          title="Avg Daily Revenue"
          value={formatCurrency(summaryStats.avgDailyRevenue)}
          icon={<TrendingUp className="w-5 h-5" />}
          trend="up"
          trendValue="+12%"
          description="Daily average"
          variant="info"
        />
        
        <StatsWidget
          title="Active Subscribers"
          value={summaryStats.totalSubscribers}
          icon={<Target className="w-5 h-5" />}
          trend="up"
          trendValue="+8%"
          description="Paying subscribers"
          variant="warning"
        />
        
        <StatsWidget
          title="Revenue per Subscriber"
          value={formatCurrency(summaryStats.totalRevenue / summaryStats.totalSubscribers)}
          icon={<CreditCard className="w-5 h-5" />}
          trend="up"
          trendValue="+3%"
          description="Average LTV"
          variant="default"
        />
      </StatsGrid>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2">
          <ModernAreaChart
            title="Revenue Trend"
            description="Total revenue over time with breakdown by source"
            data={revenueData}
            height={400}
            variant="elevated"
            xAxisKey="date"
            areas={[
              { dataKey: 'revenue', name: 'Total Revenue', gradient: true },
              { dataKey: 'subscriptions', name: 'Subscriptions', color: '#10b981' },
              { dataKey: 'tips', name: 'Tips & Donations', color: '#f59e0b' },
              { dataKey: 'content', name: 'Content Sales', color: '#8b5cf6' },
            ]}
            formatXAxis={formatDate}
            formatTooltip={formatCurrency}
            stacked={false}
            actions={
              <div className="flex gap-2">
                <EnhancedButton
                  variant={selectedView === 'revenue' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedView('revenue')}
                >
                  Revenue
                </EnhancedButton>
                <EnhancedButton
                  variant={selectedView === 'breakdown' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedView('breakdown')}
                >
                  Breakdown
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

        {/* Revenue by Content Type */}
        <ModernPieChart
          title="Revenue by Content Type"
          description="Distribution of earnings across different content categories"
          data={contentTypeData.map(item => ({
            name: item.type,
            value: item.revenue,
          }))}
          height={350}
          variant="elevated"
          formatTooltip={formatCurrency}
          innerRadius={60}
          showLabels={false}
        />

        {/* Subscription Tiers Performance */}
        <ModernBarChart
          title="Subscription Tiers"
          description="Revenue and subscriber count by tier"
          data={subscriptionTierData}
          height={350}
          variant="elevated"
          xAxisKey="tier"
          bars={[
            { dataKey: 'revenue', name: 'Revenue', color: '#6366f1' },
            { dataKey: 'subscribers', name: 'Subscribers', color: '#10b981' },
          ]}
          formatTooltip={(value, name) => 
            name === 'Revenue' ? formatCurrency(value) : `${value} subscribers`
          }
        />
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Performing Content */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Top Performing Content</EnhancedCardTitle>
            <EnhancedCardDescription>Highest earning content this period</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-4">
              {contentTypeData.map((item, index) => (
                <div key={item.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.type}</p>
                      <p className="text-sm text-gray-500">{item.count} items</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(item.revenue)}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(Math.round(item.revenue / item.count))}/item
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </EnhancedCardContent>
        </EnhancedCard>

        {/* Revenue Goals */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Revenue Goals</EnhancedCardTitle>
            <EnhancedCardDescription>Progress towards monthly targets</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Monthly Goal</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(summaryStats.totalRevenue)} / $10,000
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((summaryStats.totalRevenue / 10000) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((summaryStats.totalRevenue / 10000) * 100).toFixed(1)}% complete
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Subscriber Goal</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {summaryStats.totalSubscribers} / 1,000
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((summaryStats.totalSubscribers / 1000) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((summaryStats.totalSubscribers / 1000) * 100).toFixed(1)}% complete
                </p>
              </div>
            </div>
          </EnhancedCardContent>
        </EnhancedCard>

        {/* Recent Transactions */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle>Recent Transactions</EnhancedCardTitle>
            <EnhancedCardDescription>Latest revenue transactions</EnhancedCardDescription>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => {
                const amount = Math.round(5 + Math.random() * 45);
                const types = ['Subscription', 'Tip', 'Content Purchase', 'Live Stream'];
                const type = types[index % types.length];
                
                return (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-3 h-3 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{type}</p>
                        <p className="text-xs text-gray-500">
                          {Math.floor(Math.random() * 60)} minutes ago
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-green-600">
                      +{formatCurrency(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </EnhancedCardContent>
        </EnhancedCard>
      </div>
    </div>
  );
}