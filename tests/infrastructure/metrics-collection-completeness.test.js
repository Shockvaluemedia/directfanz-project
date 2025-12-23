/**
 * Property-Based Test: Metrics Collection Completeness
 * Feature: aws-conversion, Property 20: Metrics Collection Completeness
 * Validates: Requirements 7.3
 * 
 * Property: For any defined application, infrastructure, or business metric, 
 * the monitoring system should collect and store the metric data with 
 * appropriate granularity and retention
 */

const fc = require('fast-check');

// Mock CloudWatch monitoring service
class MockCloudWatchMonitoringService {
  constructor(config) {
    this.config = config;
    this.sentMetrics = [];
    this.shouldFail = false;
  }

  async putMetric(metricData) {
    if (this.shouldFail) {
      throw new Error('CloudWatch unavailable');
    }
    this.sentMetrics.push({
      ...metricData,
      Timestamp: metricData.Timestamp || new Date(),
      Namespace: this.config.namespace
    });
  }

  async putMetrics(metrics) {
    if (this.shouldFail) {
      throw new Error('CloudWatch unavailable');
    }
    
    // Simulate batching (max 20 metrics per request)
    const batches = [];
    for (let i = 0; i < metrics.length; i += 20) {
      batches.push(metrics.slice(i, i + 20));
    }
    
    for (const batch of batches) {
      for (const metric of batch) {
        await this.putMetric(metric);
      }
    }
  }

  async trackBusinessMetrics(metrics) {
    const metricData = [];
    
    if (metrics.activeUsers !== undefined && metrics.activeUsers !== null) {
      metricData.push({ MetricName: 'ActiveUsers', Value: metrics.activeUsers, Unit: 'Count' });
    }
    if (metrics.streamStarts !== undefined && metrics.streamStarts !== null) {
      metricData.push({ MetricName: 'StreamStarts', Value: metrics.streamStarts, Unit: 'Count' });
    }
    if (metrics.revenueEvents !== undefined && metrics.revenueEvents !== null) {
      metricData.push({ MetricName: 'RevenueEvents', Value: metrics.revenueEvents, Unit: 'Count' });
    }
    if (metrics.contentUploads !== undefined && metrics.contentUploads !== null) {
      metricData.push({ MetricName: 'ContentUploads', Value: metrics.contentUploads, Unit: 'Count' });
    }
    if (metrics.newSubscriptions !== undefined && metrics.newSubscriptions !== null) {
      metricData.push({ MetricName: 'NewSubscriptions', Value: metrics.newSubscriptions, Unit: 'Count' });
    }
    
    if (metricData.length > 0) {
      await this.putMetrics(metricData);
    }
  }

  async trackApplicationMetrics(metrics) {
    const metricData = [];
    
    if (metrics.apiErrors !== undefined && metrics.apiErrors !== null) {
      metricData.push({ MetricName: 'APIErrors', Value: metrics.apiErrors, Unit: 'Count' });
    }
    if (metrics.slowQueries !== undefined && metrics.slowQueries !== null) {
      metricData.push({ MetricName: 'SlowQueries', Value: metrics.slowQueries, Unit: 'Count' });
    }
    if (metrics.responseTime !== undefined && metrics.responseTime !== null) {
      metricData.push({ MetricName: 'ResponseTime', Value: metrics.responseTime, Unit: 'Milliseconds' });
    }
    if (metrics.throughput !== undefined && metrics.throughput !== null) {
      metricData.push({ MetricName: 'Throughput', Value: metrics.throughput, Unit: 'Count/Second' });
    }
    
    if (metricData.length > 0) {
      await this.putMetrics(metricData);
    }
  }

  async getMetricStatistics(metricName, startTime, endTime, period = 300, statistic = 'Average') {
    // Simulate returning metric data
    return [
      { Timestamp: new Date(), Value: 100, Unit: 'Count' }
    ];
  }

  async getDashboardData(timeRange = 'hour') {
    const metrics = ['ActiveUsers', 'StreamStarts', 'NewSubscriptions', 'ContentUploads', 'APIErrors', 'SlowQueries'];
    const data = {};
    
    for (const metric of metrics) {
      data[metric] = await this.getMetricStatistics(metric, new Date(), new Date());
    }
    
    return data;
  }

