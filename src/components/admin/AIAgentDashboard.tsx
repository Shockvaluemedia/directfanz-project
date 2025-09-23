'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Shield,
  Bot,
  RefreshCw,
  Settings,
  BarChart3,
  Cpu,
  Database,
  Globe,
  Pause,
  Play,
  RotateCcw,
  AlertTriangle,
  Info,
  Timer,
  Target,
  Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AgentStatus {
  id: string;
  name: string;
  type: 'analytics' | 'revenue' | 'moderation' | 'admin';
  status: 'online' | 'offline' | 'busy' | 'error';
  lastActive: string;
  performance: {
    tasksProcessed: number;
    successRate: number;
    averageResponseTime: number;
    uptime: number;
  };
  currentTasks: number;
  queueLength: number;
  health: 'healthy' | 'warning' | 'critical';
}

interface SystemMetrics {
  totalAgents: number;
  activeAgents: number;
  totalTasksToday: number;
  averageResponseTime: number;
  errorRate: number;
  systemLoad: number;
  memoryUsage: number;
  apiCalls: {
    today: number;
    thisHour: number;
    rateLimit: number;
  };
}

interface RecentInsight {
  id: string;
  agentType: string;
  type: 'recommendation' | 'alert' | 'insight' | 'optimization';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  impact?: string;
  actionable: boolean;
}

