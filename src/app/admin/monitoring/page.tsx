'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface SystemMetrics {
  status: string;
  activeUsers: number;
  apiLatency: number;
  errorRate: number;
  uptime: string;
  database: {
    status: string;
    latency: number;
    connections: number;
  };
  redis: {
    status: string;
    memoryUsage: string;
    hitRate: number;
  };
  endpoints: EndpointMetric[];
  recentErrors: ErrorEntry[];
}

interface EndpointMetric {
  path: string;
  responseTime: number;
  requestCount: number;
  errorCount: number;
  status: string;
}

interface ErrorEntry {
  message: string;
  timestamp: string;
  path: string;
  count: number;
}

const defaultMetrics: SystemMetrics = {
  status: 'Unknown',
  activeUsers: 0,
  apiLatency: 0,
  errorRate: 0,
  uptime: '--',
  database: { status: 'Unknown', latency: 0, connections: 0 },
  redis: { status: 'Unknown', memoryUsage: '0 MB', hitRate: 0 },
  endpoints: [],
  recentErrors: [],
};

export default function MonitoringDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAdmin =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'admin' ||
    session?.user?.email === 'admin@directfan.com';

  const [metrics, setMetrics] = useState<SystemMetrics>(defaultMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/monitoring');
      if (!res.ok) {
        throw new Error(`Failed to fetch metrics: ${res.statusText}`);
      }
      const data = await res.json();
      setMetrics(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }
    fetchMetrics();
  }, [session, status, isAdmin, router, fetchMetrics]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, fetchMetrics]);

  const getHealthColor = (s: string): string => {
    const normalized = s.toLowerCase();
    if (normalized === 'healthy' || normalized === 'connected') return 'text-green-600';
    if (normalized === 'degraded' || normalized === 'warning') return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBg = (s: string): string => {
    const normalized = s.toLowerCase();
    if (normalized === 'healthy' || normalized === 'connected')
      return 'bg-green-100 text-green-800';
    if (normalized === 'degraded' || normalized === 'warning')
      return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (status === 'loading' || (loading && !error && metrics.status === 'Unknown')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading system metrics...</p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
            <p className="mt-2 text-gray-600">
              Real-time system health and performance metrics
              {lastRefreshed && (
                <span className="ml-2 text-xs text-gray-400">
                  Last updated: {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchMetrics}
              className="text-red-600 hover:text-red-800 font-medium underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top-level metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`rounded-lg border p-6 ${metrics.status.toLowerCase() === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-sm font-medium text-gray-600">System Status</p>
            <p className={`text-2xl font-bold mt-2 ${getHealthColor(metrics.status)}`}>
              {metrics.status}
            </p>
            {metrics.uptime && (
              <p className="text-xs text-gray-500 mt-1">Uptime: {metrics.uptime}</p>
            )}
          </div>

          <div className="rounded-lg border p-6 bg-blue-50 border-blue-200">
            <p className="text-sm font-medium text-gray-600">Active Users (24h)</p>
            <p className="text-2xl font-bold mt-2 text-blue-600">
              {metrics.activeUsers.toLocaleString()}
            </p>
          </div>

          <div className={`rounded-lg border p-6 ${metrics.apiLatency < 300 ? 'bg-green-50 border-green-200' : metrics.apiLatency < 500 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-sm font-medium text-gray-600">API Latency (avg)</p>
            <p className={`text-2xl font-bold mt-2 ${metrics.apiLatency < 300 ? 'text-green-600' : metrics.apiLatency < 500 ? 'text-yellow-600' : 'text-red-600'}`}>
              {metrics.apiLatency.toFixed(0)}ms
            </p>
          </div>

          <div className={`rounded-lg border p-6 ${metrics.errorRate < 1 ? 'bg-green-50 border-green-200' : metrics.errorRate < 5 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-sm font-medium text-gray-600">Error Rate (24h)</p>
            <p className={`text-2xl font-bold mt-2 ${metrics.errorRate < 1 ? 'text-green-600' : metrics.errorRate < 5 ? 'text-yellow-600' : 'text-red-600'}`}>
              {metrics.errorRate.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Database & Redis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Database Health</h2>
            <div className="space-y-3">
              <MetricRow
                label="Connection Status"
                value={metrics.database.status}
                valueClass={getHealthBg(metrics.database.status)}
                isBadge
              />
              <MetricRow
                label="Connection Latency"
                value={`${metrics.database.latency.toFixed(1)}ms`}
              />
              <MetricRow
                label="Active Connections"
                value={metrics.database.connections.toString()}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Redis Cache</h2>
            <div className="space-y-3">
              <MetricRow
                label="Connection Status"
                value={metrics.redis.status}
                valueClass={getHealthBg(metrics.redis.status)}
                isBadge
              />
              <MetricRow label="Memory Usage" value={metrics.redis.memoryUsage} />
              <MetricRow
                label="Hit Rate"
                value={`${metrics.redis.hitRate.toFixed(1)}%`}
              />
            </div>
          </div>
        </div>

        {/* API Endpoint Performance */}
        {metrics.endpoints.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                API Endpoint Performance
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Response Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Errors
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {metrics.endpoints.map((ep) => (
                    <tr key={ep.path} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {ep.path}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {ep.responseTime.toFixed(1)}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {ep.requestCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {ep.errorCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getHealthBg(ep.status)}`}
                        >
                          {ep.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Errors */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Errors</h2>
          </div>
          {metrics.recentErrors.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent errors. All systems operating normally.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {metrics.recentErrors.map((err, i) => (
                <li key={i} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-700">{err.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {err.path} -- {err.timestamp}
                      </p>
                    </div>
                    {err.count > 1 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        x{err.count}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  valueClass,
  isBadge,
}: {
  label: string;
  value: string;
  valueClass?: string;
  isBadge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      {isBadge ? (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${valueClass}`}
        >
          {value}
        </span>
      ) : (
        <span className={`text-sm font-medium text-gray-900 ${valueClass ?? ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}
