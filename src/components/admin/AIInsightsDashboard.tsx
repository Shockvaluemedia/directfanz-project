import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain,
  TrendingUp,
  Shield,
  DollarSign,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCcw,
  BarChart3,
  Zap
} from 'lucide-react';

interface AIAgent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'processing' | 'idle' | 'error';
  lastActivity: string;
  tasksProcessed: number;
  successRate: number;
  avgProcessingTime: number;
}

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  contentModerated: number;
  revenueOptimized: number;
  systemHealth: number;
  uptime: string;
}

interface RevenueInsights {
  currentRevenue: number;
  projectedRevenue: number;
  optimizationOpportunities: number;
  activeTests: number;
  averageIncrease: number;
}

interface ContentModerationStats {
  totalContent: number;
  pendingReview: number;
  autoApproved: number;
  flagged: number;
  accuracy: number;
}

const AIInsightsDashboard: React.FC = () => {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [revenueInsights, setRevenueInsights] = useState<RevenueInsights | null>(null);
  const [moderationStats, setModerationStats] = useState<ContentModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAIInsights = async () => {
    try {
      setRefreshing(true);
      
      // Fetch AI agents status
      const agentsResponse = await fetch('/api/ai/admin-operations');
      const agentsData = await agentsResponse.json();
      
      if (agentsData.agents) {
        setAgents(agentsData.agents);
      }

      // Fetch system metrics
      if (agentsData.systemHealth) {
        setSystemMetrics(agentsData.systemHealth);
      }

      // Fetch revenue insights
      const revenueResponse = await fetch('/api/ai/revenue-optimization');
      const revenueData = await revenueResponse.json();
      setRevenueInsights(revenueData);

      // Fetch moderation stats
      const moderationResponse = await fetch('/api/ai/moderation');
      const moderationData = await moderationResponse.json();
      setModerationStats(moderationData.statistics);

    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAIInsights();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchAIInsights, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing': return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'idle': return <Clock className="h-4 w-4 text-gray-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'idle': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <RefreshCcw className="h-5 w-5 animate-spin" />
          <span>Loading AI Insights...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">AI Operations Dashboard</h2>
          <p className="text-gray-600">Monitor and manage AI agents across the platform</p>
        </div>
        <Button 
          onClick={fetchAIInsights} 
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Overview Cards */}
      {systemMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold">{systemMetrics.activeUsers.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">
                    of {systemMetrics.totalUsers.toLocaleString()} total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Content Moderated</p>
                  <p className="text-2xl font-bold">{systemMetrics.contentModerated.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">items processed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-gray-600">Revenue Optimized</p>
                  <p className="text-2xl font-bold">${systemMetrics.revenueOptimized.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">this month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">System Health</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={systemMetrics.systemHealth} className="flex-1" />
                    <span className="text-sm font-medium">{systemMetrics.systemHealth}%</span>
                  </div>
                  <p className="text-xs text-gray-500">Uptime: {systemMetrics.uptime}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Agents Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Agents Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(agent.status)}
                    <div>
                      <h4 className="font-medium">{agent.name}</h4>
                      <p className="text-sm text-gray-600">{agent.type}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Tasks Processed</p>
                    <p className="font-medium">{agent.tasksProcessed.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Success Rate</p>
                    <p className="font-medium">{agent.successRate}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Avg Time</p>
                    <p className="font-medium">{agent.avgProcessingTime}ms</p>
                  </div>
                  <Badge className={`${getStatusColor(agent.status)} text-white`}>
                    {agent.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue Analytics
          </TabsTrigger>
          <TabsTrigger value="moderation" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Content Moderation
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          {revenueInsights && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <h3 className="font-medium">Revenue Growth</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Current</span>
                      <span className="font-medium">${revenueInsights.currentRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Projected</span>
                      <span className="font-medium">${revenueInsights.projectedRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Increase</span>
                      <span className="font-medium text-green-600">+{revenueInsights.averageIncrease}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-blue-500" />
                    <h3 className="font-medium">Optimization Status</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Opportunities</span>
                      <span className="font-medium">{revenueInsights.optimizationOpportunities}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Active Tests</span>
                      <span className="font-medium">{revenueInsights.activeTests}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <Alert>
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription>
                      AI-powered optimizations have increased average revenue by {revenueInsights.averageIncrease}% 
                      across active tests.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="moderation" className="space-y-4">
          {moderationStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Total Content</p>
                      <p className="text-2xl font-bold">{moderationStats.totalContent.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm text-gray-600">Pending Review</p>
                      <p className="text-2xl font-bold">{moderationStats.pendingReview.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Auto Approved</p>
                      <p className="text-2xl font-bold">{moderationStats.autoApproved.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm text-gray-600">Flagged</p>
                      <p className="text-2xl font-bold">{moderationStats.flagged.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Agent Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-sm text-gray-600">{agent.successRate}% success rate</span>
                    </div>
                    <Progress value={agent.successRate} />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{agent.tasksProcessed} tasks processed</span>
                      <span>Avg: {agent.avgProcessingTime}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIInsightsDashboard;