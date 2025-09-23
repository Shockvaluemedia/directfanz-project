'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import SearchAnalytics from '@/components/analytics/SearchAnalytics';
import { useAnalytics } from '@/hooks/useAnalytics';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const {
    data: analyticsData,
    loading,
    error,
    refetch,
  } = useAnalytics({
    timeRange: selectedTimeRange,
    enabled: !!session?.user,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto'></div>
          <p className='mt-4 text-gray-600'>Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  // Check if user has access to analytics
  const userRole = session?.user?.role;
  if (userRole !== 'ARTIST' && userRole !== 'ADMIN') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center max-w-md mx-auto p-6'>
          <ExclamationTriangleIcon className='h-16 w-16 text-yellow-500 mx-auto mb-4' />
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>Access Restricted</h1>
          <p className='text-gray-600 mb-6'>
            Analytics are only available to creators and administrators.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className='bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors'
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='bg-white shadow-sm border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between py-6'>
            <div className='flex items-center space-x-4'>
              <div className='w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center'>
                <ChartBarIcon className='w-6 h-6 text-indigo-600' />
              </div>
              <div>
                <h1 className='text-2xl font-bold text-gray-900'>
                  {userRole === 'ARTIST' ? 'Creator Analytics' : 'Platform Analytics'}
                </h1>
                <p className='text-gray-600'>Track your performance and grow your audience</p>
              </div>
            </div>

            <div className='flex items-center space-x-4'>
              {error && (
                <div className='flex items-center space-x-2 text-amber-600'>
                  <ExclamationTriangleIcon className='w-5 h-5' />
                  <span className='text-sm font-medium'>Data may be outdated</span>
                </div>
              )}

              <button
                onClick={refetch}
                disabled={loading}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  loading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              {userRole === 'ADMIN' && (
                <button
                  onClick={() => router.push('/admin/analytics')}
                  className='flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors'
                >
                  <CogIcon className='w-4 h-4' />
                  <span>Admin View</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {error && !analyticsData && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className='mb-6 bg-red-50 border border-red-200 rounded-lg p-4'
          >
            <div className='flex items-center'>
              <ExclamationTriangleIcon className='w-5 h-5 text-red-500 mr-3' />
              <div>
                <h3 className='text-sm font-medium text-red-800'>Error Loading Analytics</h3>
                <p className='text-sm text-red-700 mt-1'>{error}</p>
              </div>
              <button
                onClick={refetch}
                className='ml-auto px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors'
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}

        {loading && !analyticsData ? (
          <div className='space-y-6'>
            {/* Loading skeleton */}
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
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className='bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse'
                >
                  <div className='h-6 bg-gray-200 rounded mb-4 w-1/3'></div>
                  <div className='h-64 bg-gray-200 rounded'></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='space-y-8'>
            <AnalyticsDashboard
              userRole={userRole as 'ARTIST' | 'ADMIN'}
              userId={session?.user?.id}
              timeRange={selectedTimeRange}
            />
            
            <SearchAnalytics
              analyticsData={analyticsData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
