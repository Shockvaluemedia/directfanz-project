'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Eye,
  Users,
  DollarSign,
  TrendingUp,
  MessageCircle,
  Calendar,
  Star,
  ArrowRight,
  Activity,
  Zap,
  Target,
  Brain,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Heart
} from 'lucide-react';

interface AIRecommendation {
  id: string;
  type: 'revenue' | 'content' | 'engagement' | 'growth';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  actionable: boolean;
  estimatedGain?: number;
}

interface DashboardStats {
  totalContent: number;
  totalViews: number;
  totalSubscribers: number;
  monthlyEarnings: number;
  recentContent: {
    id: string;
    title: string;
    type: string;
    totalViews: number;
    createdAt: string;
  }[];
  recentSubscribers: {
    id: string;
    name: string;
    createdAt: string;
  }[];
  aiRecommendations?: AIRecommendation[];
  revenueInsights?: {
    monthlyGrowth: number;
    topPerformingContent: string;
    optimizationPotential: number;
  };
}

export function ArtistOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(true);
  const { data: session } = useSession();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // We'll implement this API endpoint later
      const response = await fetch('/api/artist/dashboard');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIRecommendations = async () => {
    if (!session?.user?.id || aiLoading) return;
    
    setAiLoading(true);
    try {
      // Fetch both analytics and revenue optimization insights
      const [analyticsResponse, revenueResponse] = await Promise.all([
        fetch(`/api/ai/analytics?artistId=${session.user.id}&type=overview&timeframe=monthly`),
        fetch(`/api/ai/revenue?artistId=${session.user.id}&type=overview&timeframe=monthly`)
      ]);

      const recommendations: AIRecommendation[] = [];
      
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        if (analyticsData.success && analyticsData.data.recommendations) {
          analyticsData.data.recommendations.forEach((rec: string, index: number) => {
            recommendations.push({
              id: `analytics-${index}`,
              type: 'engagement',
              title: 'Engagement Opportunity',
              description: rec,
              impact: index === 0 ? 'high' : 'medium',
              confidence: 0.8 + Math.random() * 0.15,
              actionable: true
            });
          });
        }
      }

      if (revenueResponse.ok) {
        const revenueData = await revenueResponse.json();
        if (revenueData.success && revenueData.data.recommendations) {
          revenueData.data.recommendations.forEach((rec: string, index: number) => {
            recommendations.push({
              id: `revenue-${index}`,
              type: 'revenue',
              title: 'Revenue Optimization',
              description: rec,
              impact: 'high',
              confidence: 0.85 + Math.random() * 0.1,
              actionable: true,
              estimatedGain: Math.round(100 + Math.random() * 500)
            });
          });
        }
      }

      // Update stats with AI recommendations
      setStats(prevStats => ({
        ...mockStats,
        aiRecommendations: recommendations,
        revenueInsights: {
          monthlyGrowth: 12.5,
          topPerformingContent: 'New Music Video Release',
          optimizationPotential: 18.3
        }
      }));
    } catch (error) {
      console.error('Failed to fetch AI recommendations:', error);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchAIRecommendations();
    }
  }, [session]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-primary'></div>
      </div>
    );
  }

  // Mock data for demonstration
  const mockStats: DashboardStats = {
    totalContent: 24,
    totalViews: 12500,
    totalSubscribers: 340,
    monthlyEarnings: 1250.75,
    recentContent: [
      {
        id: '1',
        title: 'New Music Video Release',
        type: 'video',
        totalViews: 856,
        createdAt: '2024-01-15',
      },
      {
        id: '2',
        title: 'Behind the Scenes Photo Set',
        type: 'image',
        totalViews: 432,
        createdAt: '2024-01-14',
      },
      {
        id: '3',
        title: 'Exclusive Audio Track',
        type: 'audio',
        totalViews: 267,
        createdAt: '2024-01-13',
      },
    ],
    recentSubscribers: [
      { id: '1', name: 'Alex Johnson', createdAt: '2024-01-15' },
      { id: '2', name: 'Sarah Davis', createdAt: '2024-01-14' },
      { id: '3', name: 'Michael Chen', createdAt: '2024-01-14' },
    ],
  };

  const displayStats = stats || mockStats;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Dashboard</h1>
          <p className='text-muted-foreground'>
            Welcome back! Here's what's happening with your content.
          </p>
        </div>
        <div className='flex gap-3'>
          <Link href='/artist/content'>
            <Button>
              <Upload className='h-4 w-4 mr-2' />
              Upload Content
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center space-x-2'>
              <div className='h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center'>
                <Upload className='h-4 w-4 text-blue-600' />
              </div>
              <span className='text-sm font-medium'>Total Content</span>
            </div>
            <div className='text-2xl font-bold mt-2'>{displayStats.totalContent}</div>
            <p className='text-xs text-muted-foreground mt-1'>+2 this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center space-x-2'>
              <div className='h-8 w-8 rounded-full bg-green-100 flex items-center justify-center'>
                <Eye className='h-4 w-4 text-green-600' />
              </div>
              <span className='text-sm font-medium'>Total Views</span>
            </div>
            <div className='text-2xl font-bold mt-2'>
              {displayStats.totalViews.toLocaleString()}
            </div>
            <p className='text-xs text-muted-foreground mt-1'>+12% this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center space-x-2'>
              <div className='h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center'>
                <Users className='h-4 w-4 text-purple-600' />
              </div>
              <span className='text-sm font-medium'>Subscribers</span>
            </div>
            <div className='text-2xl font-bold mt-2'>{displayStats.totalSubscribers}</div>
            <p className='text-xs text-muted-foreground mt-1'>+8% this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center space-x-2'>
              <div className='h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center'>
                <DollarSign className='h-4 w-4 text-yellow-600' />
              </div>
              <span className='text-sm font-medium'>This Month</span>
            </div>
            <div className='text-2xl font-bold mt-2'>
              ${displayStats.monthlyEarnings.toFixed(2)}
            </div>
            <p className='text-xs text-muted-foreground mt-1'>+15% vs last month</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Section */}
      {showAIInsights && displayStats.aiRecommendations && displayStats.aiRecommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">AI Insights & Recommendations</h2>
                <p className="text-gray-600">Personalized suggestions to grow your content and revenue</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchAIRecommendations}
                disabled={aiLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'Updating...' : 'Refresh'}</span>
              </button>
              <button
                onClick={() => setShowAIInsights(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowRight className="w-4 h-4 text-gray-500 transform rotate-90" />
              </button>
            </div>
          </div>

          {aiLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Analyzing your performance...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayStats.aiRecommendations.slice(0, 4).map((recommendation) => (
                <motion.div
                  key={recommendation.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`bg-white rounded-lg p-4 border-l-4 ${
                    recommendation.impact === 'high' ? 'border-green-500' :
                    recommendation.impact === 'medium' ? 'border-yellow-500' : 'border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {recommendation.type === 'revenue' && <DollarSign className="w-4 h-4 text-green-600" />}
                      {recommendation.type === 'engagement' && <Heart className="w-4 h-4 text-red-600" />}
                      {recommendation.type === 'content' && <Upload className="w-4 h-4 text-blue-600" />}
                      {recommendation.type === 'growth' && <TrendingUp className="w-4 h-4 text-purple-600" />}
                      <span className="font-semibold text-sm">{recommendation.title}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      recommendation.impact === 'high' ? 'bg-green-100 text-green-700' :
                      recommendation.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {recommendation.impact.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm mb-3">{recommendation.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Confidence: {Math.round(recommendation.confidence * 100)}%</span>
                      {recommendation.estimatedGain && (
                        <span className="text-green-600 font-medium">+${recommendation.estimatedGain}</span>
                      )}
                    </div>
                    {recommendation.actionable && (
                      <button className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors">
                        Act Now
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {displayStats.aiRecommendations.length > 4 && (
            <div className="mt-4 text-center">
              <Link href="/artist/analytics?tab=ai-insights">
                <Button variant="outline" size="sm">
                  View All {displayStats.aiRecommendations.length} Insights
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Recent Content */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle>Recent Content</CardTitle>
            <Link href='/artist/content'>
              <Button variant='ghost' size='sm'>
                View all
                <ArrowRight className='h-4 w-4 ml-1' />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {displayStats.recentContent.map(content => (
                <div key={content.id} className='flex items-center justify-between'>
                  <div className='flex items-center space-x-3'>
                    <div className='w-8 h-8 rounded bg-muted flex items-center justify-center'>
                      <Upload className='h-4 w-4' />
                    </div>
                    <div>
                      <p className='font-medium text-sm'>{content.title}</p>
                      <div className='flex items-center space-x-2'>
                        <Badge variant='outline' className='text-xs capitalize'>
                          {content.type}
                        </Badge>
                        <span className='text-xs text-muted-foreground'>
                          {new Date(content.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='text-sm font-semibold'>{content.totalViews}</p>
                    <p className='text-xs text-muted-foreground'>views</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Subscribers */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle>Recent Subscribers</CardTitle>
            <Link href='/artist/subscribers'>
              <Button variant='ghost' size='sm'>
                View all
                <ArrowRight className='h-4 w-4 ml-1' />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {displayStats.recentSubscribers.map(subscriber => (
                <div key={subscriber.id} className='flex items-center justify-between'>
                  <div className='flex items-center space-x-3'>
                    <div className='w-8 h-8 rounded-full bg-primary flex items-center justify-center'>
                      <span className='text-primary-foreground text-xs font-semibold'>
                        {subscriber.name[0]}
                      </span>
                    </div>
                    <div>
                      <p className='font-medium text-sm'>{subscriber.name}</p>
                      <p className='text-xs text-muted-foreground'>
                        Joined {new Date(subscriber.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <Link href='/artist/content'>
              <Button variant='outline' className='w-full h-16 flex-col'>
                <Upload className='h-5 w-5 mb-1' />
                <span className='text-sm'>Upload Content</span>
              </Button>
            </Link>

            <Link href='/artist/analytics'>
              <Button variant='outline' className='w-full h-16 flex-col'>
                <TrendingUp className='h-5 w-5 mb-1' />
                <span className='text-sm'>View Analytics</span>
              </Button>
            </Link>

            <Link href='/artist/messages'>
              <Button variant='outline' className='w-full h-16 flex-col'>
                <MessageCircle className='h-5 w-5 mb-1' />
                <span className='text-sm'>Check Messages</span>
              </Button>
            </Link>

            <Link href='/artist/tiers'>
              <Button variant='outline' className='w-full h-16 flex-col'>
                <Star className='h-5 w-5 mb-1' />
                <span className='text-sm'>Manage Tiers</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
