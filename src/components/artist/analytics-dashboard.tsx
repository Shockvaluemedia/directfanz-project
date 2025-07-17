'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Calendar,
  Activity,
  BarChart3,
  PieChart
} from 'lucide-react';
import { 
  EarningsChart, 
  SubscriberChart, 
  ChurnRateChart, 
  ChurnReasonsChart 
} from './analytics-charts';

interface EarningsData {
  totalEarnings: number;
  monthlyEarnings: number;
  dailyEarnings: number;
  weeklyEarnings: number;
  yearlyEarnings: number;
  earningsGrowth: number;
}

interface SubscriberMetrics {
  totalSubscribers: number;
  activeSubscribers: number;
  newSubscribers: number;
  canceledSubscribers: number;
  churnRate: number;
  retentionRate: number;
}

interface TierAnalytics {
  tierId: string;
  tierName: string;
  subscriberCount: number;
  monthlyRevenue: number;
  averageAmount: number;
  conversionRate: number;
}

interface RecentActivity {
  id: string;
  type: 'subscription' | 'cancellation' | 'payment' | 'content';
  description: string;
  amount?: number;
  timestamp: string;
}

interface ArtistAnalytics {
  earnings: EarningsData;
  subscribers: SubscriberMetrics;
  tiers: TierAnalytics[];
  recentActivity: RecentActivity[];
}

interface TimeSeriesData {
  earnings: { date: string; earnings: number }[];
  subscribers: { 
    date: string; 
    subscribers: number; 
    newSubscribers: number; 
    canceledSubscribers: number; 
  }[];
  period: { start: string; end: string };
}

interface DailyEarningsSummary {
  today: number;
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
  dailyAverage: number;
  trend: 'up' | 'down' | 'stable';
}

interface TierSubscriberData {
  tierId: string;
  tierName: string;
  subscriberCount: number;
  activeSubscribers: number;
  newThisMonth: number;
  churnThisMonth: number;
  revenue: number;
}

