/**
 * Subscription Query Performance Monitor
 *
 * This module provides comprehensive performance tracking for subscription-related
 * database operations, identifying slow queries and bottlenecks in real-time.
 */

import { logger } from './logger';
import { prisma } from './prisma';

interface QueryMetric {
  queryId: string;
  queryType: 'subscription' | 'analytics' | 'aggregation' | 'lookup';
  operation: string;
  duration: number;
  timestamp: Date;
  parameters?: Record<string, any>;
  cacheHit?: boolean;
  resultCount?: number;
  errorMessage?: string;
}

interface PerformanceAlert {
  type: 'slow_query' | 'high_error_rate' | 'cache_miss_spike' | 'resource_exhaustion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  queryId?: string;
  metric: number;
  threshold: number;
  timestamp: Date;
}

interface PerformanceStats {
  totalQueries: number;
  averageDuration: number;
  slowQueries: number;
  errorRate: number;
  cacheHitRate: number;
  bottlenecks: Array<{
    operation: string;
    avgDuration: number;
    queryCount: number;
  }>;
}

class SubscriptionPerformanceMonitor {
  private metrics: QueryMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private readonly maxMetricsHistory = 10000; // Keep last 10k queries
  private readonly slowQueryThreshold = 1000; // 1 second
  private readonly errorRateThreshold = 0.05; // 5%
  private readonly cacheHitRateThreshold = 0.8; // 80%

