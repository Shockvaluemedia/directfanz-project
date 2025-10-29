'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/loading';
import { ClientOnly } from '@/components/ui/ClientOnly';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { 
  RevenueAnalytics, 
  SubscriberAnalytics, 
  ContentPerformanceAnalytics,
  AnalyticsFilters,
  useAnalyticsFilters
} from '@/components/analytics';
import { BarChart3, Users, Play, DollarSign, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type AnalyticsView = 'overview' | 'revenue' | 'subscribers' | 'content';

export default function ArtistAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeView, setActiveView] = useState<AnalyticsView>('overview');
  
  // Analytics filters state
  const { filters, updateFilters } = useAnalyticsFilters({
    dateRange: {
      preset: '30d',
    },
    contentType: 'all',
    subscriptionTier: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
    showZeroValues: false,
  });

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (session.user.role !== 'ARTIST') {
      router.push('/dashboard/fan');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center'>
          <LoadingSpinner size='lg' />
          <p className='mt-3 text-sm text-gray-600'>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ARTIST') {
    return null;
  }

  const handleExport = () => {
    // Export functionality would be implemented here
    console.log('Exporting analytics data with filters:', filters);
    // In a real implementation, this would generate and download a CSV/Excel file
  };

  const handleRefresh = () => {
    // Refresh functionality would be implemented here
    console.log('Refreshing analytics data');
    // In a real implementation, this would refetch the data from the API
  };

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3, description: 'All analytics at a glance' },
    { id: 'revenue', label: 'Revenue', icon: DollarSign, description: 'Financial performance' },
    { id: 'subscribers', label: 'Subscribers', icon: Users, description: 'Audience growth' },
    { id: 'content', label: 'Content', icon: Play, description: 'Content performance' },
  ] as const;

  return (
    <ClientOnly
      fallback={
        <div className='min-h-screen flex items-center justify-center'>
          <div className='flex flex-col items-center'>
            <LoadingSpinner size='lg' />
            <p className='mt-3 text-sm text-gray-600'>Loading analytics...</p>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/artist">
                <EnhancedButton
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back to Dashboard
                </EnhancedButton>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
                <p className="text-gray-600 mt-1">Comprehensive insights into your performance</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <EnhancedButton
                  key={item.id}
                  variant={activeView === item.id ? 'primary' : 'secondary'}
                  onClick={() => setActiveView(item.id as AnalyticsView)}
                  className="h-auto p-4 flex flex-col items-center gap-2"
                >
                  <Icon className="w-6 h-6" />
                  <div className="text-center">
                    <div className="font-semibold">{item.label}</div>
                    <div className="text-xs opacity-75">{item.description}</div>
                  </div>
                </EnhancedButton>
              );
            })}
          </div>

          {/* Filters (shown for individual views, not overview) */}
          {activeView !== 'overview' && (
            <AnalyticsFilters
              filters={filters}
              onFiltersChange={updateFilters}
              showContentTypeFilter={activeView === 'content'}
              showSubscriptionFilter={activeView === 'subscribers' || activeView === 'revenue'}
              showSortOptions={activeView === 'content'}
              onExport={handleExport}
              onRefresh={handleRefresh}
            />
          )}

          {/* Content */}
          <div className="min-h-96">
            {activeView === 'overview' && (
              <div className="space-y-8">
                <EnhancedCard variant="elevated">
                  <EnhancedCardHeader>
                    <EnhancedCardTitle>Analytics Overview</EnhancedCardTitle>
                  </EnhancedCardHeader>
                  <EnhancedCardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-indigo-900">Revenue Analytics</h3>
                          <DollarSign className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="text-sm text-indigo-700 mb-4">
                          Track earnings, subscription tiers, and revenue trends with detailed financial insights.
                        </p>
                        <EnhancedButton
                          variant="primary"
                          size="sm"
                          onClick={() => setActiveView('revenue')}
                          className="w-full"
                        >
                          View Revenue Analytics
                        </EnhancedButton>
                      </div>

                      <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-green-900">Subscriber Analytics</h3>
                          <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <p className="text-sm text-green-700 mb-4">
                          Monitor subscriber growth, churn rates, and engagement patterns across all tiers.
                        </p>
                        <EnhancedButton
                          variant="primary"
                          size="sm"
                          onClick={() => setActiveView('subscribers')}
                          className="w-full"
                        >
                          View Subscriber Analytics
                        </EnhancedButton>
                      </div>

                      <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-purple-900">Content Performance</h3>
                          <Play className="w-5 h-5 text-purple-600" />
                        </div>
                        <p className="text-sm text-purple-700 mb-4">
                          Analyze content engagement, views, and performance metrics across all content types.
                        </p>
                        <EnhancedButton
                          variant="primary"
                          size="sm"
                          onClick={() => setActiveView('content')}
                          className="w-full"
                        >
                          View Content Analytics
                        </EnhancedButton>
                      </div>
                    </div>
                  </EnhancedCardContent>
                </EnhancedCard>

                {/* Quick Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Performance Highlights</h3>
                    <div className="space-y-3">
                      <div className="p-4 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Total Revenue (30d)</span>
                          <span className="font-semibold text-green-600">$4,280</span>
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">New Subscribers (30d)</span>
                          <span className="font-semibold text-blue-600">+127</span>
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Content Views (30d)</span>
                          <span className="font-semibold text-purple-600">12,456</span>
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Engagement Rate</span>
                          <span className="font-semibold text-orange-600">13.4%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Analytics Features</h3>
                    <div className="space-y-3">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 text-sm">Advanced Filtering</h4>
                        <p className="text-xs text-blue-700 mt-1">
                          Filter by date ranges, content types, and subscription tiers
                        </p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-900 text-sm">Interactive Charts</h4>
                        <p className="text-xs text-green-700 mt-1">
                          Visual analytics with hover details and trend indicators
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h4 className="font-semibold text-purple-900 text-sm">Data Export</h4>
                        <p className="text-xs text-purple-700 mt-1">
                          Export your analytics data for external analysis
                        </p>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h4 className="font-semibold text-orange-900 text-sm">Real-time Updates</h4>
                        <p className="text-xs text-orange-700 mt-1">
                          Refresh data to see the latest performance metrics
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'revenue' && (
              <RevenueAnalytics />
            )}

            {activeView === 'subscribers' && (
              <SubscriberAnalytics />
            )}

            {activeView === 'content' && (
              <ContentPerformanceAnalytics />
            )}
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}