export function AIAgentDashboard() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [insights, setInsights] = useState<RecentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      
      // Fetch AI agent status and metrics
      const [agentsResponse, metricsResponse, insightsResponse] = await Promise.all([
        fetch('/api/ai?action=status'),
        fetch('/api/ai?action=metrics'),
        fetch('/api/ai?action=recent-insights&limit=10')
      ]);

      if (agentsResponse.ok) {
        const agentsData = await agentsResponse.json();
        setAgents(agentsData.data?.agents || mockAgents);
      }

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data?.metrics || mockMetrics);
      }

      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json();
        setInsights(insightsData.data?.insights || mockInsights);
      }

    } catch (error) {
      console.error('Failed to fetch AI dashboard data:', error);
      // Use mock data as fallback
      setAgents(mockAgents);
      setMetrics(mockMetrics);
      setInsights(mockInsights);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAgentAction = async (agentId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch('/api/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: `${action}_agent`, agentId })
      });

      if (response.ok) {
        await fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error(`Failed to ${action} agent:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'busy': return 'text-yellow-600 bg-yellow-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'analytics': return <BarChart3 className="w-5 h-5" />;
      case 'revenue': return <DollarSign className="w-5 h-5" />;
      case 'moderation': return <Shield className="w-5 h-5" />;
      case 'admin': return <Settings className="w-5 h-5" />;
      default: return <Bot className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span>Loading AI Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Brain className="w-8 h-8 mr-3 text-blue-600" />
            AI Agent Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Monitor and manage AI agents across your platform</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              autoRefresh 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>{autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}</span>
          </button>
          
          <Button
            onClick={fetchDashboardData}
            disabled={refreshing}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Agents</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metrics.activeAgents}/{metrics.totalAgents}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(metrics.activeAgents / metrics.totalAgents) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasks Today</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalTasksToday.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-green-600 mt-2">+12% from yesterday</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Response Time</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.averageResponseTime}ms</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-purple-600 mt-2">-5% faster today</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.errorRate}%</p>
                </div>
                <div className={`p-3 rounded-lg ${metrics.errorRate < 1 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {metrics.errorRate < 1 ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
              </div>
              <p className={`text-sm mt-2 ${metrics.errorRate < 1 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.errorRate < 1 ? 'Excellent' : 'Needs attention'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              AI Agents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {agents.map((agent) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg bg-gray-100`}>
                      {getAgentIcon(agent.type)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{agent.name}</h4>
                      <p className="text-sm text-gray-500 capitalize">{agent.type} agent</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status}
                    </Badge>
                    <div className={`w-2 h-2 rounded-full ${getHealthColor(agent.health).replace('text-', 'bg-')}`} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Tasks:</span>
                    <div className="font-medium">{agent.performance.tasksProcessed}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Success:</span>
                    <div className="font-medium">{agent.performance.successRate}%</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Response:</span>
                    <div className="font-medium">{agent.performance.averageResponseTime}ms</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Queue:</span>
                    <div className="font-medium">{agent.queueLength}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <span className="text-xs text-gray-500">
                    Last active: {new Date(agent.lastActive).toLocaleTimeString()}
                  </span>
                  
                  <div className="flex items-center space-x-1">
                    {agent.status === 'offline' ? (
                      <button
                        onClick={() => handleAgentAction(agent.id, 'start')}
                        className="p-1 hover:bg-green-100 rounded text-green-600"
                        title="Start agent"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAgentAction(agent.id, 'stop')}
                        className="p-1 hover:bg-red-100 rounded text-red-600"
                        title="Stop agent"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleAgentAction(agent.id, 'restart')}
                      className="p-1 hover:bg-blue-100 rounded text-blue-600"
                      title="Restart agent"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Recent AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lightbulb className="w-5 h-5 mr-2" />
              Recent AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {insights.map((insight) => (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`border-l-4 p-3 rounded-r-lg ${getPriorityColor(insight.priority)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {insight.type === 'alert' && <AlertTriangle className="w-4 h-4 text-orange-600" />}
                      {insight.type === 'recommendation' && <Target className="w-4 h-4 text-blue-600" />}
                      {insight.type === 'insight' && <Info className="w-4 h-4 text-purple-600" />}
                      {insight.type === 'optimization' && <TrendingUp className="w-4 h-4 text-green-600" />}
                      
                      <span className="font-semibold text-sm">{insight.title}</span>
                    </div>
                    
                    <Badge variant="outline" className="text-xs">
                      {insight.agentType}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(insight.timestamp).toLocaleString()}</span>
                    {insight.actionable && (
                      <Badge variant="secondary" className="text-xs">
                        Actionable
                      </Badge>
                    )}
                  </div>
                  
                  {insight.impact && (
                    <div className="mt-2 text-xs font-medium text-green-600">
                      Impact: {insight.impact}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Resources */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Cpu className="w-5 h-5 mr-2" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">System Load</span>
                  <span className="text-sm font-bold">{metrics.systemLoad}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      metrics.systemLoad < 70 ? 'bg-green-500' : 
                      metrics.systemLoad < 90 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${metrics.systemLoad}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Memory Usage</span>
                  <span className="text-sm font-bold">{metrics.memoryUsage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      metrics.memoryUsage < 70 ? 'bg-green-500' : 
                      metrics.memoryUsage < 90 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${metrics.memoryUsage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">API Rate Limit</span>
                  <span className="text-sm font-bold">
                    {metrics.apiCalls.thisHour}/{metrics.apiCalls.rateLimit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(metrics.apiCalls.thisHour / metrics.apiCalls.rateLimit) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Mock data for development/fallback
const mockAgents: AgentStatus[] = [
  {
    id: 'analytics-main',
    name: 'Predictive Analytics Agent',
    type: 'analytics',
    status: 'online',
    lastActive: new Date().toISOString(),
    performance: {
      tasksProcessed: 1247,
      successRate: 94.5,
      averageResponseTime: 1230,
      uptime: 99.2
    },
    currentTasks: 3,
    queueLength: 12,
    health: 'healthy'
  },
  {
    id: 'revenue-optimizer',
    name: 'Revenue Optimization Agent',
    type: 'revenue',
    status: 'busy',
    lastActive: new Date().toISOString(),
    performance: {
      tasksProcessed: 856,
      successRate: 97.8,
      averageResponseTime: 2340,
      uptime: 98.7
    },
    currentTasks: 7,
    queueLength: 4,
    health: 'healthy'
  },
  {
    id: 'moderation-safety',
    name: 'Content Moderation Agent',
    type: 'moderation',
    status: 'online',
    lastActive: new Date().toISOString(),
    performance: {
      tasksProcessed: 3421,
      successRate: 91.2,
      averageResponseTime: 890,
      uptime: 99.8
    },
    currentTasks: 15,
    queueLength: 28,
    health: 'warning'
  },
  {
    id: 'admin-operations',
    name: 'Admin Operations Agent',
    type: 'admin',
    status: 'online',
    lastActive: new Date().toISOString(),
    performance: {
      tasksProcessed: 234,
      successRate: 99.1,
      averageResponseTime: 1890,
      uptime: 100
    },
    currentTasks: 1,
    queueLength: 0,
    health: 'healthy'
  }
];

const mockMetrics: SystemMetrics = {
  totalAgents: 4,
  activeAgents: 4,
  totalTasksToday: 5758,
  averageResponseTime: 1587,
  errorRate: 0.8,
  systemLoad: 67,
  memoryUsage: 58,
  apiCalls: {
    today: 12847,
    thisHour: 234,
    rateLimit: 1000
  }
};

const mockInsights: RecentInsight[] = [
  {
    id: '1',
    agentType: 'Revenue',
    type: 'optimization',
    title: 'Pricing Optimization Opportunity',
    description: 'Tier 2 subscription could be increased by 15% based on demand analysis',
    priority: 'high',
    timestamp: new Date().toISOString(),
    impact: '+$2,400/month',
    actionable: true
  },
  {
    id: '2',
    agentType: 'Analytics',
    type: 'insight',
    title: 'Peak Usage Pattern Detected',
    description: 'User engagement peaks at 8 PM EST - optimal time for content releases',
    priority: 'medium',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    actionable: true
  },
  {
    id: '3',
    agentType: 'Moderation',
    type: 'alert',
    title: 'Content Flagging Increase',
    description: 'Content flagging rate increased 23% this week - reviewing patterns',
    priority: 'medium',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    actionable: true
  }
];