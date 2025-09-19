/**
 * Database Performance Monitoring
 *
 * Real-time monitoring middleware for Prisma to track query performance,
 * slow queries, and database health metrics.
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

class DatabaseMonitor {
  constructor(options = {}) {
    this.options = {
      slowQueryThreshold: options.slowQueryThreshold || 1000, // 1 second
      errorRateThreshold: options.errorRateThreshold || 0.05, // 5%
      enableFileLogging: options.enableFileLogging || false,
      logFilePath: options.logFilePath || 'logs/database-performance.log',
      metricsRetentionTime: options.metricsRetentionTime || 24 * 60 * 60 * 1000, // 24 hours
      ...options,
    };

    this.queryMetrics = new Map();
    this.slowQueries = [];
    this.errorLog = [];
    this.connectionPool = {
      active: 0,
      idle: 0,
      max: 10, // Default, should be configured based on your setup
    };

    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      peakResponseTime: 0,
      startTime: Date.now(),
    };

    this.alerts = [];

    // Clean up old metrics every hour
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
  }

  createMonitoringMiddleware() {
    return async (params, next) => {
      const queryStart = performance.now();
      const timestamp = new Date();
      const queryKey = `${params.model}.${params.action}`;

      // Track connection usage
      this.connectionPool.active++;

      try {
        const result = await next(params);
        const duration = performance.now() - queryStart;

        // Update statistics
        this.updateQueryStats(queryKey, duration, true, params, timestamp);

        // Check for slow queries
        if (duration > this.options.slowQueryThreshold) {
          await this.logSlowQuery(queryKey, duration, params, timestamp);
        }

        return result;
      } catch (error) {
        const duration = performance.now() - queryStart;

        // Update error statistics
        this.updateQueryStats(queryKey, duration, false, params, timestamp, error);

        // Log error
        await this.logQueryError(queryKey, duration, params, timestamp, error);

        throw error;
      } finally {
        this.connectionPool.active--;
        this.connectionPool.idle = this.connectionPool.max - this.connectionPool.active;
      }
    };
  }

  updateQueryStats(queryKey, duration, success, params, timestamp, error = null) {
    // Update global stats
    this.stats.totalQueries++;
    if (success) {
      this.stats.successfulQueries++;
    } else {
      this.stats.failedQueries++;
    }

    // Update average response time
    const totalResponseTime =
      this.stats.averageResponseTime * (this.stats.totalQueries - 1) + duration;
    this.stats.averageResponseTime = parseFloat(
      (totalResponseTime / this.stats.totalQueries).toFixed(2)
    );

    // Update peak response time
    if (duration > this.stats.peakResponseTime) {
      this.stats.peakResponseTime = parseFloat(duration.toFixed(2));
    }

    // Update query-specific metrics
    if (!this.queryMetrics.has(queryKey)) {
      this.queryMetrics.set(queryKey, {
        count: 0,
        successCount: 0,
        errorCount: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        recentTimes: [],
        errors: [],
        lastExecuted: timestamp,
      });
    }

    const metrics = this.queryMetrics.get(queryKey);
    metrics.count++;
    metrics.totalTime += duration;
    metrics.avgTime = parseFloat((metrics.totalTime / metrics.count).toFixed(2));
    metrics.lastExecuted = timestamp;

    if (success) {
      metrics.successCount++;
      metrics.minTime = Math.min(metrics.minTime, duration);
      metrics.maxTime = Math.max(metrics.maxTime, duration);

      // Keep last 50 execution times for trend analysis
      metrics.recentTimes.push({
        time: parseFloat(duration.toFixed(2)),
        timestamp,
      });
      if (metrics.recentTimes.length > 50) {
        metrics.recentTimes.shift();
      }
    } else {
      metrics.errorCount++;
      metrics.errors.push({
        error: error?.message || 'Unknown error',
        timestamp,
        duration: parseFloat(duration.toFixed(2)),
      });
      if (metrics.errors.length > 20) {
        metrics.errors.shift();
      }
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(queryKey, metrics);
  }

  async logSlowQuery(queryKey, duration, params, timestamp) {
    const slowQuery = {
      queryKey,
      duration: parseFloat(duration.toFixed(2)),
      model: params.model,
      action: params.action,
      args: this.sanitizeArgs(params.args),
      timestamp: timestamp.toISOString(),
      stack: new Error().stack,
    };

    this.slowQueries.push(slowQuery);

    // Keep only last 100 slow queries
    if (this.slowQueries.length > 100) {
      this.slowQueries.shift();
    }

    // Log to console
    console.warn('🐌 Slow query detected:', {
      query: queryKey,
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${this.options.slowQueryThreshold}ms`,
    });

    // Log to file if enabled
    if (this.options.enableFileLogging) {
      await this.writeToLogFile('SLOW_QUERY', slowQuery);
    }

    // Trigger alert
    this.triggerAlert('slow_query', {
      query: queryKey,
      duration,
      threshold: this.options.slowQueryThreshold,
    });
  }

  async logQueryError(queryKey, duration, params, timestamp, error) {
    const errorEntry = {
      queryKey,
      duration: parseFloat(duration.toFixed(2)),
      model: params.model,
      action: params.action,
      args: this.sanitizeArgs(params.args),
      error: error.message,
      stack: error.stack,
      timestamp: timestamp.toISOString(),
    };

    this.errorLog.push(errorEntry);

    // Keep only last 200 errors
    if (this.errorLog.length > 200) {
      this.errorLog.shift();
    }

    // Log to console
    console.error('💥 Database query error:', {
      query: queryKey,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
    });

    // Log to file if enabled
    if (this.options.enableFileLogging) {
      await this.writeToLogFile('QUERY_ERROR', errorEntry);
    }
  }

  sanitizeArgs(args) {
    // Remove sensitive data from query args for logging
    if (!args) return args;

    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = JSON.parse(JSON.stringify(args));

    const sanitizeObject = obj => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeObject(value);
          }
        }
        return result;
      }

      return obj;
    };

    return sanitizeObject(sanitized);
  }

  async writeToLogFile(level, data) {
    try {
      const logDir = path.dirname(this.options.logFilePath);
      await fs.mkdir(logDir, { recursive: true });

      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        ...data,
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.options.logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  checkPerformanceAlerts(queryKey, metrics) {
    // Check error rate
    const errorRate = metrics.count > 0 ? metrics.errorCount / metrics.count : 0;
    if (errorRate > this.options.errorRateThreshold) {
      this.triggerAlert('high_error_rate', {
        query: queryKey,
        errorRate,
        threshold: this.options.errorRateThreshold,
        totalQueries: metrics.count,
        errorCount: metrics.errorCount,
      });
    }

    // Check for performance degradation (average time increasing significantly)
    if (metrics.recentTimes.length >= 10) {
      const recentAvg = metrics.recentTimes.slice(-5).reduce((sum, t) => sum + t.time, 0) / 5;
      const olderAvg = metrics.recentTimes.slice(-15, -10).reduce((sum, t) => sum + t.time, 0) / 5;

      if (recentAvg > olderAvg * 2 && recentAvg > 100) {
        // 2x slower and > 100ms
        this.triggerAlert('performance_degradation', {
          query: queryKey,
          recentAvg,
          olderAvg,
          degradationFactor: (recentAvg / olderAvg).toFixed(2),
        });
      }
    }
  }

  triggerAlert(type, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Emit alert (could integrate with external alerting systems)
    console.warn(`🚨 Performance Alert [${type}]:`, data);

    // You can add integrations here:
    // - Send to Slack
    // - Send to email
    // - Send to monitoring service (DataDog, New Relic, etc.)
    // - Trigger webhook
  }

  cleanupOldMetrics() {
    const cutoffTime = Date.now() - this.options.metricsRetentionTime;

    // Clean up old slow queries
    this.slowQueries = this.slowQueries.filter(
      query => new Date(query.timestamp).getTime() > cutoffTime
    );

    // Clean up old errors
    this.errorLog = this.errorLog.filter(error => new Date(error.timestamp).getTime() > cutoffTime);

    // Clean up old alerts
    this.alerts = this.alerts.filter(alert => new Date(alert.timestamp).getTime() > cutoffTime);

    console.log('🧹 Cleaned up old monitoring metrics');
  }

  // Health check methods
  async getDatabaseHealth() {
    try {
      const healthMetrics = {
        status: 'healthy',
        uptime: Date.now() - this.stats.startTime,
        totalQueries: this.stats.totalQueries,
        successRate:
          this.stats.totalQueries > 0
            ? parseFloat(
                ((this.stats.successfulQueries / this.stats.totalQueries) * 100).toFixed(2)
              )
            : 100,
        averageResponseTime: this.stats.averageResponseTime,
        peakResponseTime: this.stats.peakResponseTime,
        activeConnections: this.connectionPool.active,
        connectionPoolUsage: parseFloat(
          ((this.connectionPool.active / this.connectionPool.max) * 100).toFixed(2)
        ),
        slowQueries: this.slowQueries.length,
        recentErrors: this.errorLog.filter(
          error => Date.now() - new Date(error.timestamp).getTime() < 60000
        ).length, // Errors in last minute
        activeAlerts: this.alerts.filter(alert => !alert.acknowledged).length,
        timestamp: new Date().toISOString(),
      };

      // Determine overall health status
      if (healthMetrics.successRate < 95) {
        healthMetrics.status = 'degraded';
      } else if (healthMetrics.connectionPoolUsage > 80 || healthMetrics.activeAlerts > 0) {
        healthMetrics.status = 'warning';
      }

      return healthMetrics;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  getQueryMetrics() {
    const metrics = {};

    for (const [queryKey, data] of this.queryMetrics.entries()) {
      metrics[queryKey] = {
        ...data,
        errorRate:
          data.count > 0 ? parseFloat(((data.errorCount / data.count) * 100).toFixed(2)) : 0,
        recentTrend: this.calculateTrend(data.recentTimes),
        // Don't include full arrays in summary
        recentTimesCount: data.recentTimes.length,
        errorsCount: data.errors.length,
      };
    }

    return {
      queries: metrics,
      globalStats: this.stats,
      timestamp: new Date().toISOString(),
    };
  }

  calculateTrend(recentTimes) {
    if (recentTimes.length < 5) return 'insufficient_data';

    const recent = recentTimes.slice(-5);
    const older = recentTimes.slice(-10, -5);

    if (older.length === 0) return 'insufficient_data';

    const recentAvg = recent.reduce((sum, t) => sum + t.time, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.time, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (Math.abs(change) < 10) return 'stable';
    return change > 0 ? 'degrading' : 'improving';
  }

  getSlowQueries(limit = 20) {
    return this.slowQueries.sort((a, b) => b.duration - a.duration).slice(0, limit);
  }

  getRecentErrors(limit = 20) {
    return this.errorLog
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getActiveAlerts() {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  // Reset methods
  resetMetrics() {
    this.queryMetrics.clear();
    this.slowQueries = [];
    this.errorLog = [];
    this.alerts = [];
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      peakResponseTime: 0,
      startTime: Date.now(),
    };
    console.log('📊 Performance metrics reset');
  }

  // Export methods for reporting
  async exportMetrics(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `database-metrics-${timestamp}.json`;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      health: await this.getDatabaseHealth(),
      metrics: this.getQueryMetrics(),
      slowQueries: this.slowQueries,
      recentErrors: this.errorLog,
      alerts: this.alerts,
      options: this.options,
    };

    const exportDir = path.join(process.cwd(), 'performance-results');
    await fs.mkdir(exportDir, { recursive: true });

    const filePath = path.join(exportDir, filename);
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

    return filePath;
  }
}

// Create singleton instance
const dbMonitor = new DatabaseMonitor({
  slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000,
  errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD) || 0.05,
  enableFileLogging: process.env.ENABLE_DB_LOGGING === 'true',
  logFilePath: process.env.DB_LOG_FILE || 'logs/database-performance.log',
});

export { DatabaseMonitor, dbMonitor };
