'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { TouchCard } from '@/components/ui/TouchCard';
import { TouchButton } from '@/components/ui/TouchButton';
import AIInsightsDashboard from '@/components/admin/AIInsightsDashboard';
import {
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Shield,
  Activity,
  Settings,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  Brain,
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalArtists: number;
  totalFans: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalContent: number;
  activeReports: number;
  bannedUsers: number;
  recentSignups: number;
  contentUploadsToday: number;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalArtists: 0,
    totalFans: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalContent: 0,
    activeReports: 0,
    bannedUsers: 0,
    recentSignups: 0,
    contentUploadsToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [showAIDashboard, setShowAIDashboard] = useState(false);

  // Check if user is admin
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.email === 'admin@directfan.com';

  // Fetch dashboard stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setRecentActivity(data.recentActivity || []);
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      fetchStats();
    }
  }, [status, isAdmin]);

  if (status === 'loading') {
    return (
      <div className='min-h-screen bg-gray-50 p-6'>
        <div className='max-w-7xl mx-auto'>
          <div className='animate-pulse space-y-6'>
            <div className='h-8 bg-gray-200 rounded w-1/4'></div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
              {[...Array(8)].map((_, i) => (
                <div key={i} className='h-32 bg-gray-200 rounded'></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <TouchCard className='max-w-md mx-auto text-center p-8'>
          <Shield className='mx-auto mb-4 text-red-500' size={48} />
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>Access Denied</h1>
          <p className='text-gray-600'>You don't have permission to access the admin dashboard.</p>
        </TouchCard>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      change: `+${stats.recentSignups} this week`,
      icon: Users,
      color: 'text-blue-600 bg-blue-100',
      href: '/admin/users',
    },
    {
      title: 'Artists',
      value: stats.totalArtists.toLocaleString(),
      change: `${((stats.totalArtists / stats.totalUsers) * 100).toFixed(1)}% of users`,
      icon: Activity,
      color: 'text-purple-600 bg-purple-100',
      href: '/admin/users?filter=artists',
    },
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      change: `$${stats.monthlyRevenue.toLocaleString()} this month`,
      icon: DollarSign,
      color: 'text-green-600 bg-green-100',
      href: '/admin/analytics/revenue',
    },
    {
      title: 'Content Items',
      value: stats.totalContent.toLocaleString(),
      change: `+${stats.contentUploadsToday} today`,
      icon: FileText,
      color: 'text-indigo-600 bg-indigo-100',
      href: '/admin/content',
    },
    {
      title: 'Active Reports',
      value: stats.activeReports.toLocaleString(),
      change: 'Pending review',
      icon: AlertTriangle,
      color: 'text-orange-600 bg-orange-100',
      href: '/admin/moderation/reports',
    },
    {
      title: 'Revenue Growth',
      value: `${((stats.monthlyRevenue / stats.totalRevenue) * 100).toFixed(1)}%`,
      change: 'Monthly vs total',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-100',
      href: '/admin/analytics',
    },
    {
      title: 'Banned Users',
      value: stats.bannedUsers.toLocaleString(),
      change: 'Safety actions',
      icon: Ban,
      color: 'text-red-600 bg-red-100',
      href: '/admin/moderation/banned',
    },
    {
      title: 'Platform Health',
      value: '99.9%',
      change: 'Uptime this month',
      icon: CheckCircle,
      color: 'text-green-600 bg-green-100',
      href: '/admin/system/health',
    },
  ];

  const quickActions = [
    {
      label: 'Review Reports',
      href: '/admin/moderation/reports',
      icon: Shield,
      urgent: stats.activeReports > 0,
    },
    { label: 'User Management', href: '/admin/users', icon: Users },
    { label: 'Content Review', href: '/admin/content', icon: FileText },
    { label: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
    { label: 'System Settings', href: '/admin/settings', icon: Settings },
    { label: 'Platform Health', href: '/admin/system/health', icon: Activity },
  ];

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-7xl mx-auto p-6'>
        {/* Header */}
        <div className='mb-8 flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 mb-2'>Admin Dashboard</h1>
            <p className='text-gray-600'>Platform overview and management tools</p>
          </div>
          <TouchButton
            variant={showAIDashboard ? 'primary' : 'outline'}
            onClick={() => setShowAIDashboard(!showAIDashboard)}
            leftIcon={<Brain size={20} />}
          >
            {showAIDashboard ? 'Hide AI Insights' : 'Show AI Insights'}
          </TouchButton>
        </div>

        {/* AI Insights Dashboard */}
        {showAIDashboard && (
          <div className='mb-8'>
            <AIInsightsDashboard />
          </div>
        )}

        {/* Stats Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          {statCards.map(card => {
            const Icon = card.icon;
            return (
              <TouchCard
                key={card.title}
                onClick={() => window.open(card.href, '_blank')}
                className='hover:shadow-lg transition-shadow cursor-pointer'
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-4'>
                    <div className={`p-3 rounded-lg ${card.color}`}>
                      <Icon size={24} />
                    </div>
                  </div>

                  <h3 className='text-sm font-medium text-gray-600 mb-1'>{card.title}</h3>
                  <div className='text-2xl font-bold text-gray-900 mb-1'>{card.value}</div>
                  <p className='text-xs text-gray-500'>{card.change}</p>
                </div>
              </TouchCard>
            );
          })}
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Quick Actions */}
          <div className='lg:col-span-1'>
            <TouchCard>
              <div className='p-6'>
                <h2 className='text-lg font-semibold text-gray-900 mb-4'>Quick Actions</h2>
                <div className='space-y-3'>
                  {quickActions.map(action => {
                    const Icon = action.icon;
                    return (
                      <TouchButton
                        key={action.label}
                        variant={action.urgent ? 'primary' : 'outline'}
                        fullWidth
                        leftIcon={<Icon size={16} />}
                        onClick={() => window.open(action.href, '_blank')}
                        className='justify-start'
                      >
                        {action.label}
                        {action.urgent && (
                          <span className='ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1'>
                            !
                          </span>
                        )}
                      </TouchButton>
                    );
                  })}
                </div>
              </div>
            </TouchCard>
          </div>

          {/* Recent Activity */}
          <div className='lg:col-span-2'>
            <TouchCard>
              <div className='p-6'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-semibold text-gray-900'>Recent Activity</h2>
                  <TouchButton
                    variant='ghost'
                    size='sm'
                    leftIcon={<Eye size={16} />}
                    onClick={() => window.open('/admin/activity', '_blank')}
                  >
                    View All
                  </TouchButton>
                </div>

                {loading ? (
                  <div className='space-y-4'>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className='animate-pulse'>
                        <div className='flex items-center space-x-3'>
                          <div className='w-8 h-8 bg-gray-200 rounded-full'></div>
                          <div className='flex-1'>
                            <div className='h-4 bg-gray-200 rounded w-3/4 mb-1'></div>
                            <div className='h-3 bg-gray-200 rounded w-1/2'></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className='text-center py-8 text-gray-500'>
                    <Activity size={48} className='mx-auto mb-4 text-gray-300' />
                    <p>No recent activity to show</p>
                  </div>
                ) : (
                  <div className='space-y-4'>
                    {recentActivity.slice(0, 10).map((activity, index) => (
                      <div
                        key={index}
                        className='flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-b-0'
                      >
                        <div
                          className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-white text-sm
                          ${
                            activity.type === 'user_signup'
                              ? 'bg-green-500'
                              : activity.type === 'content_upload'
                                ? 'bg-blue-500'
                                : activity.type === 'report_submitted'
                                  ? 'bg-red-500'
                                  : activity.type === 'payment_processed'
                                    ? 'bg-emerald-500'
                                    : 'bg-gray-500'
                          }
                        `}
                        >
                          {activity.type === 'user_signup' && <Users size={16} />}
                          {activity.type === 'content_upload' && <FileText size={16} />}
                          {activity.type === 'report_submitted' && <AlertTriangle size={16} />}
                          {activity.type === 'payment_processed' && <DollarSign size={16} />}
                        </div>

                        <div className='flex-1 min-w-0'>
                          <p className='text-sm text-gray-900 truncate'>
                            {activity.description || `${activity.type.replace('_', ' ')} event`}
                          </p>
                          <p className='text-xs text-gray-500'>
                            {activity.createdAt
                              ? new Date(activity.createdAt).toLocaleString()
                              : 'Just now'}
                          </p>
                        </div>

                        {activity.actionRequired && (
                          <span className='bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full'>
                            Action Required
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TouchCard>
          </div>
        </div>

        {/* System Status */}
        <div className='mt-8'>
          <TouchCard>
            <div className='p-6'>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>System Status</h2>

              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <div className='flex items-center space-x-3'>
                  <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
                  <span className='text-sm text-gray-700'>API Services</span>
                </div>
                <div className='flex items-center space-x-3'>
                  <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
                  <span className='text-sm text-gray-700'>Database</span>
                </div>
                <div className='flex items-center space-x-3'>
                  <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
                  <span className='text-sm text-gray-700'>File Storage</span>
                </div>
                <div className='flex items-center space-x-3'>
                  <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
                  <span className='text-sm text-gray-700'>Payment Processing</span>
                </div>
              </div>
            </div>
          </TouchCard>
        </div>
      </div>
    </div>
  );
}