interface ChurnAnalysis {
  overallChurnRate: number;
  monthlyChurnRate: number;
  churnByTier: { tierId: string; tierName: string; churnRate: number }[];
  retentionRate: number;
  averageLifetime: number;
  churnReasons: { reason: string; count: number }[];
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<ArtistAnalytics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarningsSummary | null>(null);
  const [tierData, setTierData] = useState<TierSubscriberData[]>([]);
  const [churnData, setChurnData] = useState<ChurnAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
    fetchDailyEarnings();
  }, []);

  useEffect(() => {
    if (activeTab === 'charts') {
      fetchTimeSeriesData();
    } else if (activeTab === 'tiers') {
      fetchTierData();
      fetchChurnData();
    }
  }, [activeTab, selectedPeriod]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/artist/analytics');
      if (response.ok) {
        const result = await response.json();
        setAnalytics(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSeriesData = async () => {
    try {
      const response = await fetch(`/api/artist/analytics?period=${selectedPeriod}`);
      if (response.ok) {
        const result = await response.json();
        setTimeSeriesData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch time series data:', error);
    }
  };

  const fetchDailyEarnings = async () => {
    try {
      const response = await fetch('/api/artist/analytics?type=daily');
      if (response.ok) {
        const result = await response.json();
        setDailyEarnings(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch daily earnings:', error);
    }
  };

  const fetchTierData = async () => {
    try {
      const response = await fetch('/api/artist/analytics?type=tiers');
      if (response.ok) {
        const result = await response.json();
        setTierData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch tier data:', error);
    }
  };

  const fetchChurnData = async () => {
    try {
      const response = await fetch('/api/artist/analytics?type=churn');
      if (response.ok) {
        const result = await response.json();
        setChurnData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch churn data:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load analytics data</p>
        <Button onClick={fetchAnalytics} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <Button onClick={fetchAnalytics} variant="outline">
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="tiers">Tier Performance</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Earnings Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.earnings.totalEarnings)}
                </div>
                <p className="text-xs text-muted-foreground">
                  All time revenue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Earnings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.earnings.monthlyEarnings)}
                </div>
                <div className="flex items-center text-xs">
                  {analytics.earnings.earningsGrowth >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  <span className={analytics.earnings.earningsGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercentage(analytics.earnings.earningsGrowth)}
                  </span>
                  <span className="text-muted-foreground ml-1">from last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.subscribers.activeSubscribers}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.subscribers.newSubscribers} new this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.subscribers.retentionRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.subscribers.churnRate.toFixed(1)}% churn rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Earnings Summary (Requirement 3.2) */}
          {dailyEarnings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  Daily Earnings Summary
                  {dailyEarnings.trend === 'up' && <TrendingUp className="h-4 w-4 ml-2 text-green-500" />}
                  {dailyEarnings.trend === 'down' && <TrendingDown className="h-4 w-4 ml-2 text-red-500" />}
                  {dailyEarnings.trend === 'stable' && <Activity className="h-4 w-4 ml-2 text-blue-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Today</p>
                    <p className="text-xl font-bold">{formatCurrency(dailyEarnings.today)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Yesterday</p>
                    <p className="text-xl font-bold">{formatCurrency(dailyEarnings.yesterday)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-xl font-bold">{formatCurrency(dailyEarnings.thisWeek)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">This Month</p>
                    <p className="text-xl font-bold">{formatCurrency(dailyEarnings.thisMonth)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Daily Average</p>
                    <p className="text-xl font-bold">{formatCurrency(dailyEarnings.dailyAverage)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Weekly Earnings</span>
                    <span className="font-medium">{formatCurrency(analytics.earnings.weeklyEarnings)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Daily Average</span>
                    <span className="font-medium">{formatCurrency(analytics.earnings.weeklyEarnings / 7)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Subscriber Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">New Subscribers</span>
                    <Badge variant="secondary">+{analytics.subscribers.newSubscribers}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cancellations</span>
                    <Badge variant="destructive">-{analytics.subscribers.canceledSubscribers}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Yearly Total</span>
                    <span className="font-medium">{formatCurrency(analytics.earnings.yearlyEarnings)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Monthly Average</span>
                    <span className="font-medium">{formatCurrency(analytics.earnings.yearlyEarnings / 12)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Performance Charts</h2>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {timeSeriesData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EarningsChart 
                data={timeSeriesData.earnings} 
                period={selectedPeriod} 
              />
              <SubscriberChart 
                data={timeSeriesData.subscribers} 
                period={selectedPeriod} 
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tiers" className="space-y-6">
          <h2 className="text-xl font-semibold">Tier Performance</h2>
          
          {/* Detailed Tier Analytics (Requirements 1.5 & 3.4) */}
          <div className="grid gap-4">
            {tierData.length > 0 ? tierData.map((tier) => (
              <Card key={tier.tierId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{tier.tierName}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="secondary">
                        {tier.activeSubscribers} active
                      </Badge>
                      <Badge variant="outline">
                        {tier.subscriberCount} total
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                      <p className="text-xl font-bold">{formatCurrency(tier.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Subscribers</p>
                      <p className="text-xl font-bold">{tier.activeSubscribers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">New This Month</p>
                      <p className="text-xl font-bold text-green-600">+{tier.newThisMonth}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Churned This Month</p>
                      <p className="text-xl font-bold text-red-600">-{tier.churnThisMonth}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg. Amount</p>
                      <p className="text-xl font-bold">
                        {tier.activeSubscribers > 0 ? formatCurrency(tier.revenue / tier.activeSubscribers) : '$0.00'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : analytics.tiers.map((tier) => (
              <Card key={tier.tierId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{tier.tierName}</CardTitle>
                    <Badge variant="secondary">
                      {tier.subscriberCount} subscribers
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                      <p className="text-xl font-bold">{formatCurrency(tier.monthlyRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Average Amount</p>
                      <p className="text-xl font-bold">{formatCurrency(tier.averageAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Subscribers</p>
                      <p className="text-xl font-bold">{tier.subscriberCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {analytics.tiers.length === 0 && tierData.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <PieChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No tiers created yet</p>
                  <p className="text-sm text-muted-foreground">Create your first tier to see performance data</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Churn Analysis (Requirement 3.4) */}
          {churnData && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Churn Analysis</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Overall Churn Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {churnData.overallChurnRate.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Churn Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {churnData.monthlyChurnRate.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {churnData.retentionRate.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Lifetime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {churnData.averageLifetime.toFixed(0)} days
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Churn by Tier</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChurnRateChart data={churnData.churnByTier} />
                    <div className="mt-4 space-y-3">
                      {churnData.churnByTier.map((tier) => (
                        <div key={tier.tierId} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{tier.tierName}</span>
                          <Badge variant={tier.churnRate > 20 ? "destructive" : tier.churnRate > 10 ? "secondary" : "outline"}>
                            {tier.churnRate.toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Churn Reasons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChurnReasonsChart data={churnData.churnReasons} />
                    <div className="mt-4 space-y-3">
                      {churnData.churnReasons.map((reason, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm">{reason.reason}</span>
                          <Badge variant="outline">{reason.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {analytics.recentActivity.map((activity) => (
                  <div key={activity.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'subscription' ? 'bg-green-500' :
                        activity.type === 'cancellation' ? 'bg-red-500' :
                        activity.type === 'content' ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                    {activity.amount && (
                      <Badge variant="outline">
                        {formatCurrency(activity.amount)}
                      </Badge>
                    )}
                  </div>
                ))}
                {analytics.recentActivity.length === 0 && (
                  <div className="p-8 text-center">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No recent activity</p>
                    <p className="text-sm text-muted-foreground">Activity will appear here as fans interact with your content</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}