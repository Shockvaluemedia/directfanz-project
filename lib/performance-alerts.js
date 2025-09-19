/**
 * Performance Alerts & Notifications
 *
 * Comprehensive alerting system for database performance issues
 * with multiple notification channels (email, webhook, console)
 */

import fs from 'fs/promises';
import path from 'path';

class PerformanceAlerts {
  constructor(options = {}) {
    this.options = {
      // Thresholds
      slowQueryThreshold: options.slowQueryThreshold || 2000, // 2 seconds
      highErrorRateThreshold: options.highErrorRateThreshold || 0.05, // 5%
      connectionPoolThreshold: options.connectionPoolThreshold || 0.8, // 80%
      degradationThreshold: options.degradationThreshold || 2.0, // 2x slower

      // Alert cooldown periods (to prevent spam)
      slowQueryCooldown: options.slowQueryCooldown || 5 * 60 * 1000, // 5 minutes
      errorRateCooldown: options.errorRateCooldown || 10 * 60 * 1000, // 10 minutes
      degradationCooldown: options.degradationCooldown || 15 * 60 * 1000, // 15 minutes

      // Notification channels
      enableConsole: options.enableConsole !== false,
      enableEmail: options.enableEmail || false,
      enableWebhook: options.enableWebhook || false,
      enableFile: options.enableFile || false,

      // Channel configurations
      emailConfig: options.emailConfig || {},
      webhookConfig: options.webhookConfig || {},
      fileConfig: options.fileConfig || { path: 'logs/alerts.log' },

      ...options,
    };

    this.alertHistory = [];
    this.lastAlertTimes = new Map(); // Track cooldowns
    this.alertStats = {
      total: 0,
      bySeverity: { critical: 0, warning: 0, info: 0 },
      byType: {},
    };
  }

