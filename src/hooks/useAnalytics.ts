import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface AnalyticsData {
  revenue: {
    current: number;
    previous: number;
    change: number;
    currency: string;
  };
  subscribers: {
    current: number;
    previous: number;
    change: number;
    growth: number;
  };
  content: {
    totalViews: number;
    totalLikes: number;
    totalContent: number;
    avgEngagement: number;
  };
  demographics: {
    locations: Array<{ country: string; percentage: number; count: number }>;
    devices: Array<{ type: string; percentage: number; count: number }>;
    ageGroups: Array<{ range: string; percentage: number; count: number }>;
  };
  timeSeriesData: Array<{
    date: string;
    revenue: number;
    subscribers: number;
    views: number;
    engagement: number;
  }>;
  topContent: Array<{
    id: string;
    title: string;
    type: string;
    views: number;
    likes: number;
    revenue: number;
  }>;
}

interface UseAnalyticsOptions {
  timeRange?: '7d' | '30d' | '90d' | '1y';
  userId?: string;
  enabled?: boolean;
  refetchInterval?: number;
}

interface UseAnalyticsReturn {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const CACHE_KEY_PREFIX = 'analytics-';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: AnalyticsData;
  timestamp: number;
  timeRange: string;
  userId?: string;
}

// Simple in-memory cache
const cache = new Map<string, CacheEntry>();

function getCacheKey(timeRange: string, userId?: string): string {
  return `${CACHE_KEY_PREFIX}${timeRange}-${userId || 'current'}`;
}

function getCachedData(timeRange: string, userId?: string): AnalyticsData | null {
  const key = getCacheKey(timeRange, userId);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCachedData(data: AnalyticsData, timeRange: string, userId?: string): void {
  const key = getCacheKey(timeRange, userId);
  cache.set(key, {
    data,
    timestamp: Date.now(),
    timeRange,
    userId,
  });
}

export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsReturn {
  const { data: session } = useSession();
  const { timeRange = '30d', userId, enabled = true, refetchInterval } = options;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (ignoreCache = false) => {
    if (!enabled || !session?.user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check cache first (unless ignoring cache)
      if (!ignoreCache) {
        const cachedData = getCachedData(timeRange, userId);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }
      }

      // Build query parameters
      const params = new URLSearchParams({
        timeRange,
      });

      if (userId) {
        params.append('userId', userId);
      }

      const response = await fetch(`/api/analytics?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics data');
      }

      const analyticsData = result.data;

      // Cache the data
      setCachedData(analyticsData, timeRange, userId);

      setData(analyticsData);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Analytics fetch error:', err);

      // Try to use cached data as fallback
      const cachedData = getCachedData(timeRange, userId);
      if (cachedData) {
        setData(cachedData);
        setError(`Using cached data: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchAnalytics(true); // Ignore cache when manually refetching
  };

  // Initial fetch and when dependencies change
  useEffect(() => {
    fetchAnalytics();
  }, [enabled, session, timeRange, userId]);

  // Set up auto-refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchAnalytics();
    }, refetchInterval);

    return () => clearInterval(intervalId);
  }, [refetchInterval, enabled, timeRange, userId]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}

// Export cache utilities for advanced usage
export const analyticsCache = {
  clear: () => cache.clear(),
  delete: (timeRange: string, userId?: string) => {
    const key = getCacheKey(timeRange, userId);
    cache.delete(key);
  },
  has: (timeRange: string, userId?: string) => {
    const key = getCacheKey(timeRange, userId);
    return cache.has(key);
  },
  size: () => cache.size,
};
