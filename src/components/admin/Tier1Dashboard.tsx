'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

interface DashboardStats {
  onboarding: {
    totalArtists: number;
    completedOnboarding: number;
    avgCompletionTime: number;
    completionRate: number;
  };
  trials: {
    activeTrials: number;
    conversionRate: number;
    totalConverted: number;
    endingSoon: number;
  };
  scheduling: {
    scheduledContent: number;
    publishedToday: number;
    failedPublishes: number;
    avgScheduleTime: number;
  };
  discovery: {
    recommendationViews: number;
    clickThroughRate: number;
    similaritiesCalculated: number;
    lastCalculation: Date | null;
  };
  health: {
    cronJobsRunning: boolean;
    webhookDeliveryRate: number;
    apiResponseTime: number;
    databaseConnected: boolean;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/tier1-stats');
      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data.stats);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function triggerSimilarityCalculation() {
    try {
      const response = await fetch('/api/admin/calculate-similarities', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to trigger calculation');
      alert('Similarity calculation started in background');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Tier 1 Features Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitoring and analytics
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={refreshing}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Health Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          System Health
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthIndicator
            label="Cron Jobs"
            status={stats.health.cronJobsRunning}
          />
          <HealthIndicator
            label="Database"
            status={stats.health.databaseConnected}
          />
          <HealthIndicator
            label="Webhook Delivery"
            status={stats.health.webhookDeliveryRate > 0.95}
            value={`${(stats.health.webhookDeliveryRate * 100).toFixed(1)}%`}
          />
          <HealthIndicator
            label="API Response"
            status={stats.health.apiResponseTime < 500}
            value={`${stats.health.apiResponseTime}ms`}
          />
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Onboarding */}
        <StatCard
          title="Artist Onboarding"
          icon={UserGroupIcon}
          color="blue"
          stats={[
            { label: 'Total Artists', value: stats.onboarding.totalArtists },
            { label: 'Completed', value: stats.onboarding.completedOnboarding },
            {
              label: 'Completion Rate',
              value: `${stats.onboarding.completionRate.toFixed(1)}%`,
              highlighted: stats.onboarding.completionRate >= 75
            },
            {
              label: 'Avg Time',
              value: `${stats.onboarding.avgCompletionTime.toFixed(1)}h`
            },
          ]}
        />

        {/* Trials */}
        <StatCard
          title="Free Trials"
          icon={SparklesIcon}
          color="purple"
          stats={[
            { label: 'Active Trials', value: stats.trials.activeTrials },
            { label: 'Converted', value: stats.trials.totalConverted },
            {
              label: 'Conversion Rate',
              value: `${stats.trials.conversionRate.toFixed(1)}%`,
              highlighted: stats.trials.conversionRate >= 40
            },
            {
              label: 'Ending Soon',
              value: stats.trials.endingSoon,
              highlighted: stats.trials.endingSoon > 0
            },
          ]}
        />

        {/* Scheduling */}
        <StatCard
          title="Content Scheduling"
          icon={CalendarIcon}
          color="green"
          stats={[
            { label: 'Scheduled', value: stats.scheduling.scheduledContent },
            { label: 'Published Today', value: stats.scheduling.publishedToday },
            {
              label: 'Failed Publishes',
              value: stats.scheduling.failedPublishes,
              highlighted: stats.scheduling.failedPublishes > 0,
              negative: true
            },
            {
              label: 'Avg Schedule Time',
              value: `${stats.scheduling.avgScheduleTime.toFixed(1)}h`
            },
          ]}
        />

        {/* Discovery */}
        <StatCard
          title="Discovery Feed"
          icon={ArrowTrendingUpIcon}
          color="orange"
          stats={[
            { label: 'Views Today', value: stats.discovery.recommendationViews },
            {
              label: 'Click Rate',
              value: `${stats.discovery.clickThroughRate.toFixed(1)}%`
            },
            {
              label: 'Similarities',
              value: stats.discovery.similaritiesCalculated
            },
            {
              label: 'Last Calc',
              value: stats.discovery.lastCalculation
                ? new Date(stats.discovery.lastCalculation).toLocaleDateString()
                : 'Never'
            },
          ]}
        />
      </div>

      {/* Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Admin Actions
        </h2>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={triggerSimilarityCalculation}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Trigger Similarity Calculation
          </button>

          <button
            onClick={() => window.location.href = '/api/admin/export-stats?format=csv'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Export Stats (CSV)
          </button>

          <button
            onClick={() => window.location.href = '/admin/logs'}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            View Logs
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(stats.scheduling.failedPublishes > 0 || stats.trials.endingSoon > 5) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
              Alerts
            </h3>
          </div>

          <ul className="space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
            {stats.scheduling.failedPublishes > 0 && (
              <li>• {stats.scheduling.failedPublishes} scheduled publishes failed</li>
            )}
            {stats.trials.endingSoon > 5 && (
              <li>• {stats.trials.endingSoon} trials ending in next 3 days</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

interface HealthIndicatorProps {
  label: string;
  status: boolean;
  value?: string;
}

function HealthIndicator({ label, status, value }: HealthIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {status ? (
        <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : (
        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {label}
        </div>
        {value && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {value}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  icon: any;
  color: 'blue' | 'purple' | 'green' | 'orange';
  stats: Array<{
    label: string;
    value: string | number;
    highlighted?: boolean;
    negative?: boolean;
  }>;
}

function StatCard({ title, icon: Icon, color, stats }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>

      <div className="space-y-3">
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {stat.label}
            </span>
            <span
              className={`font-semibold ${
                stat.highlighted
                  ? stat.negative
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