  async sendAlert(type, severity, data, context = {}) {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Check cooldown
    const cooldownKey = `${type}_${JSON.stringify(data)}`;
    const cooldownPeriod = this.getCooldownPeriod(type);
    const lastAlertTime = this.lastAlertTimes.get(cooldownKey);

    if (lastAlertTime && Date.now() - lastAlertTime < cooldownPeriod) {
      console.debug(`Alert ${type} is in cooldown period`);
      return null;
    }

    this.lastAlertTimes.set(cooldownKey, Date.now());

    const alert = {
      id: alertId,
      type,
      severity,
      data,
      context,
      timestamp,
      channels: [],
    };

    // Update statistics
    this.alertStats.total++;
    this.alertStats.bySeverity[severity] = (this.alertStats.bySeverity[severity] || 0) + 1;
    this.alertStats.byType[type] = (this.alertStats.byType[type] || 0) + 1;

    // Send through enabled channels
    const results = await Promise.allSettled([
      this.sendConsoleAlert(alert),
      this.sendEmailAlert(alert),
      this.sendWebhookAlert(alert),
      this.sendFileAlert(alert),
    ]);

    // Track successful channels
    const channels = ['console', 'email', 'webhook', 'file'];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        alert.channels.push(channels[index]);
      }
    });

    // Store alert history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 500) {
      this.alertHistory.shift();
    }

    return alert;
  }

  getCooldownPeriod(type) {
    switch (type) {
      case 'slow_query':
        return this.options.slowQueryCooldown;
      case 'high_error_rate':
        return this.options.errorRateCooldown;
      case 'performance_degradation':
        return this.options.degradationCooldown;
      default:
        return 5 * 60 * 1000; // 5 minutes default
    }
  }

  async sendConsoleAlert(alert) {
    if (!this.options.enableConsole) return false;

    const icon = this.getSeverityIcon(alert.severity);
    const color = this.getSeverityColor(alert.severity);

    console.log(
      `\n${icon} ${color}PERFORMANCE ALERT [${alert.type.toUpperCase()}]${this.colors.reset}`
    );
    console.log(`   Severity: ${alert.severity.toUpperCase()}`);
    console.log(`   Time: ${alert.timestamp}`);
    console.log(`   Data:`, JSON.stringify(alert.data, null, 2));

    if (alert.context && Object.keys(alert.context).length > 0) {
      console.log(`   Context:`, JSON.stringify(alert.context, null, 2));
    }

    return true;
  }

  async sendEmailAlert(alert) {
    if (!this.options.enableEmail || !this.options.emailConfig.enabled) return false;

    try {
      // This would integrate with your email service (SendGrid, SES, etc.)
      const emailData = {
        to: this.options.emailConfig.recipients,
        subject: `[${alert.severity.toUpperCase()}] Performance Alert: ${alert.type}`,
        html: this.generateEmailHTML(alert),
        text: this.generateEmailText(alert),
      };

      // Example integration (you'd replace this with your email service)
      console.log('📧 Email alert would be sent:', emailData.subject);

      // Uncomment and modify for actual email sending:
      // await yourEmailService.send(emailData);

      return true;
    } catch (error) {
      console.error('Failed to send email alert:', error);
      return false;
    }
  }

  async sendWebhookAlert(alert) {
    if (!this.options.enableWebhook || !this.options.webhookConfig.url) return false;

    try {
      const payload = {
        alert_type: 'database_performance',
        severity: alert.severity,
        event: alert.type,
        timestamp: alert.timestamp,
        data: alert.data,
        context: alert.context,
        alert_id: alert.id,
      };

      // Example webhook call (you'd replace this with actual HTTP request)
      console.log('🔗 Webhook alert would be sent to:', this.options.webhookConfig.url);
      console.log('   Payload:', JSON.stringify(payload, null, 2));

      // Uncomment and modify for actual webhook:
      // const response = await fetch(this.options.webhookConfig.url, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'User-Agent': 'Nahvee-Performance-Monitor/1.0',
      //     ...this.options.webhookConfig.headers
      //   },
      //   body: JSON.stringify(payload)
      // });
      //
      // if (!response.ok) {
      //   throw new Error(`Webhook failed: ${response.status}`);
      // }

      return true;
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
      return false;
    }
  }

  async sendFileAlert(alert) {
    if (!this.options.enableFile) return false;

    try {
      const logEntry = {
        timestamp: alert.timestamp,
        level: 'ALERT',
        severity: alert.severity,
        type: alert.type,
        alert_id: alert.id,
        data: alert.data,
        context: alert.context,
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      const logDir = path.dirname(this.options.fileConfig.path);

      await fs.mkdir(logDir, { recursive: true });
      await fs.appendFile(this.options.fileConfig.path, logLine);

      return true;
    } catch (error) {
      console.error('Failed to write alert to file:', error);
      return false;
    }
  }

  generateEmailHTML(alert) {
    const severityColor =
      {
        critical: '#dc2626',
        warning: '#d97706',
        info: '#0284c7',
      }[alert.severity] || '#6b7280';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${severityColor}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">Performance Alert</h1>
          <p style="margin: 4px 0 0 0; opacity: 0.9;">${alert.type.replace(/_/g, ' ').toUpperCase()}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <div style="margin-bottom: 16px;">
            <strong>Severity:</strong> <span style="color: ${severityColor};">${alert.severity.toUpperCase()}</span>
          </div>
          
          <div style="margin-bottom: 16px;">
            <strong>Time:</strong> ${alert.timestamp}
          </div>
          
          <div style="margin-bottom: 16px;">
            <strong>Details:</strong>
            <pre style="background: #ffffff; padding: 12px; border: 1px solid #d1d5db; border-radius: 4px; overflow-x: auto; font-size: 12px;">${JSON.stringify(alert.data, null, 2)}</pre>
          </div>
          
          ${
            alert.context && Object.keys(alert.context).length > 0
              ? `
            <div>
              <strong>Context:</strong>
              <pre style="background: #ffffff; padding: 12px; border: 1px solid #d1d5db; border-radius: 4px; overflow-x: auto; font-size: 12px;">${JSON.stringify(alert.context, null, 2)}</pre>
            </div>
          `
              : ''
          }
        </div>
        
        <div style="margin-top: 16px; padding: 16px; background: #f3f4f6; border-radius: 8px; font-size: 12px; color: #6b7280;">
          This alert was generated by Nahvee Even Performance Monitor. 
          Alert ID: ${alert.id}
        </div>
      </div>
    `;
  }

  generateEmailText(alert) {
    return `
PERFORMANCE ALERT: ${alert.type.replace(/_/g, ' ').toUpperCase()}
Severity: ${alert.severity.toUpperCase()}
Time: ${alert.timestamp}
Alert ID: ${alert.id}

Details:
${JSON.stringify(alert.data, null, 2)}

${
  alert.context && Object.keys(alert.context).length > 0
    ? `
Context:
${JSON.stringify(alert.context, null, 2)}
`
    : ''
}

---
This alert was generated by Nahvee Even Performance Monitor.
    `.trim();
  }

  getSeverityIcon(severity) {
    const icons = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return icons[severity] || '📊';
  }

  getSeverityColor(severity) {
    if (!this.colors) {
      this.colors = {
        reset: '\x1b[0m',
        critical: '\x1b[31m', // Red
        warning: '\x1b[33m', // Yellow
        info: '\x1b[36m', // Cyan
      };
    }
    return this.colors[severity] || this.colors.reset;
  }

  // Alert type handlers
  async alertSlowQuery(queryKey, duration, threshold, context = {}) {
    const severity = duration > threshold * 3 ? 'critical' : 'warning';

    return this.sendAlert(
      'slow_query',
      severity,
      {
        query: queryKey,
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${threshold}ms`,
        performance_impact: 'high',
      },
      context
    );
  }

  async alertHighErrorRate(queryKey, errorRate, threshold, totalQueries, errorCount, context = {}) {
    const severity = errorRate > threshold * 2 ? 'critical' : 'warning';

    return this.sendAlert(
      'high_error_rate',
      severity,
      {
        query: queryKey,
        error_rate: `${(errorRate * 100).toFixed(2)}%`,
        threshold: `${(threshold * 100).toFixed(2)}%`,
        total_queries: totalQueries,
        error_count: errorCount,
      },
      context
    );
  }

  async alertPerformanceDegradation(queryKey, recentAvg, olderAvg, factor, context = {}) {
    const severity = factor > 5 ? 'critical' : 'warning';

    return this.sendAlert(
      'performance_degradation',
      severity,
      {
        query: queryKey,
        recent_avg: `${recentAvg.toFixed(2)}ms`,
        previous_avg: `${olderAvg.toFixed(2)}ms`,
        degradation_factor: `${factor}x slower`,
        trend: 'degrading',
      },
      context
    );
  }

  async alertConnectionPoolHigh(usage, threshold, activeConnections, maxConnections, context = {}) {
    const severity = usage > 0.95 ? 'critical' : 'warning';

    return this.sendAlert(
      'high_connection_pool_usage',
      severity,
      {
        pool_usage: `${(usage * 100).toFixed(1)}%`,
        threshold: `${(threshold * 100).toFixed(1)}%`,
        active_connections: activeConnections,
        max_connections: maxConnections,
      },
      context
    );
  }

  async alertDatabaseHealth(status, healthMetrics, context = {}) {
    const severity =
      status === 'unhealthy' ? 'critical' : status === 'degraded' ? 'warning' : 'info';

    return this.sendAlert(
      'database_health_issue',
      severity,
      {
        status,
        success_rate: `${healthMetrics.successRate || 0}%`,
        avg_response_time: `${healthMetrics.averageResponseTime || 0}ms`,
        active_alerts: healthMetrics.activeAlerts || 0,
      },
      context
    );
  }

  // Configuration and management
  updateConfig(newConfig) {
    this.options = { ...this.options, ...newConfig };
  }

  getAlertStats() {
    return {
      ...this.alertStats,
      recent_alerts: this.alertHistory.slice(-10),
      cooldowns_active: this.lastAlertTimes.size,
    };
  }

  getAlertHistory(limit = 50) {
    return this.alertHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  clearAlertHistory() {
    this.alertHistory = [];
    this.alertStats = {
      total: 0,
      bySeverity: { critical: 0, warning: 0, info: 0 },
      byType: {},
    };
  }

  // Test alert functionality
  async testAlerts() {
    console.log('🧪 Testing alert system...');

    const testAlert = await this.sendAlert('test_alert', 'info', {
      message: 'This is a test alert to verify the alerting system is working',
      test_timestamp: new Date().toISOString(),
    });

    if (testAlert) {
      console.log(`✅ Test alert sent successfully (ID: ${testAlert.id})`);
      console.log(`   Channels used: ${testAlert.channels.join(', ')}`);
      return testAlert;
    } else {
      console.log('❌ Test alert failed to send');
      return null;
    }
  }
}

// Create singleton instance
const performanceAlerts = new PerformanceAlerts({
  // Load configuration from environment variables
  slowQueryThreshold: parseInt(process.env.ALERT_SLOW_QUERY_THRESHOLD) || 2000,
  highErrorRateThreshold: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.05,

  enableConsole: process.env.ALERT_CONSOLE !== 'false',
  enableEmail: process.env.ALERT_EMAIL === 'true',
  enableWebhook: process.env.ALERT_WEBHOOK === 'true',
  enableFile: process.env.ALERT_FILE === 'true',

  emailConfig: {
    enabled: process.env.ALERT_EMAIL === 'true',
    recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
  },

  webhookConfig: {
    url: process.env.ALERT_WEBHOOK_URL,
    headers: process.env.ALERT_WEBHOOK_HEADERS ? JSON.parse(process.env.ALERT_WEBHOOK_HEADERS) : {},
  },
});

export { PerformanceAlerts, performanceAlerts };
