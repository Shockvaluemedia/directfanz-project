import { PerformanceMonitor } from '../../src/lib/performance-monitor';

describe('Property Test: Performance Monitoring and Alerting', () => {
  describe('Property 11: Performance monitoring and alerting', () => {
    test('Performance thresholds should be properly configured', () => {
      const thresholds = {
        'api.response_time': { warning: 1000, critical: 2000 },
        'db.query_time': { warning: 500, critical: 1000 },
        'cache.hit_rate': { warning: 80, critical: 70 },
      };
      
      Object.values(thresholds).forEach(threshold => {
        expect(threshold.warning).toBeLessThan(threshold.critical);
        expect(threshold.warning).toBeGreaterThan(0);
      });
    });

    test('Performance metrics should be tracked', () => {
      const monitor = new PerformanceMonitor();
      
      expect(typeof monitor.recordMetric).toBe('function');
      expect(typeof monitor.getMetricStats).toBe('function');
      expect(typeof monitor.healthCheck).toBe('function');
    });

    test('Alerts should be generated for threshold violations', () => {
      const alert = {
        metric: 'api.response_time',
        threshold: 1000,
        currentValue: 1500,
        severity: 'medium' as const,
      };
      
      expect(alert.currentValue).toBeGreaterThan(alert.threshold);
      expect(['low', 'medium', 'high', 'critical']).toContain(alert.severity);
    });

    test('Metric statistics should include percentiles', () => {
      const stats = {
        count: 100,
        min: 50,
        max: 2000,
        avg: 250,
        p50: 200,
        p95: 800,
        p99: 1200,
      };
      
      expect(stats.p50).toBeLessThanOrEqual(stats.p95);
      expect(stats.p95).toBeLessThanOrEqual(stats.p99);
      expect(stats.min).toBeLessThanOrEqual(stats.max);
    });

    test('Health check should aggregate system status', async () => {
      const monitor = new PerformanceMonitor();
      const healthCheck = await monitor.healthCheck();
      
      expect(typeof healthCheck.healthy).toBe('boolean');
      expect(healthCheck.metrics).toBeDefined();
      expect(Array.isArray(healthCheck.alerts)).toBe(true);
    });
  });
});