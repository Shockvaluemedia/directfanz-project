/**
 * Comprehensive Performance Monitoring System
 * Tracks performance improvements and catches regressions
 */

import { logger } from './logger';
import { measurePerformance, PerformanceMetric } from './performance';
import { prisma } from './prisma';
import { startTransaction, reportError, reportMessage } from './monitoring';

export interface PerformanceAlert {
  id: string;
  type: 'regression' | 'improvement' | 'threshold_exceeded';
  metric: string;
  currentValue: number;
  previousValue?: number;
  threshold?: number;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface PerformanceBenchmark {
  id: string;
  name: string;
  description: string;
  baseline: number; // milliseconds
  threshold: number; // milliseconds
  category: 'database' | 'api' | 'frontend' | 'memory' | 'network';
  createdAt: Date;
  updatedAt: Date;
}

class PerformanceMonitor {
  private alerts: PerformanceAlert[] = [];
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();

  constructor() {
    this.initializeBenchmarks();
  }

  /**
   * Initialize performance benchmarks based on our optimization targets
   */
  private initializeBenchmarks() {
    const benchmarks: PerformanceBenchmark[] = [
      {
        id: 'db_query_average',
        name: 'Database Query Average',
        description: 'Average database query response time',
        baseline: 200, // ms (target after 70% improvement)
        threshold: 300, // ms (alert if exceeded)
        category: 'database',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'api_response_time',
        name: 'API Response Time',
        description: 'Average API endpoint response time',
        baseline: 500, // ms
        threshold: 1000, // ms
        category: 'api',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'memory_usage',
        name: 'Memory Usage',
        description: 'Application memory usage',
        baseline: 300, // MB
        threshold: 500, // MB
        category: 'memory',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'react_render_time',
        name: 'React Component Render Time',
        description: 'Average React component render time',
        baseline: 16, // ms (60 FPS target)
        threshold: 32, // ms (30 FPS)
        category: 'frontend',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    benchmarks.forEach(benchmark => {
      this.benchmarks.set(benchmark.id, benchmark);
    });
  }

  /**
   * Record a performance measurement
   */
  async recordMeasurement(
    metricName: string,
    value: number,
    category: PerformanceBenchmark['category'],
    metadata?: Record<string, any>
  ): Promise<number> {
    // Use existing measurement infrastructure
    return measurePerformance(
      metricName,
      async () => {
        // Check for performance regressions or improvements
        await this.checkForAnomalies(metricName, value, category);
        return value;
      },
      metadata
    );
  }

  /**
   * Check for performance anomalies and generate alerts
   */
  private async checkForAnomalies(
    metricName: string,
    currentValue: number,
    category: PerformanceBenchmark['category']
  ) {
    const benchmark = this.benchmarks.get(metricName);
    
    if (!benchmark) {
      // Create dynamic benchmark if none exists
      this.createDynamicBenchmark(metricName, currentValue, category);
      return;
    }

    // Check threshold violations
    if (currentValue > benchmark.threshold) {
      await this.createAlert({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'threshold_exceeded',
        metric: metricName,
        currentValue,
        threshold: benchmark.threshold,
        timestamp: new Date(),
        severity: this.calculateSeverity(currentValue, benchmark),
        message: `${benchmark.name} exceeded threshold: ${currentValue}ms > ${benchmark.threshold}ms`,
      });
    }

    // Check for performance regressions (20% worse than baseline)
    if (currentValue > benchmark.baseline * 1.2) {
      await this.createAlert({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'regression',
        metric: metricName,
        currentValue,
        previousValue: benchmark.baseline,
        timestamp: new Date(),
        severity: 'high',
        message: `Performance regression detected in ${benchmark.name}: ${currentValue}ms vs ${benchmark.baseline}ms baseline`,
      });
    }

    // Check for performance improvements (20% better than baseline)
    if (currentValue < benchmark.baseline * 0.8) {
      await this.createAlert({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'improvement',
        metric: metricName,
        currentValue,
        previousValue: benchmark.baseline,
        timestamp: new Date(),
        severity: 'low',
        message: `Performance improvement detected in ${benchmark.name}: ${currentValue}ms vs ${benchmark.baseline}ms baseline`,
      });

      // Update baseline for future comparisons
      benchmark.baseline = currentValue;
      benchmark.updatedAt = new Date();
    }
  }

  /**
   * Create a dynamic benchmark for new metrics
   */
  private createDynamicBenchmark(
    metricName: string,
    initialValue: number,
    category: PerformanceBenchmark['category']
  ) {
    const benchmark: PerformanceBenchmark = {
      id: metricName,
      name: metricName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `Auto-generated benchmark for ${metricName}`,
      baseline: initialValue,
      threshold: initialValue * 2, // Alert if 2x slower than initial
      category,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.benchmarks.set(metricName, benchmark);
    logger.info('Created dynamic performance benchmark', { benchmark });
  }

  /**
   * Calculate alert severity based on performance degradation
   */
  private calculateSeverity(
    currentValue: number,
    benchmark: PerformanceBenchmark
  ): PerformanceAlert['severity'] {
    const ratio = currentValue / benchmark.threshold;
    
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  /**
   * Create and store a performance alert
   */
  private async createAlert(alert: PerformanceAlert) {
    this.alerts.push(alert);

    // Log alert
    logger.warn('Performance alert generated', { alert });

    // Report to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      const severity = alert.severity === 'critical' || alert.severity === 'high' ? 'error' : 'warning';
      reportMessage(alert.message, severity, { 
        alert,
        performanceData: {
          metric: alert.metric,
          value: alert.currentValue,
          threshold: alert.threshold,
          type: alert.type
        }
      });
    }

    // Keep only recent alerts (last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Database-specific performance monitoring
   */
  async monitorDatabaseQuery<T>(
    queryName: string,
    query: () => Promise<T>
  ): Promise<T> {
    const transaction = startTransaction(`db_${queryName}`, 'db.query');
    
    try {
      const result = await measurePerformance(
        `db_query_${queryName}`,
        query,
        { queryType: queryName }
      );

      // Record database metrics
      const duration = performance.now();
      await this.recordMeasurement(
        'db_query_average',
        duration,
        'database',
        { queryName }
      );

      return result;
    } catch (error) {
      reportError(error as Error, { queryName });
      throw error;
    } finally {
      transaction?.finish();
    }
  }

  /**
   * API endpoint performance monitoring
   */
  async monitorApiEndpoint<T>(
    endpoint: string,
    method: string,
    handler: () => Promise<T>
  ): Promise<T> {
    const transaction = startTransaction(`api_${endpoint}`, 'http.server');
    
    try {
      const result = await measurePerformance(
        `api_${endpoint}_${method}`,
        handler,
        { endpoint, method }
      );

      return result;
    } catch (error) {
      reportError(error as Error, { endpoint, method });
      throw error;
    } finally {
      transaction?.finish();
    }
  }

  /**
   * Memory usage monitoring
   */
  async monitorMemoryUsage(): Promise<NodeJS.MemoryUsage> {
    const memoryUsage = process.memoryUsage();
    
    // Convert to MB for easier reading
    const memoryMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024),
    };

    // Monitor heap usage
    await this.recordMeasurement(
      'memory_usage',
      memoryMB.heapUsed,
      'memory',
      memoryMB
    );

    return memoryUsage;
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary() {
    return {
      benchmarks: Array.from(this.benchmarks.values()),
      recentAlerts: this.alerts.slice(-10),
      alertCounts: {
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        high: this.alerts.filter(a => a.severity === 'high').length,
        medium: this.alerts.filter(a => a.severity === 'medium').length,
        low: this.alerts.filter(a => a.severity === 'low').length,
      },
      regressions: this.alerts.filter(a => a.type === 'regression').length,
      improvements: this.alerts.filter(a => a.type === 'improvement').length,
    };
  }

  /**
   * Health check for performance monitoring system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    summary: any;
  }> {
    const checks = {
      databaseConnection: false,
      memoryUsage: false,
      alertSystem: false,
    };

    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;
      checks.databaseConnection = true;
    } catch (error) {
      logger.error('Database health check failed', {}, error as Error);
    }

    try {
      // Check memory usage
      const memory = await this.monitorMemoryUsage();
      checks.memoryUsage = memory.heapUsed / memory.heapTotal < 0.9; // Less than 90% heap usage
    } catch (error) {
      logger.error('Memory health check failed', {}, error as Error);
    }

    // Check alert system
    checks.alertSystem = this.alerts.length < 50; // Not too many alerts

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.values(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      summary: this.getPerformanceSummary(),
    };
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const monitorDatabaseQuery = (name: string, query: () => Promise<any>) =>
  performanceMonitor.monitorDatabaseQuery(name, query);

export const monitorApiEndpoint = (endpoint: string, method: string, handler: () => Promise<any>) =>
  performanceMonitor.monitorApiEndpoint(endpoint, method, handler);

export const getPerformanceHealth = () => performanceMonitor.healthCheck();

export const getPerformanceSummary = () => performanceMonitor.getPerformanceSummary();