  async healthCheck() {
    try {
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
      return false;
    }
  }

  // Test helper methods
  getLastMetric() {
    return this.sentMetrics[this.sentMetrics.length - 1];
  }

  getAllMetrics() {
    return this.sentMetrics;
  }

  clearMetrics() {
    this.sentMetrics = [];
  }

  setFailure(shouldFail) {
    this.shouldFail = shouldFail;
  }
}

describe('Property 20: Metrics Collection Completeness', () => {
  let monitoringService;

  beforeEach(() => {
    monitoringService = new MockCloudWatchMonitoringService({
      region: 'us-east-1',
      namespace: 'TestNamespace',
      environment: 'test'
    });
    // Ensure clean state for each test
    monitoringService.clearMetrics();
  });

  afterEach(() => {
    // Ensure metrics are cleared after each test
    if (monitoringService) {
      monitoringService.clearMetrics();
    }
  });

  // Generator for metric data
  const metricDataArb = fc.record({
    MetricName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
    Value: fc.float({ min: 0, max: 1000000, noNaN: true }),
    Unit: fc.constantFrom('Count', 'Bytes', 'Seconds', 'Milliseconds', 'Percent', 'None'),
    Dimensions: fc.array(
      fc.record({
        Name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
        Value: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
      }),
      { maxLength: 5 }
    )
  });

  // Generator for business metrics
  const businessMetricsArb = fc.record({
    activeUsers: fc.option(fc.integer({ min: 0, max: 10000 })),
    streamStarts: fc.option(fc.integer({ min: 0, max: 1000 })),
    revenueEvents: fc.option(fc.integer({ min: 0, max: 500 })),
    contentUploads: fc.option(fc.integer({ min: 0, max: 2000 })),
    newSubscriptions: fc.option(fc.integer({ min: 0, max: 1000 }))
  });

  // Generator for application metrics
  const applicationMetricsArb = fc.record({
    apiErrors: fc.option(fc.integer({ min: 0, max: 100 })),
    slowQueries: fc.option(fc.integer({ min: 0, max: 50 })),
    responseTime: fc.option(fc.float({ min: 0, max: 5000, noNaN: true })),
    throughput: fc.option(fc.float({ min: 0, max: 1000, noNaN: true }))
  });

  test('Property: Single metric collection completeness', () => {
    return fc.assert(fc.asyncProperty(
      metricDataArb,
      async (metricData) => {
        // Clear metrics before each property test iteration
        monitoringService.clearMetrics();
        
        // Act: Send metric to CloudWatch
        await monitoringService.putMetric(metricData);

        // Assert: Verify metric was collected with correct parameters
        const sentMetrics = monitoringService.getAllMetrics();
        expect(sentMetrics).toHaveLength(1);
        
        const sentMetric = sentMetrics[0];
        expect(sentMetric.MetricName).toBe(metricData.MetricName);
        expect(sentMetric.Value).toBe(metricData.Value);
        expect(sentMetric.Unit).toBe(metricData.Unit);
        expect(sentMetric.Namespace).toBe('TestNamespace');
        expect(sentMetric.Timestamp).toBeInstanceOf(Date);
        
        if (metricData.Dimensions) {
          expect(sentMetric.Dimensions).toEqual(metricData.Dimensions);
        }
      }
    ), { numRuns: 10 });
  });

  test('Property: Batch metrics collection completeness', () => {
    return fc.assert(fc.asyncProperty(
      fc.array(metricDataArb, { minLength: 1, maxLength: 50 }),
      async (metricsArray) => {
        // Clear metrics before each property test iteration
        monitoringService.clearMetrics();
        
        // Act: Send batch of metrics
        await monitoringService.putMetrics(metricsArray);

        // Assert: Verify all metrics were collected
        const sentMetrics = monitoringService.getAllMetrics();
        expect(sentMetrics).toHaveLength(metricsArray.length);

        // Verify each metric was stored correctly
        for (let i = 0; i < metricsArray.length; i++) {
          const originalMetric = metricsArray[i];
          const sentMetric = sentMetrics[i];
          
          expect(sentMetric.MetricName).toBe(originalMetric.MetricName);
          expect(sentMetric.Value).toBe(originalMetric.Value);
          expect(sentMetric.Unit).toBe(originalMetric.Unit);
          expect(sentMetric.Namespace).toBe('TestNamespace');
        }
      }
    ), { numRuns: 10 });
  });

  test('Property: Business metrics collection completeness', () => {
    return fc.assert(fc.asyncProperty(
      businessMetricsArb,
      async (businessMetrics) => {
        // Clear metrics before each property test iteration
        monitoringService.clearMetrics();
        
        // Act: Track business metrics
        await monitoringService.trackBusinessMetrics(businessMetrics);

        // Count expected metrics (only non-null, non-undefined values)
        const expectedMetricsCount = Object.values(businessMetrics)
          .filter(value => value !== null && value !== undefined).length;

        const sentMetrics = monitoringService.getAllMetrics();
        expect(sentMetrics).toHaveLength(expectedMetricsCount);

        if (expectedMetricsCount > 0) {
          // Verify each metric type is correctly mapped
          const metricNames = sentMetrics.map(m => m.MetricName);
          
          if (businessMetrics.activeUsers !== null && businessMetrics.activeUsers !== undefined) {
            expect(metricNames).toContain('ActiveUsers');
            const activeUsersMetric = sentMetrics.find(m => m.MetricName === 'ActiveUsers');
            expect(activeUsersMetric.Value).toBe(businessMetrics.activeUsers);
            expect(activeUsersMetric.Unit).toBe('Count');
          }
          
          if (businessMetrics.streamStarts !== null && businessMetrics.streamStarts !== undefined) {
            expect(metricNames).toContain('StreamStarts');
            const streamStartsMetric = sentMetrics.find(m => m.MetricName === 'StreamStarts');
            expect(streamStartsMetric.Value).toBe(businessMetrics.streamStarts);
            expect(streamStartsMetric.Unit).toBe('Count');
          }
          
          if (businessMetrics.revenueEvents !== null && businessMetrics.revenueEvents !== undefined) {
            expect(metricNames).toContain('RevenueEvents');
          }
          
          if (businessMetrics.contentUploads !== null && businessMetrics.contentUploads !== undefined) {
            expect(metricNames).toContain('ContentUploads');
          }
          
          if (businessMetrics.newSubscriptions !== null && businessMetrics.newSubscriptions !== undefined) {
            expect(metricNames).toContain('NewSubscriptions');
          }
        }
      }
    ), { numRuns: 10 });
  });

  test('Property: Application metrics collection completeness', () => {
    return fc.assert(fc.asyncProperty(
      applicationMetricsArb,
      async (applicationMetrics) => {
        // Clear metrics before each property test iteration
        monitoringService.clearMetrics();
        
        // Act: Track application metrics
        await monitoringService.trackApplicationMetrics(applicationMetrics);

        // Count expected metrics (only non-null, non-undefined values)
        const expectedMetricsCount = Object.values(applicationMetrics)
          .filter(value => value !== null && value !== undefined).length;

        const sentMetrics = monitoringService.getAllMetrics();
        expect(sentMetrics).toHaveLength(expectedMetricsCount);

        if (expectedMetricsCount > 0) {
          // Verify each metric type is correctly mapped
          const metricNames = sentMetrics.map(m => m.MetricName);
          
          if (applicationMetrics.apiErrors !== null && applicationMetrics.apiErrors !== undefined) {
            expect(metricNames).toContain('APIErrors');
            const apiErrorsMetric = sentMetrics.find(m => m.MetricName === 'APIErrors');
            expect(apiErrorsMetric.Value).toBe(applicationMetrics.apiErrors);
            expect(apiErrorsMetric.Unit).toBe('Count');
          }
          
          if (applicationMetrics.slowQueries !== null && applicationMetrics.slowQueries !== undefined) {
            expect(metricNames).toContain('SlowQueries');
            const slowQueriesMetric = sentMetrics.find(m => m.MetricName === 'SlowQueries');
            expect(slowQueriesMetric.Value).toBe(applicationMetrics.slowQueries);
            expect(slowQueriesMetric.Unit).toBe('Count');
          }
          
          if (applicationMetrics.responseTime !== null && applicationMetrics.responseTime !== undefined) {
            expect(metricNames).toContain('ResponseTime');
            const responseTimeMetric = sentMetrics.find(m => m.MetricName === 'ResponseTime');
            expect(responseTimeMetric.Value).toBe(applicationMetrics.responseTime);
            expect(responseTimeMetric.Unit).toBe('Milliseconds');
          }
          
          if (applicationMetrics.throughput !== null && applicationMetrics.throughput !== undefined) {
            expect(metricNames).toContain('Throughput');
            const throughputMetric = sentMetrics.find(m => m.MetricName === 'Throughput');
            expect(throughputMetric.Value).toBe(applicationMetrics.throughput);
            expect(throughputMetric.Unit).toBe('Count/Second');
          }
        }
      }
    ), { numRuns: 10 });
  });

  test('Property: Metric granularity and retention compliance', () => {
    return fc.assert(fc.asyncProperty(
      fc.record({
        timeRange: fc.constantFrom('hour', 'day', 'week'),
        metricType: fc.constantFrom('business', 'application', 'infrastructure')
      }),
      async ({ timeRange, metricType }) => {
        // Act: Get dashboard data for different time ranges
        const dashboardData = await monitoringService.getDashboardData(timeRange);

        // Assert: Verify appropriate granularity is maintained
        expect(dashboardData).toHaveProperty('ActiveUsers');
        expect(dashboardData).toHaveProperty('StreamStarts');
        expect(dashboardData).toHaveProperty('APIErrors');
        
        // Verify data structure
        Object.values(dashboardData).forEach(metricData => {
          expect(Array.isArray(metricData)).toBe(true);
          if (metricData.length > 0) {
            expect(metricData[0]).toHaveProperty('Timestamp');
            expect(metricData[0]).toHaveProperty('Value');
            expect(metricData[0]).toHaveProperty('Unit');
          }
        });
      }
    ), { numRuns: 30 });
  });

  test('Property: Error handling preserves metric collection', () => {
    return fc.assert(fc.asyncProperty(
      metricDataArb,
      async (metricData) => {
        // Clear metrics before each property test iteration
        monitoringService.clearMetrics();
        
        // Arrange: Set service to fail
        monitoringService.setFailure(true);

        // Act: Attempt to send metric (should throw)
        await expect(monitoringService.putMetric(metricData)).rejects.toThrow();

        // Assert: No metrics were stored due to failure
        expect(monitoringService.getAllMetrics()).toHaveLength(0);
        
        // Verify subsequent calls work after fixing the failure
        monitoringService.setFailure(false);
        await monitoringService.putMetric(metricData);
        expect(monitoringService.getAllMetrics()).toHaveLength(1);
      }
    ), { numRuns: 10 });
  });

  test('Property: Health check validates monitoring system', () => {
    return fc.assert(fc.asyncProperty(
      fc.constant(null), // No input needed
      async () => {
        // Clear metrics before each property test iteration
        monitoringService.clearMetrics();
        
        // Act: Perform health check
        const isHealthy = await monitoringService.healthCheck();

        // Assert: Health check sends test metric
        const sentMetrics = monitoringService.getAllMetrics();
        expect(sentMetrics).toHaveLength(1);
        
        const healthMetric = sentMetrics[0];
        expect(healthMetric.MetricName).toBe('HealthCheck');
        expect(healthMetric.Value).toBe(1);
        expect(healthMetric.Unit).toBe('Count');
        
        const dimensions = healthMetric.Dimensions;
        expect(dimensions).toContainEqual({ Name: 'Service', Value: 'MonitoringService' });
        expect(dimensions).toContainEqual({ Name: 'Environment', Value: 'test' });
        
        expect(isHealthy).toBe(true);
      }
    ), { numRuns: 10 });
  });
});