'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Activity
} from 'lucide-react';

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
}

export function ArtistOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
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
      { id: '1', title: 'New Music Video Release', type: 'video', totalViews: 856, createdAt: '2024-01-15' },
      { id: '2', title: 'Behind the Scenes Photo Set', type: 'image', totalViews: 432, createdAt: '2024-01-14' },
      { id: '3', title: 'Exclusive Audio Track', type: 'audio', totalViews: 267, createdAt: '2024-01-13' },
    ],
    recentSubscribers: [
      { id: '1', name: 'Alex Johnson', createdAt: '2024-01-15' },
      { id: '2', name: 'Sarah Davis', createdAt: '2024-01-14' },
      { id: '3', name: 'Michael Chen', createdAt: '2024-01-14' },
    ]
  };

  const displayStats = stats || mockStats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your content.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/artist/content">
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Content
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Upload className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium">Total Content</span>
            </div>
            <div className="text-2xl font-bold mt-2">{displayStats.totalContent}</div>
            <p className="text-xs text-muted-foreground mt-1">+2 this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Eye className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm font-medium">Total Views</span>
            </div>
            <div className="text-2xl font-bold mt-2">{displayStats.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">+12% this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-sm font-medium">Subscribers</span>
            </div>
            <div className="text-2xl font-bold mt-2">{displayStats.totalSubscribers}</div>
            <p className="text-xs text-muted-foreground mt-1">+8% this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-yellow-600" />
              </div>
              <span className="text-sm font-medium">This Month</span>
            </div>
            <div className="text-2xl font-bold mt-2">${displayStats.monthlyEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">+15% vs last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Content */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Content</CardTitle>
            <Link href="/artist/content">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayStats.recentContent.map((content) => (
                <div key={content.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{content.title}</p>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {content.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(content.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{content.totalViews}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Subscribers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Subscribers</CardTitle>
            <Link href="/artist/subscribers">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayStats.recentSubscribers.map((subscriber) => (
                <div key={subscriber.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground text-xs font-semibold">
                        {subscriber.name[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{subscriber.name}</p>
                      <p className="text-xs text-muted-foreground">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/artist/content">
              <Button variant="outline" className="w-full h-16 flex-col">
                <Upload className="h-5 w-5 mb-1" />
                <span className="text-sm">Upload Content</span>
              </Button>
            </Link>
            
            <Link href="/artist/analytics">
              <Button variant="outline" className="w-full h-16 flex-col">
                <TrendingUp className="h-5 w-5 mb-1" />
                <span className="text-sm">View Analytics</span>
              </Button>
            </Link>
            
            <Link href="/artist/messages">
              <Button variant="outline" className="w-full h-16 flex-col">
                <MessageCircle className="h-5 w-5 mb-1" />
                <span className="text-sm">Check Messages</span>
              </Button>
            </Link>
            
            <Link href="/artist/tiers">
              <Button variant="outline" className="w-full h-16 flex-col">
                <Star className="h-5 w-5 mb-1" />
                <span className="text-sm">Manage Tiers</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}