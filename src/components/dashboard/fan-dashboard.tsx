"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  MagnifyingGlassIcon,
  ChatBubbleLeftIcon,
  CogIcon,
  HeartIcon,
  CurrencyDollarIcon,
  MusicalNoteIcon,
  UserIcon,
  PlayIcon,
  StarIcon,
  ClockIcon,
  BellIcon,
  TrophyIcon,
  CalendarIcon,
  UsersIcon
} from '@heroicons/react/24/outline'
import { useApi } from '@/hooks/use-api'
import { LoadingState, SkeletonCard } from '@/components/ui/loading'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

interface FanStats {
  activeSubscriptions: number
  totalSpent: number
  favoriteArtists: number
  hoursListened: number
  unreadMessages: number
  activeCampaigns: number
  totalSubmissions: number
  featuredSubmissions: number
  achievements: number
}

interface Subscription {
  id: string
  artist: {
    id: string
    displayName: string
    avatar?: string
  }
  tier: {
    name: string
    price: number
  }
  status: string
  nextBillingDate: string
}

interface RecentContent {
  id: string
  title: string
  artist: {
    displayName: string
    avatar?: string
  }
  type: 'audio' | 'video' | 'image' | 'text'
  createdAt: string
  thumbnail?: string
}

interface RecommendedArtist {
  id: string
  displayName: string
  avatar?: string
  genre: string
  subscriberCount: number
  description: string
}

interface ParticipatingCampaign {
  id: string
  title: string
  type: 'MUSIC_PROMOTION' | 'CONTEST' | 'COLLABORATION' | 'EXCLUSIVE_ACCESS'
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  endDate: string
  artist: {
    name: string
    avatar: string
  }
  progress: {
    current: number
    target: number
  }
  userSubmissions: number
  isWinner?: boolean
  rank?: number
}

interface CampaignSubmission {
  id: string
  campaignId: string
  campaignTitle: string
  type: 'text' | 'image' | 'video' | 'audio'
  content: string
  status: 'pending' | 'approved' | 'featured' | 'rejected'
  submittedAt: string
  likes: number
  views: number
  artistName: string
}

