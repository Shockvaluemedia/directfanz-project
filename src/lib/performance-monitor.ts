interface PerformanceAlert {
  metric: string;
  threshold: number;
  currentValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private alerts: PerformanceAlert[] = [];

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
    
    this.checkThresholds(name, value);
  }

  private checkThresholds(metric: string, value: number): void {
    const thresholds = {
      'api.response_time': { warning: 1000, critical: 2000 },
      'db.query_time': { warning: 500, critical: 1000 },
      'cache.hit_rate': { warning: 80, critical: 70 },
      'memory.usage': { warning: 80, critical: 90 },
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return;

    if (value > threshold.critical) {
      this.addAlert({
        metric,
        threshold: threshold.critical,
        currentValue: value,
        severity: 'critical',
      });
    } else if (value > threshold.warning) {
      this.addAlert({
        metric,
        threshold: threshold.warning,
        currentValue: value,
        severity: 'medium',
      });
    }
  }

  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
    
    // Send alert notification
    this.sendAlert(alert);
  }

  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    console.warn(`Performance Alert: ${alert.metric} = ${alert.currentValue} (threshold: ${alert.threshold})`);
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to CloudWatch, Datadog, etc.
    }
  }

  getMetricStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => 
      Date.now() - alert.currentValue < 300000 // Last 5 minutes
    );
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    metrics: Record<string, any>;
    alerts: PerformanceAlert[];
  }> {
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical');
    
    return {
      healthy: criticalAlerts.length === 0,
      metrics: {
        'api.response_time': this.getMetricStats('api.response_time'),
        'db.query_time': this.getMetricStats('db.query_time'),
        'cache.hit_rate': this.getMetricStats('cache.hit_rate'),
      },
      alerts: this.getActiveAlerts(),
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();