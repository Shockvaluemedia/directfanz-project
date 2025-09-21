'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Users, 
  FileText, 
  Shield, 
  BarChart3, 
  Settings, 
  AlertTriangle,
  TrendingUp,
  Eye,
  Ban,
  CheckCircle
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalCreators: number;
  totalFans: number;
  totalContent: number;
  activeReports: number;
  pendingApprovals: number;
  monthlyRevenue: number;
  newUsersToday: number;
}

interface RecentActivity {
  id: string;
  type: 'user_registered' | 'content_uploaded' | 'report_filed' | 'payment_processed';
  description: string;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high';
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    // Check if user is admin (in a real app, you'd check user role)
    const userRole = (session.user as any)?.role;
    if (userRole !== 'ADMIN' && userRole !== 'ARTIST') {
      // For demo purposes, allow ARTIST role to access admin (in production, only ADMIN)
      console.warn('Non-admin access to admin panel - demo mode');
    }

    loadAdminData();
  }, [session, status, router]);

  const loadAdminData = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API call - in real app, this would fetch from backend
      const mockStats: AdminStats = {
        totalUsers: 1247,
        totalCreators: 156,
        totalFans: 1091,
        totalContent: 2849,
        activeReports: 7,
        pendingApprovals: 12,
        monthlyRevenue: 45230,
        newUsersToday: 23,
      };

      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'report_filed',
          description: 'Content report filed for inappropriate material',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          severity: 'high'
        },
        {
          id: '2',
          type: 'user_registered',
          description: 'New creator account: @newartist2024',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          severity: 'low'
        },
        {
          id: '3',
          type: 'content_uploaded',
          description: 'Content pending approval from verified creator',
          timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          severity: 'medium'
        },
        {
          id: '4',
          type: 'payment_processed',
          description: 'Monthly payout processed: $12,450',
          timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
          severity: 'low'
        },
      ];

      setStats(mockStats);
      setRecentActivity(mockActivity);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!session || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-gray-600">You don't have permission to access the admin panel.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'report_filed': return AlertTriangle;
      case 'user_registered': return Users;
      case 'content_uploaded': return FileText;
      case 'payment_processed': return TrendingUp;
      default: return Eye;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Platform management and oversight tools</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Content</p>
                <p className="text-2xl font-bold">{stats.totalContent.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Reports</p>
                <p className="text-2xl font-bold">{stats.activeReports}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <Users className="w-4 h-4 mr-2" />
                User Management
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Content Moderation
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics Dashboard
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Platform Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
            <CardDescription>Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                  <div>
                    <p className="font-medium">Content Reports</p>
                    <p className="text-sm text-gray-600">{stats.activeReports} pending</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Review
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-yellow-600 mr-3" />
                  <div>
                    <p className="font-medium">Content Approval</p>
                    <p className="text-sm text-gray-600">{stats.pendingApprovals} pending</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Review
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-blue-600 mr-3" />
                  <div>
                    <p className="font-medium">New Users Today</p>
                    <p className="text-sm text-gray-600">{stats.newUsersToday} registrations</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const IconComponent = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full ${getSeverityColor(activity.severity)}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Statistics */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
          <CardDescription>Breakdown of platform users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.totalCreators}</div>
              <p className="text-gray-600">Content Creators</p>
              <p className="text-sm text-gray-500">
                {((stats.totalCreators / stats.totalUsers) * 100).toFixed(1)}% of users
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.totalFans}</div>
              <p className="text-gray-600">Fans</p>
              <p className="text-sm text-gray-500">
                {((stats.totalFans / stats.totalUsers) * 100).toFixed(1)}% of users
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {(stats.totalContent / stats.totalCreators).toFixed(1)}
              </div>
              <p className="text-gray-600">Avg Content/Creator</p>
              <p className="text-sm text-gray-500">Content creation rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}