export default function FanDashboard() {
  const { data: session } = useSession()

  // Fetch fan stats
  const {
    data: statsResponse,
    loading: loadingStats
  } = useApi<{ data: { stats: FanStats } }>('/api/fan/stats', {
    immediate: true
  })

  // Fetch active subscriptions
  const {
    data: subscriptionsResponse,
    loading: loadingSubscriptions
  } = useApi<{ subscriptions: Subscription[] }>('/api/fan/subscriptions?status=active', {
    immediate: true
  })

  // Fetch recent content
  const {
    data: recentContentResponse,
    loading: loadingRecentContent
  } = useApi<{ content: RecentContent[] }>('/api/fan/content/recent?limit=6', {
    immediate: true
  })

  // Fetch recommended artists
  const {
    data: recommendationsResponse,
    loading: loadingRecommendations
  } = useApi<{ artists: RecommendedArtist[] }>('/api/recommendations/artists?limit=3', {
    immediate: true
  })

  // Fetch participating campaigns
  const {
    data: campaignsResponse,
    loading: loadingCampaigns
  } = useApi<{ campaigns: ParticipatingCampaign[] }>('/api/fan/campaigns', {
    immediate: true
  })

  // Fetch campaign submissions
  const {
    data: submissionsResponse,
    loading: loadingSubmissions
  } = useApi<{ submissions: CampaignSubmission[] }>('/api/fan/submissions?limit=5', {
    immediate: true
  })

  const stats = statsResponse?.data?.stats || {
    activeSubscriptions: 0,
    totalSpent: 0,
    favoriteArtists: 0,
    hoursListened: 0,
    unreadMessages: 0,
    activeCampaigns: 0,
    totalSubmissions: 0,
    featuredSubmissions: 0,
    achievements: 0
  }

  const subscriptions = subscriptionsResponse?.subscriptions || []
  const recentContent = recentContentResponse?.content || []
  const recommendedArtists = recommendationsResponse?.artists || []
  const campaigns = campaignsResponse?.campaigns || []
  const submissions = submissionsResponse?.submissions || []

  const quickAccessCards = [
    {
      title: 'Discover Campaigns',
      description: 'Join artist campaigns',
      href: '/campaigns',
      icon: TrophyIcon,
      color: 'bg-purple-500',
      stats: 'Find new campaigns'
    },
    {
      title: 'My Campaigns',
      description: 'View participating campaigns',
      href: '/dashboard/fan/campaigns',
      icon: UsersIcon,
      color: 'bg-green-500',
      stats: `${stats.activeCampaigns} active`
    },
    {
      title: 'Messages',
      description: 'Chat with artists',
      href: '/messages',
      icon: ChatBubbleLeftIcon,
      color: 'bg-blue-500',
      badge: stats.unreadMessages,
      stats: `${stats.unreadMessages} unread`
    },
    {
      title: 'Subscriptions',
      description: 'Manage your subscriptions',
      href: '/dashboard/fan/subscriptions',
      icon: HeartIcon,
      color: 'bg-pink-500',
      stats: `${stats.activeSubscriptions} active`
    }
  ]

  const statCards = [
    {
      title: 'Active Campaigns',
      value: stats.activeCampaigns.toString(),
      icon: TrophyIcon,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      title: 'Total Submissions',
      value: stats.totalSubmissions.toString(),
      icon: PlayIcon,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      title: 'Featured Content',
      value: stats.featuredSubmissions.toString(),
      icon: StarIcon,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50'
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubscriptions.toString(),
      icon: HeartIcon,
      color: 'text-pink-600',
      bg: 'bg-pink-50'
    }
  ]

  const formatNextBilling = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays <= 0) return 'Due now'
    if (diffInDays === 1) return 'Tomorrow'
    if (diffInDays <= 7) return `In ${diffInDays} days`
    return date.toLocaleDateString()
  }

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'audio': return MusicalNoteIcon
      case 'video': return PlayIcon
      default: return MusicalNoteIcon
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-pink-500 to-indigo-600 rounded-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {session?.user.name}! 🎵
        </h1>
        <p className="text-pink-100 text-lg">
          Join artist campaigns, discover amazing content from your favorite artists and explore new ones.
        </p>
      </div>

      {/* Stats Overview */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Activity</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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

          {/* Recent Content */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Content</h3>
          <LoadingState
            loading={loadingRecentContent}
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} lines={3} />
                ))}
              </div>
            }
          >
            {recentContent.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentContent.map((content) => {
                  const Icon = getContentIcon(content.type)
                  return (
                    <div
                      key={content.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          {content.thumbnail ? (
                            <img
                              src={content.thumbnail}
                              alt={content.title}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <Icon className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {content.title}
                          </h4>
                          <p className="text-sm text-gray-600 truncate">
                            by {content.artist.displayName}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(content.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-lg shadow-sm border border-gray-200">
                <MusicalNoteIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">No recent content</p>
                <p className="text-sm text-gray-400 mb-4">
                  Subscribe to artists to see their latest content here
                </p>
                <Link
                  href="/search"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                  Discover Artists
                </Link>
              </div>
            )}
          </LoadingState>

          {/* Participating Campaigns */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-8">My Campaigns</h3>
          <LoadingState
            loading={loadingCampaigns}
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} lines={4} />
                ))}
              </div>
            }
          >
            {campaigns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaigns.slice(0, 4).map((campaign) => (
                  <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`text-white text-xs ${
                              campaign.status === 'ACTIVE' ? 'bg-green-500' : 
                              campaign.status === 'COMPLETED' ? 'bg-blue-500' : 'bg-gray-500'
                            }`}>
                              {campaign.status}
                            </Badge>
                            {campaign.isWinner && (
                              <Badge className="bg-yellow-500 text-white text-xs">
                                <TrophyIcon className="w-3 h-3 mr-1" />
                                Winner #{campaign.rank}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-semibold text-gray-900 text-sm">{campaign.title}</h4>
                          <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                            <UserIcon className="w-3 h-3" />
                            {campaign.artist.name}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Progress</span>
                            <span>{campaign.progress.current}/{campaign.progress.target}</span>
                          </div>
                          <Progress 
                            value={(campaign.progress.current / campaign.progress.target) * 100}
                            className="h-1.5"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <PlayIcon className="w-3 h-3" />
                            {campaign.userSubmissions} submissions
                          </div>
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            Ends {new Date(campaign.endDate).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <Link href={`/campaigns/${campaign.id}`} className="block">
                          <Button className="w-full" size="sm">
                            View Campaign
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-lg shadow-sm border border-gray-200">
                <TrophyIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">No campaigns yet</p>
                <p className="text-sm text-gray-400 mb-4">
                  Join artist campaigns to showcase your creativity
                </p>
                <Link
                  href="/campaigns"
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  <TrophyIcon className="w-4 h-4 mr-2" />
                  Discover Campaigns
                </Link>
              </div>
            )}
          </LoadingState>
        </div>

        {/* Subscriptions & Recommendations */}
        <div className="space-y-8">
          {/* Active Subscriptions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Subscriptions</h3>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <LoadingState
                loading={loadingSubscriptions}
                fallback={<SkeletonCard lines={3} />}
              >
                {subscriptions.length > 0 ? (
                  <div className="space-y-4">
                    {subscriptions.slice(0, 3).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {sub.artist.avatar ? (
                              <img
                                src={sub.artist.avatar}
                                alt={sub.artist.displayName}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <UserIcon className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {sub.artist.displayName}
                            </p>
                            <p className="text-sm text-gray-600">
                              ${sub.tier.price}/month
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            Next: {formatNextBilling(sub.nextBillingDate)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {subscriptions.length > 3 && (
                      <Link
                        href="/dashboard/fan/subscriptions"
                        className="block text-center text-sm text-indigo-600 hover:text-indigo-500 pt-3 border-t border-gray-200"
                      >
                        View all subscriptions
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <HeartIcon className="w-8 h-8 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No subscriptions yet</p>
                    <p className="text-sm text-gray-400">
                      Support your favorite artists
                    </p>
                  </div>
                )}
              </LoadingState>
            </div>
          </div>

          {/* Recommended Artists */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Discover New Artists</h3>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <LoadingState
                loading={loadingRecommendations}
                fallback={<SkeletonCard lines={4} />}
              >
                {recommendedArtists.length > 0 ? (
                  <div className="space-y-4">
                    {recommendedArtists.map((artist) => (
                      <div key={artist.id} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            {artist.avatar ? (
                              <img
                                src={artist.avatar}
                                alt={artist.displayName}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <UserIcon className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-gray-900">{artist.displayName}</h4>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                {artist.genre}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {artist.description}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-gray-500">
                                {artist.subscriberCount.toLocaleString()} subscribers
                              </p>
                              <Link
                                href={`/artist/${artist.id}`}
                                className="text-xs text-indigo-600 hover:text-indigo-500 font-medium"
                              >
                                View Profile
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Link
                      href="/search"
                      className="block text-center text-sm text-indigo-600 hover:text-indigo-500 pt-3 border-t border-gray-200"
                    >
                      Discover more artists
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <StarIcon className="w-8 h-8 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No recommendations yet</p>
                    <p className="text-sm text-gray-400">
                      Start subscribing to get personalized recommendations
                    </p>
                  </div>
                )}
              </LoadingState>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}