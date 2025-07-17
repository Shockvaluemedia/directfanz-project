import React from 'react';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * Admin monitoring dashboard for production health and performance metrics
 */
export default async function MonitoringDashboard() {
  // Check if user is authenticated and has admin role
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    redirect('/auth/signin');
  }

  // Fetch system metrics
  const metrics = await getSystemMetrics();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">System Monitoring Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title="System Status" 
          value={metrics.status} 
          status={metrics.status === 'Healthy' ? 'success' : 'error'} 
        />
        <MetricCard 
          title="Active Users (24h)" 
          value={metrics.activeUsers.toString()} 
          status="info" 
        />
        <MetricCard 
          title="API Response Time" 
          value={`${metrics.apiResponseTime.toFixed(2)}ms`} 
          status={metrics.apiResponseTime < 300 ? 'success' : 'warning'} 
        />
        <MetricCard 
          title="Error Rate (24h)" 
          value={`${metrics.errorRate.toFixed(2)}%`} 
          status={metrics.errorRate < 1 ? 'success' : metrics.errorRate < 5 ? 'warning' : 'error'} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Database Health</h2>
          <div className="space-y-4">
            <MetricRow label="Connection Status" value={metrics.database.status} />
            <MetricRow label="Connection Latency" value={`${metrics.database.latency.toFixed(2)}ms`} />
            <MetricRow label="Active Connections" value={metrics.database.connections.toString()} />
            <MetricRow label="Query Performance" value={`${metrics.database.queryPerformance.toFixed(2)}ms avg`} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Redis Cache</h2>
          <div className="space-y-4">
            <MetricRow label="Connection Status" value={metrics.redis.status} />
            <MetricRow label="Memory Usage" value={metrics.redis.memoryUsage} />
            <MetricRow label="Hit Rate" value={`${metrics.redis.hitRate.toFixed(2)}%`} />
            <MetricRow label="Cache Size" value={metrics.redis.cacheSize} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">API Endpoint Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Endpoint</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Response Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cache Hit Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {metrics.endpoints.map((endpoint) => (
                  <tr key={endpoint.path}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{endpoint.path}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{endpoint.responseTime.toFixed(2)}ms</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{endpoint.cacheHitRate.toFixed(2)}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        endpoint.status === 'Healthy' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                          : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      }`}>
                        {endpoint.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Errors</h2>
          {metrics.recentErrors.length > 0 ? (
            <ul className="space-y-3">
              {metrics.recentErrors.map((error, index) => (
                <li key={index} className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">{error.message}</p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error.timestamp} • {error.path}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No recent errors</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">System Events</h2>
          {metrics.systemEvents.length > 0 ? (
            <ul className="space-y-3">
              {metrics.systemEvents.map((event, index) => (
                <li key={index} className="border-l-4 pl-3 py-1" style={{ borderColor: getEventColor(event.type) }}>
                  <p className="text-sm font-medium">{event.message}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{event.timestamp}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No system events</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for metric cards
function MetricCard({ title, value, status }: { title: string; value: string; status: 'success' | 'warning' | 'error' | 'info' }) {
  const getStatusColor = () => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-300';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-300';
      case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-300';
    }
  };

  return (
    <div className={`rounded-lg shadow p-6 ${getStatusColor()}`}>
      <h3 className="text-sm font-medium opacity-80">{title}</h3>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

// Helper component for metric rows
function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// Helper function to get event color
function getEventColor(type: string) {
  switch (type) {
    case 'info': return '#3b82f6';
    case 'warning': return '#f59e0b';
    case 'error': return '#ef4444';
    case 'success': return '#10b981';
    default: return '#6b7280';
  }
}

// Function to fetch system metrics
async function getSystemMetrics() {
  try {
    // In a real implementation, these would be fetched from actual monitoring systems
    // For now, we'll return mock data
    
    // Check database connection
    let databaseStatus = 'Connected';
    let databaseLatency = 15;
    try {
      const dbStartTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      databaseLatency = Date.now() - dbStartTime;
    } catch (error) {
      logger.error('Monitoring dashboard: Database connection failed', {}, error as Error);
      databaseStatus = 'Disconnected';
      databaseLatency = 0;
    }
    
    // Check Redis connection
    let redisStatus = 'Connected';
    let redisMemoryUsage = '0 MB';
    try {
      await redis.ping();
      const info = await redis.info();
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      redisMemoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';
    } catch (error) {
      logger.error('Monitoring dashboard: Redis connection failed', {}, error as Error);
      redisStatus = 'Disconnected';
    }
    
    // Get active users in the last 24 hours
    let activeUsers = 0;
    try {
      activeUsers = await prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });
    } catch (error) {
      logger.error('Monitoring dashboard: Failed to get active users', {}, error as Error);
    }
    
    return {
      status: databaseStatus === 'Connected' && redisStatus === 'Connected' ? 'Healthy' : 'Unhealthy',
      activeUsers,
      apiResponseTime: 120.5,
      errorRate: 0.42,
      database: {
        status: databaseStatus,
        latency: databaseLatency,
        connections: 5,
        queryPerformance: 45.2
      },
      redis: {
        status: redisStatus,
        memoryUsage: redisMemoryUsage,
        hitRate: 87.3,
        cacheSize: '24 MB'
      },
      endpoints: [
        { path: '/api/artist/analytics', responseTime: 145.2, cacheHitRate: 92.5, status: 'Healthy' },
        { path: '/api/fan/artists', responseTime: 78.4, cacheHitRate: 95.1, status: 'Healthy' },
        { path: '/api/fan/content/1', responseTime: 210.7, cacheHitRate: 82.3, status: 'Healthy' },
        { path: '/api/artist/tiers', responseTime: 65.1, cacheHitRate: 89.7, status: 'Healthy' },
        { path: '/api/health', responseTime: 12.3, cacheHitRate: 0, status: 'Healthy' },
        { path: '/api/billing/invoices', responseTime: 187.9, cacheHitRate: 76.4, status: 'Healthy' }
      ],
      recentErrors: [
        { message: 'Failed to process payment for subscription', timestamp: '2025-07-16 14:32:45', path: '/api/payments/webhooks' },
        { message: 'S3 upload timeout', timestamp: '2025-07-16 12:18:22', path: '/api/artist/content/upload' }
      ],
      systemEvents: [
        { type: 'info', message: 'System backup completed successfully', timestamp: '2025-07-16 03:00:00' },
        { type: 'warning', message: 'High CPU usage detected', timestamp: '2025-07-16 10:45:12' },
        { type: 'success', message: 'Database migration completed', timestamp: '2025-07-16 02:15:30' },
        { type: 'info', message: 'Cache purged automatically', timestamp: '2025-07-16 06:00:00' }
      ]
    };
  } catch (error) {
    logger.error('Failed to fetch system metrics', {}, error as Error);
    
    // Return fallback metrics
    return {
      status: 'Unknown',
      activeUsers: 0,
      apiResponseTime: 0,
      errorRate: 0,
      database: {
        status: 'Unknown',
        latency: 0,
        connections: 0,
        queryPerformance: 0
      },
      redis: {
        status: 'Unknown',
        memoryUsage: 'Unknown',
        hitRate: 0,
        cacheSize: 'Unknown'
      },
      endpoints: [],
      recentErrors: [],
      systemEvents: [
        { type: 'error', message: 'Failed to fetch system metrics', timestamp: new Date().toISOString() }
      ]
    };
  }
}