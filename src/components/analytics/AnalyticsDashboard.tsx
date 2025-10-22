'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon as TrendingUp,
  ArrowTrendingDownIcon,
  EyeIcon,
  HeartIcon,
  BanknotesIcon,
  UserGroupIcon,
  CalendarIcon,
  TrendingUpIcon as TrendingUp,
  DocumentTextIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface AnalyticsData {
  revenue: {
    current: number;
    previous: number;
    change: number;
    currency: string;
  };
  subscribers: {
    current: number;
    previous: number;
    change: number;
    growth: number;
  };
  content: {
    totalViews: number;
    totalLikes: number;
    totalContent: number;
    avgEngagement: number;
  };
  demographics: {
    locations: Array<{ country: string; percentage: number; count: number }>;
    devices: Array<{ type: string; percentage: number; count: number }>;
    ageGroups: Array<{ range: string; percentage: number; count: number }>;
  };
  timeSeriesData: Array<{
    date: string;
    revenue: number;
    subscribers: number;
    views: number;
    engagement: number;
  }>;
  topContent: Array<{
    id: string;
    title: string;
    type: string;
    views: number;
    likes: number;
    revenue: number;
  }>;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ComponentType<any>;
  color: string;
  subtitle?: string;
}

function MetricCard({ title, value, change, icon: Icon, color, subtitle }: MetricCardProps) {
  const isPositive = change >= 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className='bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow'
    >
      <div className='flex items-center justify-between mb-4'>
        <div
          className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}
        >
          <Icon className='w-6 h-6 text-white' />
        </div>
        <div
          className={`flex items-center space-x-1 text-sm font-medium ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? (
            <ArrowTrendingUpIcon as TrendingUp className='w-4 h-4' />
          ) : (
            <ArrowTrendingDownIcon className='w-4 h-4' />
          )}
          <span>{Math.abs(change)}%</span>
        </div>
      </div>

      <div>
        <h3 className='text-2xl font-bold text-gray-900 mb-1'>{value}</h3>
        <p className='text-gray-600 text-sm'>{title}</p>
        {subtitle && <p className='text-gray-500 text-xs mt-1'>{subtitle}</p>}
      </div>
    </motion.div>
  );
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

function ChartCard({ title, children, className }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className='text-lg font-semibold text-gray-900 mb-4'>{title}</h3>
      {children}
    </div>
  );
}

interface AnalyticsDashboardProps {
  userRole: 'ARTIST' | 'ADMIN';
  userId?: string;
  timeRange?: '7d' | '30d' | '90d' | '1y';
  className?: string;
}

export default function AnalyticsDashboard({
  userRole,
  userId,
  timeRange = '30d',
  className,
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

  // Mock data - in real app, this would come from API
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockData: AnalyticsData = {
        revenue: {
          current: 2847.5,
          previous: 2156.3,
          change: 32.1,
          currency: 'USD',
        },
        subscribers: {
          current: 1243,
          previous: 987,
          change: 25.9,
          growth: 256,
        },
        content: {
          totalViews: 45620,
          totalLikes: 3420,
          totalContent: 78,
          avgEngagement: 7.5,
        },
        demographics: {
          locations: [
            { country: 'United States', percentage: 35.2, count: 437 },
            { country: 'United Kingdom', percentage: 18.7, count: 232 },
            { country: 'Canada', percentage: 12.4, count: 154 },
            { country: 'Australia', percentage: 9.8, count: 122 },
            { country: 'Germany', percentage: 8.3, count: 103 },
            { country: 'Others', percentage: 15.6, count: 195 },
          ],
          devices: [
            { type: 'Mobile', percentage: 68.4, count: 850 },
            { type: 'Desktop', percentage: 24.7, count: 307 },
            { type: 'Tablet', percentage: 6.9, count: 86 },
          ],
          ageGroups: [
            { range: '18-24', percentage: 28.5, count: 354 },
            { range: '25-34', percentage: 42.1, count: 523 },
            { range: '35-44', percentage: 19.8, count: 246 },
            { range: '45-54', percentage: 7.2, count: 89 },
            { range: '55+', percentage: 2.4, count: 31 },
          ],
        },
        timeSeriesData: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          revenue: Math.floor(Math.random() * 200) + 50,
          subscribers: Math.floor(Math.random() * 50) + 1200,
          views: Math.floor(Math.random() * 2000) + 1000,
          engagement: Math.floor(Math.random() * 10) + 5,
        })),
        topContent: [
          {
            id: '1',
            title: 'Midnight Melodies Vol. 1',
            type: 'AUDIO',
            views: 12450,
            likes: 892,
            revenue: 485.2,
          },
          {
            id: '2',
            title: 'Behind the Scenes: Studio Session',
            type: 'VIDEO',
            views: 8930,
            likes: 654,
            revenue: 342.15,
          },
          {
            id: '3',
            title: 'Exclusive Interview',
            type: 'VIDEO',
            views: 7650,
            likes: 521,
            revenue: 298.75,
          },
          {
            id: '4',
            title: 'Acoustic Sessions',
            type: 'AUDIO',
            views: 6890,
            likes: 445,
            revenue: 267.8,
          },
          {
            id: '5',
            title: 'Fan Q&A Session',
            type: 'VIDEO',
            views: 5430,
            likes: 387,
            revenue: 201.45,
          },
        ],
      };

      setData(mockData);
      setLoading(false);
    };

    fetchAnalytics();
  }, [selectedTimeRange, userId]);

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className='bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse'
            >
              <div className='h-12 w-12 bg-gray-200 rounded-lg mb-4'></div>
              <div className='h-8 bg-gray-200 rounded mb-2'></div>
              <div className='h-4 bg-gray-200 rounded w-1/2'></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.revenue.currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Time Range Selector */}
      <div className='flex justify-between items-center'>
        <h2 className='text-2xl font-bold text-gray-900'>
          {userRole === 'ARTIST' ? 'Creator Analytics' : 'Platform Analytics'}
        </h2>
        <div className='flex bg-gray-100 rounded-lg p-1'>
          {[
            { value: '7d', label: '7 Days' },
            { value: '30d', label: '30 Days' },
            { value: '90d', label: '90 Days' },
            { value: '1y', label: '1 Year' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setSelectedTimeRange(option.value as any)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedTimeRange === option.value
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <MetricCard
          title='Total Revenue'
          value={formatCurrency(data.revenue.current)}
          change={data.revenue.change}
          icon={BanknotesIcon}
          color='from-green-500 to-emerald-600'
          subtitle={`+${formatCurrency(data.revenue.current - data.revenue.previous)} from last period`}
        />

        <MetricCard
          title='Subscribers'
          value={formatNumber(data.subscribers.current)}
          change={data.subscribers.change}
          icon={UserGroupIcon}
          color='from-blue-500 to-indigo-600'
          subtitle={`+${data.subscribers.growth} new this period`}
        />

        <MetricCard
          title='Total Views'
          value={formatNumber(data.content.totalViews)}
          change={15.3}
          icon={EyeIcon}
          color='from-purple-500 to-pink-600'
          subtitle={`${data.content.totalContent} pieces of content`}
        />

        <MetricCard
          title='Engagement Rate'
          value={`${data.content.avgEngagement}%`}
          change={8.7}
          icon={HeartIcon}
          color='from-pink-500 to-rose-600'
          subtitle={`${formatNumber(data.content.totalLikes)} total likes`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Revenue Over Time */}
        <ChartCard title='Revenue Trend'>
          <ResponsiveContainer width='100%' height={300}>
            <AreaChart data={data.timeSeriesData}>
              <defs>
                <linearGradient id='revenue' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#10b981' stopOpacity={0.8} />
                  <stop offset='95%' stopColor='#10b981' stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey='date'
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={value => new Date(value).getDate().toString()}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={value => `$${value}`}
              />
              <CartesianGrid strokeDasharray='3 3' stroke='#f3f4f6' />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelFormatter={value => new Date(value).toLocaleDateString()}
                formatter={value => [`$${value}`, 'Revenue']}
              />
              <Area
                type='monotone'
                dataKey='revenue'
                stroke='#10b981'
                strokeWidth={2}
                fill='url(#revenue)'
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Subscriber Growth */}
        <ChartCard title='Subscriber Growth'>
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={data.timeSeriesData}>
              <XAxis
                dataKey='date'
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={value => new Date(value).getDate().toString()}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <CartesianGrid strokeDasharray='3 3' stroke='#f3f4f6' />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelFormatter={value => new Date(value).toLocaleDateString()}
                formatter={value => [value, 'Subscribers']}
              />
              <Line
                type='monotone'
                dataKey='subscribers'
                stroke='#6366f1'
                strokeWidth={3}
                dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Device Breakdown */}
        <ChartCard title='Device Usage'>
          <ResponsiveContainer width='100%' height={250}>
            <PieChart>
              <Pie
                data={data.demographics.devices}
                cx='50%'
                cy='50%'
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey='percentage'
              >
                {data.demographics.devices.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={value => [`${value}%`, 'Usage']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Age Demographics */}
        <ChartCard title='Age Demographics'>
          <ResponsiveContainer width='100%' height={250}>
            <BarChart data={data.demographics.ageGroups}>
              <XAxis
                dataKey='range'
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={value => `${value}%`}
              />
              <CartesianGrid strokeDasharray='3 3' stroke='#f3f4f6' />
              <Tooltip formatter={value => [`${value}%`, 'Percentage']} />
              <Bar dataKey='percentage' fill='#8b5cf6' radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Locations */}
        <ChartCard title='Top Locations' className='lg:row-span-1'>
          <div className='space-y-4'>
            {data.demographics.locations.slice(0, 5).map((location, index) => (
              <div key={location.country} className='flex items-center justify-between'>
                <div className='flex items-center space-x-3'>
                  <div className='flex-shrink-0'>
                    <GlobeAltIcon className='w-5 h-5 text-gray-400' />
                  </div>
                  <div>
                    <p className='text-sm font-medium text-gray-900'>{location.country}</p>
                    <p className='text-xs text-gray-500'>{location.count} subscribers</p>
                  </div>
                </div>
                <div className='text-right'>
                  <p className='text-sm font-semibold text-gray-900'>{location.percentage}%</p>
                  <div className='w-20 h-2 bg-gray-200 rounded-full mt-1'>
                    <div
                      className='h-2 bg-indigo-600 rounded-full'
                      style={{ width: `${location.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Top Performing Content */}
      <ChartCard title='Top Performing Content'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-gray-200'>
                <th className='text-left py-3 px-4 font-medium text-gray-700'>Content</th>
                <th className='text-left py-3 px-4 font-medium text-gray-700'>Type</th>
                <th className='text-left py-3 px-4 font-medium text-gray-700'>Views</th>
                <th className='text-left py-3 px-4 font-medium text-gray-700'>Likes</th>
                <th className='text-left py-3 px-4 font-medium text-gray-700'>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topContent.map((content, index) => (
                <tr key={content.id} className='border-b border-gray-100 hover:bg-gray-50'>
                  <td className='py-4 px-4'>
                    <div className='flex items-center space-x-3'>
                      <div className='flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center'>
                        <span className='text-indigo-600 font-semibold text-sm'>{index + 1}</span>
                      </div>
                      <div>
                        <p className='text-sm font-medium text-gray-900'>{content.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className='py-4 px-4'>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        content.type === 'AUDIO'
                          ? 'bg-purple-100 text-purple-800'
                          : content.type === 'VIDEO'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {content.type}
                    </span>
                  </td>
                  <td className='py-4 px-4 text-sm text-gray-900'>{formatNumber(content.views)}</td>
                  <td className='py-4 px-4 text-sm text-gray-900'>{formatNumber(content.likes)}</td>
                  <td className='py-4 px-4 text-sm font-semibold text-gray-900'>
                    {formatCurrency(content.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
