'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChartBarIcon,
  ChatBubbleLeftIcon,
  CogIcon,
  PlusIcon,
  EyeIcon,
  HeartIcon,
  CurrencyDollarIcon,
  UsersIcon,
  MusicalNoteIcon,
  DocumentDuplicateIcon,
  BellIcon,
  QuestionMarkCircleIcon,
  VideoCameraIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { useApi } from '@/hooks/use-api';
import { LoadingState, SkeletonCard } from '@/components/ui/loading';
import { StatsWidget, StatsGrid } from '@/components/ui/stats-widget';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton, FloatingActionButton } from '@/components/ui/enhanced-button';
import { Activity, Calendar, MessageSquare, Settings, Upload, Users, DollarSign, Music, Video, Trophy } from 'lucide-react';

interface DashboardStats {
  totalSubscribers: number;
  monthlyRevenue: number;
  totalContent: number;
  engagementRate: number;
  unreadMessages: number;
  pendingNotifications: number;
}

interface RecentActivity {
  id: string;
  type: 'subscription' | 'message' | 'content' | 'comment';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
}

export default function ArtistDashboard() {
  const { data: session } = useSession();

  // Fetch dashboard stats - temporarily disabled to avoid authentication errors
  // TODO: Enable when API endpoints are implemented
  const statsResponse = null;
  const loadingStats = false;
  const statsError = true; // Force fallback to demo data
  
  // Fetch recent activity - temporarily disabled to avoid authentication errors
  // TODO: Enable when API endpoints are implemented  
  const activityResponse = null;
  const loadingActivity = false;
  const activityError = true; // Force fallback to demo data
  
  // Uncomment below when API endpoints are ready:
  // const { data: statsResponse, loading: loadingStats, error: statsError } = useApi<{ stats: DashboardStats }>(
  //   '/api/artist/analytics?summary=true',
  //   {
  //     immediate: true,
  //     onError: (error) => {
  //       console.error('Artist analytics API error:', error);
  //       console.log('Using fallback demo data for artist stats');
  //     },
  //   }
  // );

  // const { data: activityResponse, loading: loadingActivity, error: activityError } = useApi<{
  //   activities: RecentActivity[];
  // }>('/api/artist/activity?limit=5', {
  //   immediate: true,
  //   onError: (error) => {
  //     console.error('Artist activity API error:', error);
  //     console.log('Using fallback demo data for artist activity');
  //   },
  // });

  // Demo fallback data for stats
  const demoStats: DashboardStats = {
    totalSubscribers: 1247,
    monthlyRevenue: 3892,
    totalContent: 64,
    engagementRate: 84,
    unreadMessages: 12,
    pendingNotifications: 3,
  };

  // Demo fallback data for activity
  const demoActivities: RecentActivity[] = [
    {
      id: 'demo-1',
      type: 'subscription',
      title: 'New Subscriber',
      description: 'Alex Johnson subscribed to Premium tier',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      user: {
        name: 'Alex Johnson',
        avatar: undefined,
      },
    },
    {
      id: 'demo-2',
      type: 'message',
      title: 'New Message',
      description: 'Sarah Chen: "Love your latest content! Keep it up 🔥"',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      user: {
        name: 'Sarah Chen',
        avatar: undefined,
      },
    },
    {
      id: 'demo-3',
      type: 'comment',
      title: 'New Comment',
      description: 'Mike Rodriguez commented on "Behind the Scenes": "Amazing work!"',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      user: {
        name: 'Mike Rodriguez',
        avatar: undefined,
      },
    },
    {
      id: 'demo-4',
      type: 'subscription',
      title: 'New Subscriber',
      description: 'Emma Wilson subscribed to Basic tier',
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      user: {
        name: 'Emma Wilson',
        avatar: undefined,
      },
    },
  ];

  const stats = useMemo(() => {
    if (statsError) {
      return demoStats;
    }
    return statsResponse?.stats || {
      totalSubscribers: 0,
      monthlyRevenue: 0,
      totalContent: 0,
      engagementRate: 0,
      unreadMessages: 0,
      pendingNotifications: 0,
    };
  }, [statsResponse?.stats, statsError]);

  const activities = useMemo(() => {
    if (activityError) {
      return demoActivities;
    }
    return activityResponse?.activities || [];
  }, [activityResponse?.activities, activityError]);

  const quickAccessCards = useMemo(
    () => [
      {
        title: 'Live Streaming',
        description: 'Schedule and manage live streams',
        href: '/dashboard/artist/livestreams',
        icon: VideoCameraIcon,
        color: 'bg-red-500',
        stats: 'Go live with fans',
      },
      {
        title: 'Campaigns & Challenges',
        description: 'Create engaging fan campaigns',
        href: '/dashboard/artist/campaigns',
        icon: TrophyIcon,
        color: 'bg-orange-500',
        stats: 'Drive fan engagement',
      },
      {
        title: 'Messages',
        description: 'Chat with your fans',
        href: '/messages',
        icon: ChatBubbleLeftIcon,
        color: 'bg-blue-500',
        badge: stats.unreadMessages,
        stats: `${stats.unreadMessages} unread`,
      },
      {
        title: 'Upload Content',
        description: 'Share new content with fans',
        href: '/dashboard/artist/upload',
        icon: PlusIcon,
        color: 'bg-green-500',
        stats: `${stats.totalContent} total items`,
      },
      {
        title: 'Analytics',
        description: 'Track your performance',
        href: '/dashboard/artist/analytics',
        icon: ChartBarIcon,
        color: 'bg-purple-500',
        stats: `${stats.engagementRate}% engagement`,
      },
      {
        title: 'Profile Settings',
        description: 'Update your profile',
        href: '/profile/settings',
        icon: CogIcon,
        color: 'bg-gray-500',
        stats: 'Manage account',
      },
      {
        title: 'Content Library',
        description: 'Manage your content',
        href: '/dashboard/artist/content',
        icon: MusicalNoteIcon,
        color: 'bg-indigo-500',
        stats: `${stats.totalContent} items`,
      },
      {
        title: 'Subscription Tiers',
        description: 'Manage your tiers',
        href: '/dashboard/artist/tiers',
        icon: DocumentDuplicateIcon,
        color: 'bg-yellow-500',
        stats: 'Configure pricing',
      },
    ],
    [stats]
  );

  const statCards = useMemo(
    () => [
      {
        title: 'Total Subscribers',
        value: stats.totalSubscribers.toLocaleString(),
        icon: UsersIcon,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
      },
      {
        title: 'Monthly Revenue',
        value: `$${stats.monthlyRevenue.toLocaleString()}`,
        icon: CurrencyDollarIcon,
        color: 'text-green-600',
        bg: 'bg-green-50',
      },
      {
        title: 'Content Items',
        value: stats.totalContent.toString(),
        icon: MusicalNoteIcon,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
      },
      {
        title: 'Engagement Rate',
        value: `${stats.engagementRate}%`,
        icon: HeartIcon,
        color: 'text-pink-600',
        bg: 'bg-pink-50',
      },
    ],
    [stats]
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'subscription':
        return UsersIcon;
      case 'message':
        return ChatBubbleLeftIcon;
      case 'content':
        return MusicalNoteIcon;
      case 'comment':
        return HeartIcon;
      default:
        return BellIcon;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'subscription':
        return 'bg-green-100 text-green-600';
      case 'message':
        return 'bg-blue-100 text-blue-600';
      case 'content':
        return 'bg-purple-100 text-purple-600';
      case 'comment':
        return 'bg-pink-100 text-pink-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className='space-y-8 relative'>
      {/* Modern Welcome Header */}
      <div className='bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-2xl p-8 text-white relative overflow-hidden'>
        {/* Background decoration */}
        <div className='absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32' />
        <div className='absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24' />
        
        <div className='relative z-10'>
          <h1 className='text-4xl font-bold mb-3'>Welcome back, {session?.user.name}! 👋</h1>
          <p className='text-indigo-100 text-lg opacity-90'>
            Here's what's happening with your content and community today.
          </p>
        </div>
      </div>

      {/* Enhanced Stats Overview */}
      <div>
        <div className='flex items-center justify-between mb-8'>
          <h2 className='text-2xl font-bold text-gray-900'>Dashboard Overview</h2>
          <EnhancedButton
            variant='ghost'
            size='sm'
            leftIcon={<Activity className='w-4 h-4' />}
          >
            View Analytics
          </EnhancedButton>
        </div>
        
        <LoadingState
          loading={loadingStats}
          fallback={
            <StatsGrid columns={4}>
              {Array.from({ length: 4 }).map((_, i) => (
                <StatsWidget
                  key={i}
                  title='Loading...'
                  value={0}
                  icon={<div className='w-5 h-5 bg-gray-300 rounded animate-pulse' />}
                  loading={true}
                />
              ))}
            </StatsGrid>
          }
        >
          <StatsGrid columns={4}>
            <StatsWidget
              title='Total Subscribers'
              value={stats.totalSubscribers}
              icon={<Users className='w-5 h-5' />}
              trend='up'
              trendValue='+12%'
              description='This month'
              variant='success'
              showSparkline={true}
              sparklineData={[120, 132, 145, 138, 155, 167, stats.totalSubscribers]}
            />
            <StatsWidget
              title='Monthly Revenue'
              value={`$${stats.monthlyRevenue.toLocaleString()}`}
              icon={<DollarSign className='w-5 h-5' />}
              trend='up'
              trendValue='+8%'
              description='This month'
              variant='info'
              showSparkline={true}
              sparklineData={[2800, 3200, 3100, 3500, 3800, 4200, stats.monthlyRevenue]}
            />
            <StatsWidget
              title='Total Content'
              value={stats.totalContent}
              icon={<Music className='w-5 h-5' />}
              trend='up'
              trendValue='+3'
              description='This week'
              variant='warning'
            />
            <StatsWidget
              title='Engagement Rate'
              value={`${stats.engagementRate}%`}
              icon={<Activity className='w-5 h-5' />}
              trend={stats.engagementRate > 75 ? 'up' : 'down'}
              trendValue='±2%'
              description='Avg. interaction'
              variant={stats.engagementRate > 75 ? 'success' : 'default'}
              showSparkline={true}
              sparklineData={[72, 78, 81, 77, 84, 88, stats.engagementRate]}
            />
          </StatsGrid>
        </LoadingState>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* Enhanced Quick Actions */}
        <div className='lg:col-span-2'>
          <div className='flex items-center justify-between mb-8'>
            <h2 className='text-2xl font-bold text-gray-900'>Quick Actions</h2>
            <EnhancedButton
              variant='ghost'
              size='sm'
              rightIcon={<Settings className='w-4 h-4' />}
            >
              Customize
            </EnhancedButton>
          </div>
          
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {quickAccessCards.slice(0, 6).map(card => {
              const Icon = card.icon;
              return (
                <Link key={card.title} href={card.href}>
                  <EnhancedCard
                    variant='elevated'
                    interactive
                    className='h-full group'
                  >
                    <div className='p-6'>
                      <div className='flex items-start justify-between mb-4'>
                        <div className={`p-3 rounded-xl ${card.color} text-white transition-transform group-hover:scale-110`}>
                          <Icon className='w-6 h-6' />
                        </div>
                        
                        {card.badge && card.badge > 0 && (
                          <div className='bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[24px] h-6 flex items-center justify-center font-medium shadow-lg'>
                            {card.badge}
                          </div>
                        )}
                      </div>
                      
                      <h3 className='text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2'>
                        {card.title}
                      </h3>
                      
                      <p className='text-sm text-gray-600 mb-3 line-clamp-2'>
                        {card.description}
                      </p>
                      
                      <div className='flex items-center justify-between'>
                        <span className='text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full'>
                          {card.stats}
                        </span>
                        
                        <div className='w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition-colors'>
                          <svg className='w-3 h-3 text-indigo-600 transition-transform group-hover:translate-x-0.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </EnhancedCard>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Enhanced Recent Activity */}
        <div>
          <EnhancedCard variant='elevated'>
            <EnhancedCardHeader
              actions={
                <EnhancedButton
                  variant='ghost'
                  size='sm'
                  rightIcon={<Activity className='w-4 h-4' />}
                >
                  View All
                </EnhancedButton>
              }
            >
              <EnhancedCardTitle>Recent Activity</EnhancedCardTitle>
            </EnhancedCardHeader>
            
            <EnhancedCardContent>
              <LoadingState
                loading={loadingActivity}
                fallback={
                  <div className='space-y-4'>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className='animate-pulse flex space-x-3'>
                        <div className='w-10 h-10 bg-gray-200 rounded-full'></div>
                        <div className='flex-1 space-y-2'>
                          <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                          <div className='h-3 bg-gray-200 rounded w-1/2'></div>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              >
                {activities.length > 0 ? (
                  <div className='space-y-6'>
                    {activities.map(activity => {
                      const Icon = getActivityIcon(activity.type);
                      const colorClass = getActivityColor(activity.type);

                      return (
                        <div key={activity.id} className='flex items-start space-x-4 group hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors'>
                          <div className={`p-2.5 rounded-full ${colorClass} flex-shrink-0 transition-transform group-hover:scale-105`}>
                            <Icon className='w-4 h-4' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-start justify-between'>
                              <div className='flex-1 min-w-0'>
                                <p className='text-sm font-semibold text-gray-900 truncate'>{activity.title}</p>
                                <p className='text-sm text-gray-600 mt-1 line-clamp-2'>{activity.description}</p>
                              </div>
                              <span className='text-xs text-gray-400 ml-2 flex-shrink-0'>
                                {formatTimeAgo(activity.timestamp)}
                              </span>
                            </div>
                            
                            {activity.user && (
                              <div className='flex items-center mt-2 text-xs text-gray-500'>
                                <div className='w-4 h-4 bg-gray-200 rounded-full mr-2 flex-shrink-0'></div>
                                {activity.user.name}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className='text-center py-12'>
                    <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                      <Activity className='w-8 h-8 text-gray-400' />
                    </div>
                    <h3 className='text-sm font-medium text-gray-900 mb-2'>No recent activity</h3>
                    <p className='text-sm text-gray-500'>
                      Your fan interactions and updates will appear here
                    </p>
                  </div>
                )}
              </LoadingState>
            </EnhancedCardContent>
          </EnhancedCard>
        </div>
      </div>

      {/* Quick Links */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4'>Need Help?</h3>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <Link
            href='/support'
            className='flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'
          >
            <QuestionMarkCircleIcon className='w-5 h-5 text-gray-600 mr-3' />
            <span className='text-sm font-medium text-gray-900'>Help Center</span>
          </Link>
          <Link
            href='/profile/settings'
            className='flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'
          >
            <CogIcon className='w-5 h-5 text-gray-600 mr-3' />
            <span className='text-sm font-medium text-gray-900'>Account Settings</span>
          </Link>
          <Link
            href='/profile/billing'
            className='flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'
          >
            <CurrencyDollarIcon className='w-5 h-5 text-gray-600 mr-3' />
            <span className='text-sm font-medium text-gray-900'>Billing & Payouts</span>
          </Link>
        </div>
      </div>
      
      {/* Floating Action Button for Quick Upload */}
      <FloatingActionButton
        icon={<Upload className='w-6 h-6' />}
        aria-label='Upload Content'
        onClick={() => window.location.href = '/dashboard/artist/upload'}
        variant='gradient'
        className='lg:hidden' // Only show on mobile/tablet
      />
    </div>
  );
}
