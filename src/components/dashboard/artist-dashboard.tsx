"use client"

import React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
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
  TrophyIcon
} from '@heroicons/react/24/outline'
import { useApi } from '@/hooks/use-api'
import { LoadingState, SkeletonCard } from '@/components/ui/loading'

interface DashboardStats {
  totalSubscribers: number
  monthlyRevenue: number
  totalContent: number
  engagementRate: number
  unreadMessages: number
  pendingNotifications: number
}

interface RecentActivity {
  id: string
  type: 'subscription' | 'message' | 'content' | 'comment'
  title: string
  description: string
  timestamp: string
  user?: {
    name: string
    avatar?: string
  }
}

export default function ArtistDashboard() {
  const { data: session } = useSession()

  // Fetch dashboard stats
  const {
    data: statsResponse,
    loading: loadingStats
  } = useApi<{ stats: DashboardStats }>('/api/artist/analytics?summary=true', {
    immediate: true
  })

  // Fetch recent activity
  const {
    data: activityResponse,
    loading: loadingActivity
  } = useApi<{ activities: RecentActivity[] }>('/api/artist/activity?limit=5', {
    immediate: true
  })

  const stats = statsResponse?.stats || {
    totalSubscribers: 0,
    monthlyRevenue: 0,
    totalContent: 0,
    engagementRate: 0,
    unreadMessages: 0,
    pendingNotifications: 0
  }

  const activities = activityResponse?.activities || []

  const quickAccessCards = [
    {
      title: 'Live Streaming',
      description: 'Schedule and manage live streams',
      href: '/dashboard/artist/livestreams',
      icon: VideoCameraIcon,
      color: 'bg-red-500',
      stats: 'Go live with fans'
    },
    {
      title: 'Campaigns & Challenges',
      description: 'Create engaging fan campaigns',
      href: '/dashboard/artist/campaigns',
      icon: TrophyIcon,
      color: 'bg-orange-500',
      stats: 'Drive fan engagement'
    },
    {
      title: 'Messages',
      description: 'Chat with your fans',
      href: '/messages',
      icon: ChatBubbleLeftIcon,
      color: 'bg-blue-500',
      badge: stats.unreadMessages,
      stats: `${stats.unreadMessages} unread`
    },
    {
      title: 'Upload Content',
      description: 'Share new content with fans',
      href: '/dashboard/artist/upload',
      icon: PlusIcon,
      color: 'bg-green-500',
      stats: `${stats.totalContent} total items`
    },
    {
      title: 'Analytics',
      description: 'Track your performance',
      href: '/dashboard/artist/analytics',
      icon: ChartBarIcon,
      color: 'bg-purple-500',
      stats: `${stats.engagementRate}% engagement`
    },
    {
      title: 'Profile Settings',
      description: 'Update your profile',
      href: '/profile/settings',
      icon: CogIcon,
      color: 'bg-gray-500',
      stats: 'Manage account'
    },
    {
      title: 'Content Library',
      description: 'Manage your content',
      href: '/dashboard/artist/content',
      icon: MusicalNoteIcon,
      color: 'bg-indigo-500',
      stats: `${stats.totalContent} items`
    },
    {
      title: 'Subscription Tiers',
      description: 'Manage your tiers',
      href: '/dashboard/artist/tiers',
      icon: DocumentDuplicateIcon,
      color: 'bg-yellow-500',
      stats: 'Configure pricing'
    }
  ]

  const statCards = [
    {
      title: 'Total Subscribers',
      value: stats.totalSubscribers.toLocaleString(),
      icon: UsersIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Monthly Revenue',
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      icon: CurrencyDollarIcon,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      title: 'Content Items',
      value: stats.totalContent.toString(),
      icon: MusicalNoteIcon,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      title: 'Engagement Rate',
      value: `${stats.engagementRate}%`,
      icon: HeartIcon,
      color: 'text-pink-600',
      bg: 'bg-pink-50'
    }
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'subscription': return UsersIcon
      case 'message': return ChatBubbleLeftIcon
      case 'content': return MusicalNoteIcon
      case 'comment': return HeartIcon
      default: return BellIcon
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'subscription': return 'bg-green-100 text-green-600'
      case 'message': return 'bg-blue-100 text-blue-600'
      case 'content': return 'bg-purple-100 text-purple-600'
      case 'comment': return 'bg-pink-100 text-pink-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {session?.user.name}! 👋
        </h1>
        <p className="text-indigo-100 text-lg">
          Here's what's happening with your content and community today.
        </p>
      </div>

      {/* Stats Overview */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Stats</h2>
        <LoadingState
          loading={loadingStats}
          fallback={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} lines={2} />
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.title} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-lg ${stat.bg} mr-4`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </LoadingState>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickAccessCards.map((card) => {
              const Icon = card.icon
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-3">
                        <div className={`p-2 rounded-lg ${card.color} text-white mr-3`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        {card.badge && card.badge > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">{card.description}</p>
                      <p className="text-xs text-gray-500">{card.stats}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <LoadingState
              loading={loadingActivity}
              fallback={
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} lines={2} />
                  ))}
                </div>
              }
            >
              {activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((activity) => {
                    const Icon = getActivityIcon(activity.type)
                    const colorClass = getActivityColor(activity.type)
                    
                    return (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className={`p-2 rounded-full ${colorClass} flex-shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.title}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {activity.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimeAgo(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BellIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-medium">No recent activity</p>
                  <p className="text-sm text-gray-400">
                    Your recent fan interactions will appear here
                  </p>
                </div>
              )}
            </LoadingState>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/support"
            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <QuestionMarkCircleIcon className="w-5 h-5 text-gray-600 mr-3" />
            <span className="text-sm font-medium text-gray-900">Help Center</span>
          </Link>
          <Link
            href="/profile/settings"
            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <CogIcon className="w-5 h-5 text-gray-600 mr-3" />
            <span className="text-sm font-medium text-gray-900">Account Settings</span>
          </Link>
          <Link
            href="/profile/billing"
            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <CurrencyDollarIcon className="w-5 h-5 text-gray-600 mr-3" />
            <span className="text-sm font-medium text-gray-900">Billing & Payouts</span>
          </Link>
        </div>
      </div>
    </div>
  )
}