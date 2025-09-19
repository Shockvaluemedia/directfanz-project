import { logger } from './logger';
import { prisma } from './prisma';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  timestamp: Date;
  details?: Record<string, any>;
  error?: string;
}

export interface SystemMetrics {
  database: HealthCheck;
  storage: HealthCheck;
  auth: HealthCheck;
  payments: HealthCheck;
  overall: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
}

class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private alertThresholds = {
    responseTime: 2000, // 2 seconds
    errorRate: 0.05, // 5%
    consecutiveFailures: 3,
  };

  // Database health check
  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Simple query to test database connectivity
      await prisma.users.findFirst({
        select: { id: true },
      });

      const responseTime = Date.now() - start;
      const status = responseTime > this.alertThresholds.responseTime ? 'degraded' : 'healthy';

      return {
        service: 'database',
        status,
        responseTime,
        timestamp: new Date(),
        details: {
          connectionPool: 'active',
          queryTime: responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Database health check failed', { responseTime }, error as Error);

      return {
        service: 'database',
        status: 'unhealthy',
        responseTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  // Storage health check (S3/file system)
  async checkStorage(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Test file system or S3 connectivity
      const testPath = process.env.UPLOAD_PATH || '/tmp';
      const fs = await import('fs').then(m => m.promises);
      await fs.access(testPath);

      const responseTime = Date.now() - start;

      return {
        service: 'storage',
        status: 'healthy',
        responseTime,
        timestamp: new Date(),
        details: {
          type: 'filesystem',
          path: testPath,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Storage health check failed', { responseTime }, error as Error);

      return {
        service: 'storage',
        status: 'unhealthy',
        responseTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  // Auth service health check
  async checkAuth(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Test auth service availability
      const response = await fetch(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/providers`
      );
      const responseTime = Date.now() - start;

      if (response.ok) {
        return {
          service: 'auth',
          status: responseTime > this.alertThresholds.responseTime ? 'degraded' : 'healthy',
          responseTime,
          timestamp: new Date(),
          details: {
            providers: 'accessible',
            statusCode: response.status,
          },
        };
      } else {
        return {
          service: 'auth',
          status: 'degraded',
          responseTime,
          timestamp: new Date(),
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Auth health check failed', { responseTime }, error as Error);

      return {
        service: 'auth',
        status: 'unhealthy',
        responseTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  // Payment service health check
  async checkPayments(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Test Stripe API connectivity
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      await stripe.balance.retrieve();

      const responseTime = Date.now() - start;

      return {
        service: 'payments',
        status: responseTime > this.alertThresholds.responseTime ? 'degraded' : 'healthy',
        responseTime,
        timestamp: new Date(),
        details: {
          provider: 'stripe',
          api: 'accessible',
        },
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Payments health check failed', { responseTime }, error as Error);

      return {
        service: 'payments',
        status: 'unhealthy',
        responseTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  // Comprehensive system health check
  async getSystemHealth(): Promise<SystemMetrics> {
    const [database, storage, auth, payments] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkStorage(),
      this.checkAuth(),
      this.checkPayments(),
    ]);

    const checks: HealthCheck[] = [];

    // Handle settled promises
    if (database.status === 'fulfilled') checks.push(database.value);
    if (storage.status === 'fulfilled') checks.push(storage.value);
    if (auth.status === 'fulfilled') checks.push(auth.value);
    if (payments.status === 'fulfilled') checks.push(payments.value);

    // Determine overall health
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    const metrics: SystemMetrics = {
      database: checks.find(c => c.service === 'database')!,
      storage: checks.find(c => c.service === 'storage')!,
      auth: checks.find(c => c.service === 'auth')!,
      payments: checks.find(c => c.service === 'payments')!,
      overall,
      timestamp: new Date(),
    };

    // Log health status
    if (overall === 'unhealthy') {
      logger.error('System health check failed', { metrics });
    } else if (overall === 'degraded') {
      logger.warn('System performance degraded', { metrics });
    } else {
      logger.info('System health check passed', {
        responseTime: Math.max(...checks.map(c => c.responseTime)),
        services: checks.length,
      });
    }

    return metrics;
  }

  // Performance metrics collection
  async collectPerformanceMetrics(): Promise<{
    memory: NodeJS.MemoryUsage;
    uptime: number;
    cpu: number;
    eventLoop: number;
  }> {
    const memory = process.memoryUsage();
    const uptime = process.uptime();

    // CPU usage (simplified)
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    const cpu = (endUsage.user + endUsage.system) / 1000; // Convert to milliseconds

    // Event loop lag (simplified)
    const start = Date.now();
    await new Promise(resolve => setImmediate(resolve));
    const eventLoop = Date.now() - start;

    const metrics = {
      memory,
      uptime,
      cpu,
      eventLoop,
    };

    logger.debug('Performance metrics collected', metrics);

    return metrics;
  }

  // Start periodic health monitoring
  startMonitoring(intervalMs: number = 60000) {
    // Default: 1 minute
    if (typeof setInterval !== 'undefined') {
      setInterval(async () => {
        try {
          const [health, performance] = await Promise.all([
            this.getSystemHealth(),
            this.collectPerformanceMetrics(),
          ]);

          // Store metrics for trend analysis
          this.checks.set('latest', {
            service: 'system',
            status: health.overall,
            responseTime: 0,
            timestamp: new Date(),
            details: {
              health,
              performance,
            },
          });

          // Alert on critical issues
          if (health.overall === 'unhealthy') {
            this.sendAlert('System health critical', { health, performance });
          }
        } catch (error) {
          logger.error('Health monitoring failed', {}, error as Error);
        }
      }, intervalMs);
    }
  }

  // Alert system
  private async sendAlert(message: string, data: any) {
    logger.error(`ALERT: ${message}`, data);

    // In production, integrate with alerting services
    if (process.env.NODE_ENV === 'production') {
      // Send to Slack, PagerDuty, email, etc.
      try {
        // Example: Slack webhook
        if (process.env.SLACK_WEBHOOK_URL) {
          await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 Direct Fan Platform Alert: ${message}`,
              attachments: [
                {
                  color: 'danger',
                  fields: [
                    {
                      title: 'Details',
                      value: JSON.stringify(data, null, 2),
                      short: false,
                    },
                  ],
                  ts: Math.floor(Date.now() / 1000),
                },
              ],
            }),
          });
        }
      } catch (error) {
        logger.error('Failed to send alert', { message }, error as Error);
      }
    }
  }

  // Get latest health status
  getLatestHealth(): HealthCheck | null {
    return this.checks.get('latest') || null;
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

// Request performance monitoring middleware
export function createPerformanceMiddleware() {
  return async (req: any, res: any, next: any) => {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function (body: any) {
      const duration = Date.now() - start;
      const method = req.method;
      const path = req.path || req.url;
      const statusCode = res.statusCode;

      // Log slow requests
      if (duration > 1000) {
        logger.warn('Slow API request', {
          method,
          path,
          statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      } else {
        logger.info('API request completed', {
          method,
          path,
          statusCode,
          duration,
        });
      }

      // Track metrics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'api_request', {
          method,
          path,
          status_code: statusCode,
          duration,
        });
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

// Database query performance monitoring
export function monitorDatabaseQuery<T>(operation: string, query: Promise<T>): Promise<T> {
  const start = Date.now();

  return query
    .then(result => {
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn('Slow database query', {
          operation,
          duration,
          type: 'slow_query',
        });
      } else {
        logger.debug('Database query completed', {
          operation,
          duration,
        });
      }

      return result;
    })
    .catch(error => {
      const duration = Date.now() - start;
      logger.error(
        'Database query failed',
        {
          operation,
          duration,
          type: 'query_error',
        },
        error
      );
      throw error;
    });
}

export default healthMonitor;
