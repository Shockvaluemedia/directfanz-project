/**
 * Sentry AWS Integration Service
 * 
 * Integrates Sentry error tracking with AWS infrastructure for comprehensive
 * error monitoring and alerting across the DirectFanz platform.
 */

import * as Sentry from '@sentry/nextjs';
import { CloudWatch } from 'aws-sdk';
import { XRayTracingService } from './xray-tracing';

interface SentryAWSConfig {
  dsn: string;
  environment: string;
  release?: string;
  cloudWatchRegion: string;
  enableCloudWatchIntegration: boolean;
  enableXRayIntegration: boolean;
  customTags?: Record<string, string>;
}

interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  uniqueErrors: number;
  criticalErrors: number;
}

export class SentryAWSIntegrationService {
  private cloudWatch: CloudWatch;
  private xrayService: XRayTracingService;
  private config: SentryAWSConfig;
  private errorCache: Map<string, number> = new Map();

  constructor(config: SentryAWSConfig) {
    this.config = config;
    this.cloudWatch = new CloudWatch({ region: config.cloudWatchRegion });
    this.xrayService = new XRayTracingService();
    
    this.initializeSentry();
    this.setupErrorHandlers();
  }

  /**
   * Initialize Sentry with AWS-specific configuration
   */
  private initializeSentry(): void {
    Sentry.init({
      dsn: this.config.dsn,
      environment: this.config.environment,
      release: this.config.release,
      
      // Performance monitoring
      tracesSampleRate: this.config.environment === 'production' ? 0.1 : 1.0,
      
      // Error filtering
      beforeSend: (event, hint) => {
        return this.filterAndEnrichError(event, hint);
      },
      
      // Custom integrations
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.OnUncaughtException(),
        new Sentry.Integrations.OnUnhandledRejection(),
      ],
      
      // Custom tags
      initialScope: {
        tags: {
          component: 'directfanz-platform',
          infrastructure: 'aws',
          ...this.config.customTags,
        },
      },
    });
  }

  /**
   * Set up global error handlers for AWS integration
   */
  private setupErrorHandlers(): void {
    // Capture unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.captureError(new Error(`Unhandled Promise Rejection: ${reason}`), {
        extra: { promise: promise.toString() },
        tags: { errorType: 'unhandledRejection' },
      });
    });

    // Capture uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.captureError(error, {
        tags: { errorType: 'uncaughtException' },
        level: 'fatal',
      });
    });
  }

  /**
   * Filter and enrich error events before sending to Sentry
   */
  private filterAndEnrichError(event: Sentry.Event, hint: Sentry.EventHint): Sentry.Event | null {
    // Skip certain error types in production
    if (this.config.environment === 'production') {
      const errorMessage = event.message || event.exception?.[0]?.value || '';
      
      // Skip known non-critical errors
      const skipPatterns = [
        /network timeout/i,
        /connection reset/i,
        /client disconnected/i,
      ];
      
      if (skipPatterns.some(pattern => pattern.test(errorMessage))) {
        return null;
      }
    }

    // Enrich with AWS context
    if (event.contexts) {
      event.contexts.aws = {
        region: this.config.cloudWatchRegion,
        environment: this.config.environment,
        service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'ecs-service',
      };
    }

    // Add X-Ray trace ID if available
    if (this.config.enableXRayIntegration) {
      const traceId = this.xrayService.getCurrentTraceId();
      if (traceId) {
        event.tags = { ...event.tags, xrayTraceId: traceId };
      }
    }

    return event;
  }

  /**
   * Capture error with AWS CloudWatch metrics integration
   */
  async captureError(
    error: Error,
    context?: {
      extra?: Record<string, any>;
      tags?: Record<string, string>;
      level?: Sentry.SeverityLevel;
      user?: Sentry.User;
    }
  ): Promise<string> {
    // Capture in Sentry
    const eventId = Sentry.captureException(error, {
      extra: context?.extra,
      tags: context?.tags,
      level: context?.level || 'error',
      user: context?.user,
    });

    // Send metrics to CloudWatch if enabled
    if (this.config.enableCloudWatchIntegration) {
      await this.sendErrorMetricsToCloudWatch(error, context?.level || 'error');
    }

    // Update error cache for rate limiting
    this.updateErrorCache(error.message);

    return eventId;
  }

  /**
   * Send error metrics to CloudWatch
   */
  private async sendErrorMetricsToCloudWatch(
    error: Error,
    level: string
  ): Promise<void> {
    try {
      const timestamp = new Date();
      const metricData = [
        {
          MetricName: 'ErrorCount',
          Value: 1,
          Unit: 'Count',
          Timestamp: timestamp,
          Dimensions: [
            { Name: 'Environment', Value: this.config.environment },
            { Name: 'ErrorType', Value: error.constructor.name },
            { Name: 'Severity', Value: level },
          ],
        },
      ];

      // Add critical error metric for high-severity errors
      if (level === 'fatal' || level === 'error') {
        metricData.push({
          MetricName: 'CriticalErrorCount',
          Value: 1,
          Unit: 'Count',
          Timestamp: timestamp,
          Dimensions: [
            { Name: 'Environment', Value: this.config.environment },
          ],
        });
      }

      await this.cloudWatch.putMetricData({
        Namespace: 'DirectFanz/Errors',
        MetricData: metricData,
      }).promise();
    } catch (cloudWatchError) {
      console.error('Failed to send error metrics to CloudWatch:', cloudWatchError);
    }
  }

  /**
   * Update error cache for rate limiting and deduplication
   */
  private updateErrorCache(errorMessage: string): void {
    const key = this.hashErrorMessage(errorMessage);
    const currentCount = this.errorCache.get(key) || 0;
    this.errorCache.set(key, currentCount + 1);

    // Clean up old entries (keep last 1000 unique errors)
    if (this.errorCache.size > 1000) {
      const entries = Array.from(this.errorCache.entries());
      entries.sort((a, b) => b[1] - a[1]); // Sort by count descending
      
      this.errorCache.clear();
      entries.slice(0, 1000).forEach(([key, count]) => {
        this.errorCache.set(key, count);
      });
    }
  }

  /**
   * Generate hash for error message deduplication
   */
  private hashErrorMessage(message: string): string {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Get error metrics for monitoring dashboard
   */
  async getErrorMetrics(timeRangeMinutes: number = 60): Promise<ErrorMetrics> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (timeRangeMinutes * 60 * 1000));

      const params = {
        Namespace: 'DirectFanz/Errors',
        MetricName: 'ErrorCount',
        StartTime: startTime,
        EndTime: endTime,
        Period: 300, // 5-minute periods
        Statistics: ['Sum'],
        Dimensions: [
          { Name: 'Environment', Value: this.config.environment },
        ],
      };

      const errorCountData = await this.cloudWatch.getMetricStatistics(params).promise();
      
      const criticalParams = { ...params, MetricName: 'CriticalErrorCount' };
      const criticalErrorData = await this.cloudWatch.getMetricStatistics(criticalParams).promise();

      // Calculate metrics
      const totalErrors = errorCountData.Datapoints?.reduce((sum, point) => sum + (point.Sum || 0), 0) || 0;
      const criticalErrors = criticalErrorData.Datapoints?.reduce((sum, point) => sum + (point.Sum || 0), 0) || 0;
      const uniqueErrors = this.errorCache.size;
      
      // Calculate error rate (errors per minute)
      const errorRate = totalErrors / timeRangeMinutes;

      return {
        errorCount: totalErrors,
        errorRate,
        uniqueErrors,
        criticalErrors,
      };
    } catch (error) {
      console.error('Failed to get error metrics:', error);
      return {
        errorCount: 0,
        errorRate: 0,
        uniqueErrors: 0,
        criticalErrors: 0,
      };
    }
  }

  /**
   * Set user context for error tracking
   */
  setUserContext(user: {
    id: string;
    email?: string;
    username?: string;
    subscription?: string;
  }): void {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      subscription: user.subscription,
    });
  }

  /**
   * Add breadcrumb for error context
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Start performance transaction
   */
  startTransaction(name: string, operation: string): Sentry.Transaction {
    return Sentry.startTransaction({
      name,
      op: operation,
      tags: {
        environment: this.config.environment,
      },
    });
  }

  /**
   * Capture performance metrics
   */
  async capturePerformanceMetric(
    name: string,
    value: number,
    unit: string = 'milliseconds'
  ): Promise<void> {
    // Send to Sentry as measurement
    Sentry.setMeasurement(name, value, unit);

    // Also send to CloudWatch if enabled
    if (this.config.enableCloudWatchIntegration) {
      try {
        await this.cloudWatch.putMetricData({
          Namespace: 'DirectFanz/Performance',
          MetricData: [{
            MetricName: name,
            Value: value,
            Unit: unit === 'milliseconds' ? 'Milliseconds' : 'Count',
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'Environment', Value: this.config.environment },
            ],
          }],
        }).promise();
      } catch (error) {
        console.error('Failed to send performance metric to CloudWatch:', error);
      }
    }
  }

  /**
   * Flush all pending events (useful for Lambda functions)
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    return await Sentry.flush(timeout);
  }

  /**
   * Close the Sentry client
   */
  async close(timeout: number = 2000): Promise<boolean> {
    return await Sentry.close(timeout);
  }
}

// Export singleton instance
let sentryAWSService: SentryAWSIntegrationService | null = null;

export function initializeSentryAWS(config: SentryAWSConfig): SentryAWSIntegrationService {
  if (!sentryAWSService) {
    sentryAWSService = new SentryAWSIntegrationService(config);
  }
  return sentryAWSService;
}

export function getSentryAWS(): SentryAWSIntegrationService | null {
  return sentryAWSService;
}