  /**
   * Track a subscription-related query performance
   */
  async trackQuery<T>(
    queryId: string,
    queryType: QueryMetric['queryType'],
    operation: string,
    queryFn: () => Promise<T>,
    parameters?: Record<string, any>,
    cacheHit: boolean = false
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let error: Error | null = null;
    let resultCount = 0;

    try {
      result = await queryFn();

      // Try to determine result count
      if (Array.isArray(result)) {
        resultCount = result.length;
      } else if (result && typeof result === 'object') {
        resultCount = 1;
      }

      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const duration = Date.now() - startTime;

      const metric: QueryMetric = {
        queryId,
        queryType,
        operation,
        duration,
        timestamp: new Date(),
        parameters: this.sanitizeParameters(parameters),
        cacheHit,
        resultCount,
        errorMessage: error?.message,
      };

      this.addMetric(metric);
      this.checkForAlerts(metric);

      // Log slow queries immediately
      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow subscription query detected', {
          queryId,
          operation,
          duration,
          parameters: this.sanitizeParameters(parameters),
          cacheHit,
        });
      }
    }
  }

  /**
   * Add a metric and maintain history limit
   */
  private addMetric(metric: QueryMetric): void {
    this.metrics.push(metric);

    // Trim old metrics to maintain memory limits
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Check for performance alerts based on new metric
   */
  private checkForAlerts(metric: QueryMetric): void {
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000); // Last 5 minutes

    // Slow query alert
    if (metric.duration > this.slowQueryThreshold) {
      this.addAlert({
        type: 'slow_query',
        severity: metric.duration > 5000 ? 'high' : 'medium',
        message: `Slow query detected: ${metric.operation} took ${metric.duration}ms`,
        queryId: metric.queryId,
        metric: metric.duration,
        threshold: this.slowQueryThreshold,
        timestamp: new Date(),
      });
    }

    // Error rate alert (check last 100 queries)
    if (recentMetrics.length >= 10) {
      const errorRate = recentMetrics.filter(m => m.errorMessage).length / recentMetrics.length;
      if (errorRate > this.errorRateThreshold) {
        this.addAlert({
          type: 'high_error_rate',
          severity: errorRate > 0.2 ? 'critical' : 'high',
          message: `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
          metric: errorRate,
          threshold: this.errorRateThreshold,
          timestamp: new Date(),
        });
      }
    }

    // Cache miss spike alert
    const cacheMetrics = recentMetrics.filter(m => m.cacheHit !== undefined);
    if (cacheMetrics.length >= 20) {
      const cacheHitRate = cacheMetrics.filter(m => m.cacheHit).length / cacheMetrics.length;
      if (cacheHitRate < this.cacheHitRateThreshold) {
        this.addAlert({
          type: 'cache_miss_spike',
          severity: cacheHitRate < 0.5 ? 'high' : 'medium',
          message: `Low cache hit rate detected: ${(cacheHitRate * 100).toFixed(1)}%`,
          metric: cacheHitRate,
          threshold: this.cacheHitRateThreshold,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Add an alert and maintain reasonable history
   */
  private addAlert(alert: PerformanceAlert): void {
    // Avoid duplicate alerts within 5 minutes
    const recentSimilarAlert = this.alerts.find(
      a =>
        a.type === alert.type &&
        a.queryId === alert.queryId &&
        Date.now() - a.timestamp.getTime() < 5 * 60 * 1000
    );

    if (!recentSimilarAlert) {
      this.alerts.push(alert);
      logger.error('Performance alert triggered', alert);

      // Keep only last 1000 alerts
      if (this.alerts.length > 1000) {
        this.alerts = this.alerts.slice(-1000);
      }
    }
  }

  /**
   * Get metrics from the last X milliseconds
   */
  private getRecentMetrics(timeMs: number): QueryMetric[] {
    const cutoff = Date.now() - timeMs;
    return this.metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  private sanitizeParameters(parameters?: Record<string, any>): Record<string, any> | undefined {
    if (!parameters) return undefined;

    const sanitized = { ...parameters };

    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    // Truncate long strings to prevent log spam
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 97) + '...';
      }
    }

    return sanitized;
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats(timeRangeMs: number = 60 * 60 * 1000): PerformanceStats {
    const recentMetrics = this.getRecentMetrics(timeRangeMs);

    if (recentMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        slowQueries: 0,
        errorRate: 0,
        cacheHitRate: 0,
        bottlenecks: [],
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const errorCount = recentMetrics.filter(m => m.errorMessage).length;
    const slowQueryCount = recentMetrics.filter(m => m.duration > this.slowQueryThreshold).length;

    const cacheMetrics = recentMetrics.filter(m => m.cacheHit !== undefined);
    const cacheHits = cacheMetrics.filter(m => m.cacheHit).length;

    // Identify bottlenecks - operations with high average duration
    const operationStats = recentMetrics.reduce(
      (stats, metric) => {
        if (!stats[metric.operation]) {
          stats[metric.operation] = { totalDuration: 0, count: 0 };
        }
        stats[metric.operation].totalDuration += metric.duration;
        stats[metric.operation].count += 1;
        return stats;
      },
      {} as Record<string, { totalDuration: number; count: number }>
    );

    const bottlenecks = Object.entries(operationStats)
      .map(([operation, stats]) => ({
        operation,
        avgDuration: stats.totalDuration / stats.count,
        queryCount: stats.count,
      }))
      .filter(b => b.avgDuration > this.slowQueryThreshold / 2) // Half the slow query threshold
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10); // Top 10 bottlenecks

    return {
      totalQueries: recentMetrics.length,
      averageDuration: totalDuration / recentMetrics.length,
      slowQueries: slowQueryCount,
      errorRate: errorCount / recentMetrics.length,
      cacheHitRate: cacheMetrics.length > 0 ? cacheHits / cacheMetrics.length : 0,
      bottlenecks,
    };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(timeRangeMs: number = 24 * 60 * 60 * 1000): PerformanceAlert[] {
    const cutoff = Date.now() - timeRangeMs;
    return this.alerts.filter(a => a.timestamp.getTime() > cutoff);
  }

  /**
   * Get detailed query analysis for a specific operation
   */
  getQueryAnalysis(
    operation: string,
    timeRangeMs: number = 60 * 60 * 1000
  ): {
    operation: string;
    totalQueries: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    errorRate: number;
    cacheHitRate: number;
    recentQueries: QueryMetric[];
  } {
    const metrics = this.getRecentMetrics(timeRangeMs)
      .filter(m => m.operation === operation)
      .sort((a, b) => a.duration - b.duration);

    if (metrics.length === 0) {
      return {
        operation,
        totalQueries: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        errorRate: 0,
        cacheHitRate: 0,
        recentQueries: [],
      };
    }

    const durations = metrics.map(m => m.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const errorCount = metrics.filter(m => m.errorMessage).length;
    const p95Index = Math.floor(durations.length * 0.95);

    const cacheMetrics = metrics.filter(m => m.cacheHit !== undefined);
    const cacheHits = cacheMetrics.filter(m => m.cacheHit).length;

    return {
      operation,
      totalQueries: metrics.length,
      averageDuration: totalDuration / metrics.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[p95Index] || 0,
      errorRate: errorCount / metrics.length,
      cacheHitRate: cacheMetrics.length > 0 ? cacheHits / cacheMetrics.length : 0,
      recentQueries: metrics.slice(-10), // Last 10 queries
    };
  }

  /**
   * Clear old metrics and alerts
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;

    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);

    logger.info('Performance monitor cleanup completed', {
      metricsRetained: this.metrics.length,
      alertsRetained: this.alerts.length,
    });
  }

  /**
   * Export performance data for external analysis
   */
  exportData(timeRangeMs: number = 24 * 60 * 60 * 1000): {
    metrics: QueryMetric[];
    alerts: PerformanceAlert[];
    summary: PerformanceStats;
    exportedAt: Date;
  } {
    return {
      metrics: this.getRecentMetrics(timeRangeMs),
      alerts: this.getRecentAlerts(timeRangeMs),
      summary: this.getPerformanceStats(timeRangeMs),
      exportedAt: new Date(),
    };
  }
}

// Singleton instance
export const subscriptionPerformanceMonitor = new SubscriptionPerformanceMonitor();

/**
 * Decorator for automatic performance tracking
 */
export function trackPerformance(
  queryId: string,
  queryType: QueryMetric['queryType'],
  operation: string
) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (...args: T): Promise<R> {
      return subscriptionPerformanceMonitor.trackQuery(
        queryId,
        queryType,
        operation,
        () => method.apply(this, args),
        { args: args.length } // Basic parameter info
      );
    };
  };
}

/**
 * Utility function for tracking ad-hoc queries
 */
export async function trackSubscriptionQuery<T>(
  operation: string,
  queryFn: () => Promise<T>,
  parameters?: Record<string, any>,
  cacheHit?: boolean
): Promise<T> {
  const queryId = `adhoc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return subscriptionPerformanceMonitor.trackQuery(
    queryId,
    'subscription',
    operation,
    queryFn,
    parameters,
    cacheHit
  );
}

/**
 * Performance monitoring middleware for Prisma queries
 */
export function createPerformanceMiddleware() {
  return async function (params: any, next: any) {
    const startTime = Date.now();
    const queryId = `prisma_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const result = await next(params);

      const duration = Date.now() - startTime;

      // Only track subscription-related queries
      if (
        params.model &&
        ['subscriptions', 'tiers', 'artists'].includes(params.model.toLowerCase())
      ) {
        const metric: QueryMetric = {
          queryId,
          queryType: 'lookup',
          operation: `${params.model}.${params.action}`,
          duration,
          timestamp: new Date(),
          parameters: {
            model: params.model,
            action: params.action,
            argsCount: params.args ? Object.keys(params.args).length : 0,
          },
        };

        subscriptionPerformanceMonitor['addMetric'](metric);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (
        params.model &&
        ['subscriptions', 'tiers', 'artists'].includes(params.model.toLowerCase())
      ) {
        const metric: QueryMetric = {
          queryId,
          queryType: 'lookup',
          operation: `${params.model}.${params.action}`,
          duration,
          timestamp: new Date(),
          parameters: {
            model: params.model,
            action: params.action,
            argsCount: params.args ? Object.keys(params.args).length : 0,
          },
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        };

        subscriptionPerformanceMonitor['addMetric'](metric);
      }

      throw error;
    }
  };
}

// Export utilities
export const PerformanceMonitor = {
  instance: subscriptionPerformanceMonitor,
  trackQuery: trackSubscriptionQuery,
  createMiddleware: createPerformanceMiddleware,
};
