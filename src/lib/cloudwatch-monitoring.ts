/**
 * CloudWatch Monitoring Service
 * Implements comprehensive application monitoring and custom metrics
 * Requirements: 7.1, 7.3 - Monitor application performance, errors, and business metrics
 */

import { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

interface MetricData {
  MetricName: string;
  Value: number;
  Unit: string;
  Timestamp?: Date;
  Dimensions?: Array<{
    Name: string;
    Value: string;
  }>;
}

interface BusinessMetrics {
  activeUsers: number;
  streamStarts: number;
  revenueEvents: number;
  contentUploads: number;
  newSubscriptions: number;
}

interface ApplicationMetrics {
  apiErrors: number;
  slowQueries: number;
  responseTime: number;
  throughput: number;
}

interface MonitoringConfig {
  region: string;
  namespace: string;
  environment: string;
}

export class CloudWatchMonitoringService {
  private cloudWatchClient: CloudWatchClient;
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.cloudWatchClient = new CloudWatchClient({ 
      region: config.region,
      maxAttempts: 3,
      retryMode: 'adaptive'
    });
  }

  /**
   * Send custom metric to CloudWatch
   */
  async putMetric(metricData: MetricData): Promise<void> {
    try {
      const command = new PutMetricDataCommand({
        Namespace: this.config.namespace,
        MetricData: [{
          MetricName: metricData.MetricName,
          Value: metricData.Value,
          Unit: metricData.Unit,
          Timestamp: metricData.Timestamp || new Date(),
          Dimensions: metricData.Dimensions || []
        }]
      });

      await this.cloudWatchClient.send(command);
    } catch (error) {
      console.error(`Failed to send metric ${metricData.MetricName}:`, error);
      // Don't throw - monitoring failures shouldn't break the application
    }
  }

  /**
   * Send multiple metrics in batch
   */
  async putMetrics(metrics: MetricData[]): Promise<void> {
    try {
      // CloudWatch allows up to 20 metrics per request
      const batches = this.chunkArray(metrics, 20);

      for (const batch of batches) {
        const command = new PutMetricDataCommand({
          Namespace: this.config.namespace,
          MetricData: batch.map(metric => ({
            MetricName: metric.MetricName,
            Value: metric.Value,
            Unit: metric.Unit,
            Timestamp: metric.Timestamp || new Date(),
            Dimensions: metric.Dimensions || []
          }))
        });

        await this.cloudWatchClient.send(command);
      }
    } catch (error) {
      console.error('Failed to send metrics batch:', error);
    }
  }

  /**
   * Track business KPIs
   */
  async trackBusinessMetrics(metrics: Partial<BusinessMetrics>): Promise<void> {
    const metricData: MetricData[] = [];

    if (metrics.activeUsers !== undefined) {
      metricData.push({
        MetricName: 'ActiveUsers',
        Value: metrics.activeUsers,
        Unit: 'Count'
      });
    }

    if (metrics.streamStarts !== undefined) {
      metricData.push({
        MetricName: 'StreamStarts',
        Value: metrics.streamStarts,
        Unit: 'Count'
      });
    }

    if (metrics.revenueEvents !== undefined) {
      metricData.push({
        MetricName: 'RevenueEvents',
        Value: metrics.revenueEvents,
        Unit: 'Count'
      });
    }

    if (metrics.contentUploads !== undefined) {
      metricData.push({
        MetricName: 'ContentUploads',
        Value: metrics.contentUploads,
        Unit: 'Count'
      });
    }

    if (metrics.newSubscriptions !== undefined) {
      metricData.push({
        MetricName: 'NewSubscriptions',
        Value: metrics.newSubscriptions,
        Unit: 'Count'
      });
    }

    if (metricData.length > 0) {
      await this.putMetrics(metricData);
    }
  }

  /**
   * Track application performance metrics
   */
  async trackApplicationMetrics(metrics: Partial<ApplicationMetrics>): Promise<void> {
    const metricData: MetricData[] = [];

    if (metrics.apiErrors !== undefined) {
      metricData.push({
        MetricName: 'APIErrors',
        Value: metrics.apiErrors,
        Unit: 'Count'
      });
    }

    if (metrics.slowQueries !== undefined) {
      metricData.push({
        MetricName: 'SlowQueries',
        Value: metrics.slowQueries,
        Unit: 'Count'
      });
    }

    if (metrics.responseTime !== undefined) {
      metricData.push({
        MetricName: 'ResponseTime',
        Value: metrics.responseTime,
        Unit: 'Milliseconds'
      });
    }

    if (metrics.throughput !== undefined) {
      metricData.push({
        MetricName: 'Throughput',
        Value: metrics.throughput,
        Unit: 'Count/Second'
      });
    }

    if (metricData.length > 0) {
      await this.putMetrics(metricData);
    }
  }

  /**
   * Track user login event
   */
  async trackUserLogin(userId: string, userType: string = 'user'): Promise<void> {
    await this.putMetric({
      MetricName: 'UserLogins',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'UserType', Value: userType },
        { Name: 'Environment', Value: this.config.environment }
      ]
    });

    // Also log for business metrics
    console.log(`INFO USER_LOGIN ${userId} ${userType}`);
  }

  /**
   * Track stream start event
   */
  async trackStreamStart(streamId: string, creatorId: string, category?: string): Promise<void> {
    const dimensions = [
      { Name: 'Environment', Value: this.config.environment }
    ];

    if (category) {
      dimensions.push({ Name: 'Category', Value: category });
    }

    await this.putMetric({
      MetricName: 'StreamStarts',
      Value: 1,
      Unit: 'Count',
      Dimensions: dimensions
    });

    // Also log for business metrics
    console.log(`INFO STREAM_STARTED ${streamId} ${creatorId} ${category || 'unknown'}`);
  }

  /**
   * Track payment completion
   */
  async trackPaymentCompleted(amount: number, currency: string = 'USD', paymentType: string = 'subscription'): Promise<void> {
    await this.putMetric({
      MetricName: 'PaymentCompletions',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Currency', Value: currency },
        { Name: 'PaymentType', Value: paymentType },
        { Name: 'Environment', Value: this.config.environment }
      ]
    });

    await this.putMetric({
      MetricName: 'Revenue',
      Value: amount,
      Unit: 'None', // Currency amount
      Dimensions: [
        { Name: 'Currency', Value: currency },
        { Name: 'PaymentType', Value: paymentType },
        { Name: 'Environment', Value: this.config.environment }
      ]
    });

    // Also log for business metrics
    console.log(`INFO PAYMENT_COMPLETED ${amount} ${currency} ${paymentType}`);
  }

  /**
   * Track content upload
   */
  async trackContentUpload(contentType: string, sizeBytes: number, userId: string): Promise<void> {
    await this.putMetric({
      MetricName: 'ContentUploads',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'ContentType', Value: contentType },
        { Name: 'Environment', Value: this.config.environment }
      ]
    });

    await this.putMetric({
      MetricName: 'ContentSize',
      Value: sizeBytes,
      Unit: 'Bytes',
      Dimensions: [
        { Name: 'ContentType', Value: contentType },
        { Name: 'Environment', Value: this.config.environment }
      ]
    });

    // Also log for business metrics
    console.log(`INFO CONTENT_UPLOADED ${contentType} ${sizeBytes} ${userId}`);
  }

  /**
   * Track subscription creation
   */
  async trackSubscriptionCreated(userId: string, creatorId: string, tier?: string): Promise<void> {
    const dimensions = [
      { Name: 'Environment', Value: this.config.environment }
    ];

    if (tier) {
      dimensions.push({ Name: 'Tier', Value: tier });
    }

    await this.putMetric({
      MetricName: 'NewSubscriptions',
      Value: 1,
      Unit: 'Count',
      Dimensions: dimensions
    });

    // Also log for business metrics
    console.log(`INFO SUBSCRIPTION_CREATED ${userId} ${creatorId} ${tier || 'basic'}`);
  }

  /**
   * Track API error
   */
  async trackAPIError(endpoint: string, errorCode: string, errorMessage?: string): Promise<void> {
    await this.putMetric({
      MetricName: 'APIErrors',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Endpoint', Value: endpoint },
        { Name: 'ErrorCode', Value: errorCode },
        { Name: 'Environment', Value: this.config.environment }
      ]
    });

    // Also log for application metrics
    console.error(`ERROR API_ERROR ${endpoint} ${errorCode} ${errorMessage || ''}`);
  }

  /**
   * Track slow query
   */
  async trackSlowQuery(query: string, duration: number, threshold: number = 1000): Promise<void> {
    if (duration > threshold) {
      await this.putMetric({
        MetricName: 'SlowQueries',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Environment', Value: this.config.environment }
        ]
      });

      await this.putMetric({
        MetricName: 'QueryDuration',
        Value: duration,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'Environment', Value: this.config.environment }
        ]
      });

      // Also log for application metrics
      console.warn(`WARN SLOW_QUERY ${duration}ms ${query.substring(0, 100)}`);
    }
  }

  /**
   * Get metric statistics
   */
  async getMetricStatistics(
    metricName: string,
    startTime: Date,
    endTime: Date,
    period: number = 300,
    statistic: string = 'Average'
  ): Promise<any> {
    try {
      const command = new GetMetricStatisticsCommand({
        Namespace: this.config.namespace,
        MetricName: metricName,
        StartTime: startTime,
        EndTime: endTime,
        Period: period,
        Statistics: [statistic]
      });

      const response = await this.cloudWatchClient.send(command);
      return response.Datapoints;
    } catch (error) {
      console.error(`Failed to get metric statistics for ${metricName}:`, error);
      return [];
    }
  }

  /**
   * Create custom dashboard widget data
   */
  async getDashboardData(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<any> {
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const metrics = [
      'ActiveUsers',
      'StreamStarts',
      'NewSubscriptions',
      'ContentUploads',
      'APIErrors',
      'SlowQueries'
    ];

    const data: any = {};

    for (const metric of metrics) {
      data[metric] = await this.getMetricStatistics(
        metric,
        startTime,
        now,
        timeRange === 'hour' ? 300 : 3600 // 5 min for hour, 1 hour for day/week
      );
    }

    return data;
  }

  /**
   * Utility function to chunk array
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Health check for monitoring service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Send a test metric
      await this.putMetric({
        MetricName: 'HealthCheck',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Service', Value: 'MonitoringService' },
          { Name: 'Environment', Value: this.config.environment }
        ]
      });
      return true;
    } catch (error) {
      console.error('Monitoring service health check failed:', error);
      return false;
    }
  }
}

// Singleton instance for application use
let monitoringServiceInstance: CloudWatchMonitoringService | null = null;

export function getMonitoringService(): CloudWatchMonitoringService {
  if (!monitoringServiceInstance) {
    const config: MonitoringConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      namespace: `${process.env.PROJECT_NAME || 'direct-fan-platform'}/Business`,
      environment: process.env.NODE_ENV || 'development'
    };

    monitoringServiceInstance = new CloudWatchMonitoringService(config);
  }

  return monitoringServiceInstance;
}

// Export types for use in other modules
export type { MetricData, BusinessMetrics, ApplicationMetrics, MonitoringConfig };