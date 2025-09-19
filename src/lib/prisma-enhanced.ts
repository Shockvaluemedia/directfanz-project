import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';

interface QueryPerformanceMetrics {
  queryType: string;
  duration: number;
  timestamp: Date;
  model?: string;
  operation?: string;
}

class EnhancedPrismaClient extends PrismaClient {
  private queryMetrics: QueryPerformanceMetrics[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 500; // ms
  private readonly MAX_METRICS_HISTORY = 1000;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    this.setupEventListeners();
    this.setupPerformanceMiddleware();
  }

  private setupEventListeners() {
    // Log slow queries
    this.$on('query', e => {
      const duration = e.duration;

      if (duration > this.SLOW_QUERY_THRESHOLD) {
        logger.warn('Slow query detected', {
          query: e.query,
          params: e.params,
          duration: `${duration}ms`,
          timestamp: e.timestamp,
        });
      }

      // Store metrics for analysis
      this.addQueryMetric({
        queryType: this.extractQueryType(e.query),
        duration,
        timestamp: new Date(e.timestamp),
        operation: this.extractOperation(e.query),
      });
    });

    // Log database errors
    this.$on('error', e => {
      logger.error('Database error', {
        timestamp: e.timestamp,
        target: e.target,
      });
    });

    // Log warnings
    this.$on('warn', e => {
      logger.warn('Database warning', {
        message: e.message,
        timestamp: e.timestamp,
        target: e.target,
      });
    });
  }

  private setupPerformanceMiddleware() {
    this.$use(async (params, next) => {
      const startTime = Date.now();

      try {
        const result = await next(params);
        const duration = Date.now() - startTime;

        // Log performance metrics
        this.addQueryMetric({
          queryType: 'middleware',
          duration,
          timestamp: new Date(),
          model: params.model,
          operation: params.action,
        });

        // Alert on very slow operations
        if (duration > this.SLOW_QUERY_THRESHOLD * 2) {
          // 1 second
          logger.error('Very slow database operation', {
            model: params.model,
            action: params.action,
            duration: `${duration}ms`,
            args: JSON.stringify(params.args, null, 2).slice(0, 500), // Truncate large args
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('Database operation failed', {
          model: params.model,
          action: params.action,
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    });
  }

  private extractQueryType(query: string): string {
    const trimmedQuery = query.trim().toUpperCase();
    if (trimmedQuery.startsWith('SELECT')) return 'SELECT';
    if (trimmedQuery.startsWith('INSERT')) return 'INSERT';
    if (trimmedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (trimmedQuery.startsWith('DELETE')) return 'DELETE';
    if (trimmedQuery.startsWith('WITH')) return 'CTE';
    return 'OTHER';
  }

  private extractOperation(query: string): string {
    const fromMatch = query.match(/FROM\s+["`]?(\w+)["`]?/i);
    const intoMatch = query.match(/INTO\s+["`]?(\w+)["`]?/i);
    const updateMatch = query.match(/UPDATE\s+["`]?(\w+)["`]?/i);

    return fromMatch?.[1] || intoMatch?.[1] || updateMatch?.[1] || 'unknown';
  }

  private addQueryMetric(metric: QueryPerformanceMetrics) {
    this.queryMetrics.push(metric);

    // Keep only the most recent metrics
    if (this.queryMetrics.length > this.MAX_METRICS_HISTORY) {
      this.queryMetrics.shift();
    }
  }

  /**
   * Get performance analytics for the current session
   */
  getPerformanceAnalytics(): {
    totalQueries: number;
    slowQueries: number;
    averageDuration: number;
    queryTypeBreakdown: Record<string, number>;
    modelBreakdown: Record<string, number>;
    recentSlowQueries: QueryPerformanceMetrics[];
  } {
    const slowQueries = this.queryMetrics.filter(m => m.duration > this.SLOW_QUERY_THRESHOLD);
    const totalDuration = this.queryMetrics.reduce((sum, m) => sum + m.duration, 0);

    const queryTypeBreakdown = this.queryMetrics.reduce(
      (acc, m) => {
        acc[m.queryType] = (acc[m.queryType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const modelBreakdown = this.queryMetrics.reduce(
      (acc, m) => {
        if (m.model) {
          acc[m.model] = (acc[m.model] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalQueries: this.queryMetrics.length,
      slowQueries: slowQueries.length,
      averageDuration: this.queryMetrics.length > 0 ? totalDuration / this.queryMetrics.length : 0,
      queryTypeBreakdown,
      modelBreakdown,
      recentSlowQueries: slowQueries.slice(-10), // Last 10 slow queries
    };
  }

  /**
   * Clear performance metrics history
   */
  clearMetrics() {
    this.queryMetrics = [];
    logger.info('Database performance metrics cleared');
  }

  /**
   * Enhanced query method with automatic retry logic
   */
  async queryWithRetry<T>(
    query: Prisma.Sql,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T[]> {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const startTime = Date.now();
        const result = await this.$queryRaw<T[]>(query);
        const duration = Date.now() - startTime;

        if (duration > this.SLOW_QUERY_THRESHOLD) {
          logger.warn('Slow raw query', {
            query: query.sql,
            duration: `${duration}ms`,
            attempt: attempt + 1,
          });
        }

        return result;
      } catch (error) {
        attempt++;

        if (attempt > maxRetries) {
          logger.error('Query failed after all retries', {
            query: query.sql,
            attempts: attempt,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        logger.warn('Query failed, retrying', {
          query: query.sql,
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Batch operation with transaction and error handling
   */
  async batchOperation<T>(
    operations: ((tx: Prisma.TransactionClient) => Promise<T>)[],
    options: {
      maxRetries?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    } = {}
  ): Promise<T[]> {
    const { maxRetries = 3, isolationLevel } = options;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const startTime = Date.now();

        const results = await this.$transaction(operations, {
          isolationLevel,
          timeout: 10000, // 10 second timeout
        });

        const duration = Date.now() - startTime;

        logger.info('Batch operation completed', {
          operationCount: operations.length,
          duration: `${duration}ms`,
          attempt: attempt + 1,
        });

        return results;
      } catch (error) {
        attempt++;

        if (attempt > maxRetries) {
          logger.error('Batch operation failed after all retries', {
            operationCount: operations.length,
            attempts: attempt,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        logger.warn('Batch operation failed, retrying', {
          operationCount: operations.length,
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });

        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Unexpected end of batch operation retry loop');
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    activeConnections?: number;
    metrics: ReturnType<typeof this.getPerformanceAnalytics>;
  }> {
    try {
      const startTime = Date.now();

      // Simple query to test database connectivity
      await this.$queryRaw`SELECT 1 as health_check`;

      const responseTime = Date.now() - startTime;
      const metrics = this.getPerformanceAnalytics();

      // Determine health status based on performance
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (responseTime > 1000 || metrics.slowQueries > metrics.totalQueries * 0.2) {
        status = 'degraded';
      }

      if (responseTime > 5000 || metrics.slowQueries > metrics.totalQueries * 0.5) {
        status = 'unhealthy';
      }

      return {
        status,
        responseTime,
        metrics,
      };
    } catch (error) {
      logger.error('Database health check failed', error);

      return {
        status: 'unhealthy',
        responseTime: -1,
        metrics: this.getPerformanceAnalytics(),
      };
    }
  }
}

// Create singleton instance
const enhancedPrisma = new EnhancedPrismaClient();

// Export both the enhanced client and regular client for compatibility
export { enhancedPrisma };
export { PrismaClient, Prisma };

// Export the enhanced client as default for new usage
export default enhancedPrisma;
