'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
  Heart,
  DollarSign,
  Play,
  Calendar,
  Target,
  Zap,
  Award,
  Clock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  overview: {
    totalViews: number;
    uniqueViewers: number;
    totalRevenue: number;
    engagementRate: number;
    growthRate: number;
    activeSubscribers: number;
  };
  timeSeriesData: {
    date: string;
    views: number;
    uniqueViews: number;
    revenue: number;
    subscribers: number;
    engagement: number;
  }[];
  contentPerformance: {
    id: string;
    title: string;
    type: string;
    views: number;
    engagement: number;
    revenue: number;
    conversionRate: number;
  }[];
  audienceInsights: {
    demographics: {
      ageGroups: { range: string; percentage: number }[];
      locations: { country: string; percentage: number }[];
    };
    behavior: {
      avgSessionDuration: number;
      bounceRate: number;
      returnVisitorRate: number;
      peakHours: { hour: number; activity: number }[];
    };
  };
  revenueBreakdown: {
    subscriptions: number;
    tips: number;
    merchandise: number;
    other: number;
  };
}

interface AdvancedAnalyticsDashboardProps {
  className?: string;
}

export function AdvancedAnalyticsDashboard({ className }: AdvancedAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('views');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/advanced?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const mockAnalytics: AnalyticsData = {
    overview: {
      totalViews: 125432,
      uniqueViewers: 18764,
      totalRevenue: 12843.5,
      engagementRate: 8.4,
      growthRate: 23.8,
      activeSubscribers: 1247,
    },
    timeSeriesData: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      views:
        Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * 5000) +
        2000,
      uniqueViews:
        Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * 2000) + 800,
      revenue:
        Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * 500) + 200,
      subscribers:
        Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * 50) + 20,
      engagement:
        Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * 20) + 5,
    })),
    contentPerformance: [
      {
        id: '1',
        title: 'Latest Music Video',
        type: 'video',
        views: 25432,
        engagement: 12.3,
        revenue: 2843,
        conversionRate: 8.2,
      },
      {
        id: '2',
        title: 'Behind the Scenes',
        type: 'video',
        views: 18765,
        engagement: 9.8,
        revenue: 1432,
        conversionRate: 6.1,
      },
      {
        id: '3',
        title: 'Exclusive Photo Set',
        type: 'image',
        views: 15432,
        engagement: 15.2,
        revenue: 987,
        conversionRate: 4.3,
      },
      {
        id: '4',
        title: 'New Single Preview',
        type: 'audio',
        views: 12876,
        engagement: 18.7,
        revenue: 1654,
        conversionRate: 9.8,
      },
      {
        id: '5',
        title: 'Live Stream Recording',
        type: 'video',
        views: 9876,
        engagement: 11.4,
        revenue: 765,
        conversionRate: 3.2,
      },
    ],
    audienceInsights: {
      demographics: {
        ageGroups: [
          { range: '18-24', percentage: 32 },
          { range: '25-34', percentage: 28 },
          { range: '35-44', percentage: 22 },
          { range: '45-54', percentage: 12 },
          { range: '55+', percentage: 6 },
        ],
        locations: [
          { country: 'United States', percentage: 45 },
          { country: 'Canada', percentage: 18 },
          { country: 'United Kingdom', percentage: 12 },
          { country: 'Germany', percentage: 8 },
          { country: 'Other', percentage: 17 },
        ],
      },
      behavior: {
        avgSessionDuration: 8.5,
        bounceRate: 24.3,
        returnVisitorRate: 67.8,
        peakHours: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          activity:
            Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * 100) +
            20,
        })),
      },
    },
    revenueBreakdown: {
      subscriptions: 8943.5,
      tips: 2432.0,
      merchandise: 1236.0,
      other: 232.0,
    },
  };

  const displayData = analytics || mockAnalytics;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getGrowthIcon = (rate: number) => {
    return rate >= 0 ? (
      <TrendingUp className='h-4 w-4 text-green-500' />
    ) : (
      <TrendingDown className='h-4 w-4 text-red-500' />
    );
  };

  const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading && !displayData) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Analytics Dashboard</h1>
          <p className='text-muted-foreground'>
            Comprehensive insights into your content performance
          </p>
        </div>

        <div className='flex items-center space-x-3'>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='7d'>Last 7 days</SelectItem>
              <SelectItem value='30d'>Last 30 days</SelectItem>
              <SelectItem value='90d'>Last 3 months</SelectItem>
              <SelectItem value='365d'>Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Total Views</p>
                <p className='text-2xl font-bold'>
                  {formatNumber(displayData.overview.totalViews)}
                </p>
              </div>
              <div className='h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center'>
                <Eye className='h-4 w-4 text-blue-600' />
              </div>
            </div>
            <div className='flex items-center mt-2'>
              {getGrowthIcon(displayData.overview.growthRate)}
              <span
                className={`text-sm ml-1 ${displayData.overview.growthRate >= 0 ? 'text-green-500' : 'text-red-500'}`}
              >
                {displayData.overview.growthRate}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Unique Viewers</p>
                <p className='text-2xl font-bold'>
                  {formatNumber(displayData.overview.uniqueViewers)}
                </p>
              </div>
              <div className='h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center'>
                <Users className='h-4 w-4 text-purple-600' />
              </div>
            </div>
            <div className='flex items-center mt-2'>
              {getGrowthIcon(15.2)}
              <span className='text-sm ml-1 text-green-500'>+15.2% vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Revenue</p>
                <p className='text-2xl font-bold'>
                  {formatCurrency(displayData.overview.totalRevenue)}
                </p>
              </div>
              <div className='h-8 w-8 rounded-full bg-green-100 flex items-center justify-center'>
                <DollarSign className='h-4 w-4 text-green-600' />
              </div>
            </div>
            <div className='flex items-center mt-2'>
              {getGrowthIcon(28.4)}
              <span className='text-sm ml-1 text-green-500'>+28.4% vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Engagement</p>
                <p className='text-2xl font-bold'>{displayData.overview.engagementRate}%</p>
              </div>
              <div className='h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center'>
                <Heart className='h-4 w-4 text-orange-600' />
              </div>
            </div>
            <div className='flex items-center mt-2'>
              {getGrowthIcon(5.7)}
              <span className='text-sm ml-1 text-green-500'>+5.7% vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Subscribers</p>
                <p className='text-2xl font-bold'>
                  {formatNumber(displayData.overview.activeSubscribers)}
                </p>
              </div>
              <div className='h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center'>
                <Target className='h-4 w-4 text-pink-600' />
              </div>
            </div>
            <div className='flex items-center mt-2'>
              {getGrowthIcon(12.3)}
              <span className='text-sm ml-1 text-green-500'>+12.3% vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Avg Session</p>
                <p className='text-2xl font-bold'>
                  {displayData.audienceInsights.behavior.avgSessionDuration}m
                </p>
              </div>
              <div className='h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center'>
                <Clock className='h-4 w-4 text-indigo-600' />
              </div>
            </div>
            <div className='flex items-center mt-2'>
              {getGrowthIcon(8.9)}
              <span className='text-sm ml-1 text-green-500'>+8.9% vs last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue='performance' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='performance'>Performance</TabsTrigger>
          <TabsTrigger value='audience'>Audience</TabsTrigger>
          <TabsTrigger value='content'>Content</TabsTrigger>
          <TabsTrigger value='revenue'>Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value='performance' className='space-y-6'>
          {/* Time Series Chart */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <span>Performance Over Time</span>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger className='w-32'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='views'>Views</SelectItem>
                    <SelectItem value='uniqueViews'>Unique Views</SelectItem>
                    <SelectItem value='revenue'>Revenue</SelectItem>
                    <SelectItem value='subscribers'>Subscribers</SelectItem>
                    <SelectItem value='engagement'>Engagement</SelectItem>
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={400}>
                <AreaChart data={displayData.timeSeriesData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='date' />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type='monotone'
                    dataKey={selectedMetric}
                    stroke='#8b5cf6'
                    fill='#8b5cf6'
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Peak Activity Hours */}
          <Card>
            <CardHeader>
              <CardTitle>Peak Activity Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={300}>
                <BarChart data={displayData.audienceInsights.behavior.peakHours}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='hour' tickFormatter={hour => `${hour}:00`} />
                  <YAxis />
                  <Tooltip
                    labelFormatter={hour => `${hour}:00`}
                    formatter={value => [value, 'Activity']}
                  />
                  <Bar dataKey='activity' fill='#8b5cf6' />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='audience' className='space-y-6'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Age Demographics */}
            <Card>
              <CardHeader>
                <CardTitle>Age Demographics</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width='100%' height={300}>
                  <PieChart>
                    <Pie
                      data={displayData.audienceInsights.demographics.ageGroups}
                      cx='50%'
                      cy='50%'
                      labelLine={false}
                      label={({ range, percentage }) => `${range} (${percentage}%)`}
                      outerRadius={80}
                      fill='#8884d8'
                      dataKey='percentage'
                    >
                      {displayData.audienceInsights.demographics.ageGroups.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Geographic Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {displayData.audienceInsights.demographics.locations.map((location, index) => (
                    <div key={location.country} className='flex items-center justify-between'>
                      <span className='font-medium'>{location.country}</span>
                      <div className='flex items-center space-x-3'>
                        <div className='w-24 bg-muted rounded-full h-2'>
                          <div
                            className='bg-primary h-2 rounded-full'
                            style={{ width: `${location.percentage}%` }}
                          />
                        </div>
                        <span className='text-sm text-muted-foreground w-12 text-right'>
                          {location.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Audience Behavior Metrics */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <Card>
              <CardContent className='p-6'>
                <div className='text-center'>
                  <div className='text-3xl font-bold text-green-600'>
                    {displayData.audienceInsights.behavior.returnVisitorRate}%
                  </div>
                  <p className='text-sm text-muted-foreground mt-1'>Return Visitor Rate</p>
                  <Badge variant='secondary' className='mt-2'>
                    <TrendingUp className='h-3 w-3 mr-1' />
                    +5.2%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-6'>
                <div className='text-center'>
                  <div className='text-3xl font-bold text-blue-600'>
                    {displayData.audienceInsights.behavior.avgSessionDuration}m
                  </div>
                  <p className='text-sm text-muted-foreground mt-1'>Avg Session Duration</p>
                  <Badge variant='secondary' className='mt-2'>
                    <TrendingUp className='h-3 w-3 mr-1' />
                    +1.3m
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-6'>
                <div className='text-center'>
                  <div className='text-3xl font-bold text-orange-600'>
                    {displayData.audienceInsights.behavior.bounceRate}%
                  </div>
                  <p className='text-sm text-muted-foreground mt-1'>Bounce Rate</p>
                  <Badge variant='secondary' className='mt-2'>
                    <TrendingDown className='h-3 w-3 mr-1' />
                    -2.1%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='content' className='space-y-6'>
          {/* Top Performing Content */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {displayData.contentPerformance.map((content, index) => (
                  <div
                    key={content.id}
                    className='flex items-center justify-between p-4 border rounded-lg'
                  >
                    <div className='flex items-center space-x-4'>
                      <div className='w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold'>
                        {index + 1}
                      </div>
                      <div>
                        <h4 className='font-semibold'>{content.title}</h4>
                        <div className='flex items-center space-x-4 text-sm text-muted-foreground'>
                          <Badge variant='outline' className='capitalize'>
                            {content.type}
                          </Badge>
                          <span>{formatNumber(content.views)} views</span>
                          <span>{content.engagement}% engagement</span>
                        </div>
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='font-semibold'>{formatCurrency(content.revenue)}</div>
                      <div className='text-sm text-muted-foreground'>
                        {content.conversionRate}% conversion
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Type Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Content Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={300}>
                <BarChart
                  data={[
                    { type: 'Video', views: 85432, engagement: 12.3, revenue: 5432 },
                    { type: 'Audio', views: 42354, engagement: 15.7, revenue: 3254 },
                    { type: 'Image', views: 32165, engagement: 9.8, revenue: 1876 },
                  ]}
                >
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='type' />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey='views' fill='#8b5cf6' name='Views' />
                  <Bar dataKey='revenue' fill='#06b6d4' name='Revenue ($)' />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='revenue' className='space-y-6'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width='100%' height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: 'Subscriptions',
                          value: displayData.revenueBreakdown.subscriptions,
                        },
                        { name: 'Tips', value: displayData.revenueBreakdown.tips },
                        { name: 'Merchandise', value: displayData.revenueBreakdown.merchandise },
                        { name: 'Other', value: displayData.revenueBreakdown.other },
                      ]}
                      cx='50%'
                      cy='50%'
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill='#8884d8'
                      dataKey='value'
                    >
                      {Object.entries(displayData.revenueBreakdown).map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={value => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width='100%' height={300}>
                  <LineChart data={displayData.timeSeriesData}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis dataKey='date' />
                    <YAxis />
                    <Tooltip formatter={value => [`$${value}`, 'Revenue']} />
                    <Line
                      type='monotone'
                      dataKey='revenue'
                      stroke='#10b981'
                      strokeWidth={3}
                      dot={{ fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Summary */}
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            {Object.entries(displayData.revenueBreakdown).map(([key, value]) => (
              <Card key={key}>
                <CardContent className='p-6 text-center'>
                  <div className='text-2xl font-bold text-green-600'>{formatCurrency(value)}</div>
                  <p className='text-sm text-muted-foreground mt-1 capitalize'>{key}</p>
                  <div className='text-xs text-muted-foreground mt-1'>
                    {((value / displayData.overview.totalRevenue) * 100).toFixed(1)}% of total
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
