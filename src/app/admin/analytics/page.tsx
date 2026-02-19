'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface AnalyticsData {
  totalUsers: number;
  totalRevenue: number;
  activeSubscriptions: number;
  recentSignups: RecentSignup[];
  userGrowth?: number;
  revenueGrowth?: number;
  subscriptionGrowth?: number;
}

interface RecentSignup {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const defaultAnalytics: AnalyticsData = {
  totalUsers: 0,
  totalRevenue: 0,
  activeSubscriptions: 0,
  recentSignups: [],
};

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAdmin =
    session?.user?.role === 'ADMIN' ||
    session?.user?.email === 'admin@directfan.com';

  const [analytics, setAnalytics] = useState<AnalyticsData>(defaultAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) {
        throw new Error(`Failed to fetch analytics: ${res.statusText}`);
      }
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
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
    fetchAnalytics();
  }, [session, status, isAdmin, router, fetchAnalytics]);

  if (status === 'loading' || (loading && !error)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
            <p className="mt-2 text-gray-600">
              Overview of platform performance and growth
            </p>
          </div>
          <button
            onClick={fetchAnalytics}
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
              onClick={fetchAnalytics}
              className="text-red-600 hover:text-red-800 font-medium underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Users"
            value={analytics.totalUsers.toLocaleString()}
            growth={analytics.userGrowth}
            color="blue"
          />
          <StatCard
            title="Total Revenue"
            value={`$${analytics.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            growth={analytics.revenueGrowth}
            color="green"
          />
          <StatCard
            title="Active Subscriptions"
            value={analytics.activeSubscriptions.toLocaleString()}
            growth={analytics.subscriptionGrowth}
            color="purple"
          />
          <StatCard
            title="Recent Signups"
            value={analytics.recentSignups.length.toString()}
            subtitle="Last 7 days"
            color="orange"
          />
        </div>

        {/* Recent Signups Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Signups</h2>
          </div>

          {analytics.recentSignups.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent signups to display.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.recentSignups.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  growth,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  growth?: number;
  subtitle?: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  const accentMap = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorMap[color]}`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${accentMap[color]}`}>{value}</p>
      {typeof growth === 'number' && (
        <p
          className={`text-sm mt-1 ${
            growth >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {growth >= 0 ? '+' : ''}
          {growth.toFixed(1)}% from last month
        </p>
      )}
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-700',
    ARTIST: 'bg-purple-100 text-purple-700',
    FAN: 'bg-blue-100 text-blue-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[role.toUpperCase()] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {role}
    </span>
  );
}
