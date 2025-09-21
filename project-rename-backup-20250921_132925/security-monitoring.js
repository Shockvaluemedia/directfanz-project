#!/usr/bin/env node

/**
 * Security Monitoring and Alerting System for DirectFanz
 * Monitors security events, logs, and system health
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityMonitor {
  constructor() {
    this.alertThresholds = {
      failedLogins: 5,
      rateLimitViolations: 10,
      suspiciousIPs: 3,
      vulnerabilities: 1,
      diskUsage: 85,
      memoryUsage: 90
    };

    this.logFile = path.join(__dirname, '../logs/security-monitor.log');
    this.alertsFile = path.join(__dirname, '../logs/security-alerts.log');
    
    // Ensure log directories exist
    this.ensureLogDirectories();
  }

  ensureLogDirectories() {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid,
      hostname: require('os').hostname()
    };

    // Write to log file
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');

    // Console output with colors
    const colors = {
      ERROR: '\x1b[31m',
      WARN: '\x1b[33m',
      INFO: '\x1b[36m',
      DEBUG: '\x1b[37m'
    };
    
    console.log(`${colors[level] || ''}[${timestamp}] ${level}: ${message}\x1b[0m`);
    
    if (Object.keys(data).length > 0) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  alert(severity, title, description, data = {}) {
    const alert = {
      timestamp: new Date().toISOString(),
      severity,
      title,
      description,
      data,
      resolved: false,
      id: this.generateAlertId()
    };

    // Write to alerts file
    fs.appendFileSync(this.alertsFile, JSON.stringify(alert) + '\n');

    this.log('ERROR', `SECURITY ALERT: ${title}`, {
      severity,
      description,
      alertId: alert.id,
      ...data
    });

    // Send notifications based on severity
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      this.sendNotification(alert);
    }

    return alert.id;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async sendNotification(alert) {
    // In production, integrate with your notification system
    // (Slack, Discord, email, PagerDuty, etc.)
    
    this.log('INFO', 'Notification would be sent for alert', {
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title
    });

    // Example webhook notification (uncomment and configure)
    /*
    try {
      const webhook = process.env.SECURITY_WEBHOOK_URL;
      if (webhook) {
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Security Alert: ${alert.title}`,
            attachments: [{
              color: alert.severity === 'CRITICAL' ? 'danger' : 'warning',
              fields: [
                { title: 'Severity', value: alert.severity, short: true },
                { title: 'Description', value: alert.description, short: false },
                { title: 'Time', value: alert.timestamp, short: true }
              ]
            }]
          })
        });
      }
    } catch (error) {
      this.log('ERROR', 'Failed to send webhook notification', { error: error.message });
    }
    */
  }

  async checkDependencyVulnerabilities() {
    this.log('INFO', 'Checking for dependency vulnerabilities...');
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      const vulnerabilities = audit.vulnerabilities || {};
      const vulnCount = Object.keys(vulnerabilities).length;
      
      if (vulnCount > this.alertThresholds.vulnerabilities) {
        const criticalVulns = Object.values(vulnerabilities)
          .filter(v => v.severity === 'critical' || v.severity === 'high');
        
        if (criticalVulns.length > 0) {
          this.alert(
            'HIGH',
            'Critical Dependencies Vulnerabilities Found',
            `Found ${criticalVulns.length} critical/high severity vulnerabilities`,
            { vulnerabilityCount: vulnCount, critical: criticalVulns.length }
          );
        }
      }
      
      this.log('INFO', 'Dependency vulnerability check complete', {
        totalVulnerabilities: vulnCount,
        criticalHigh: Object.values(vulnerabilities)
          .filter(v => v.severity === 'critical' || v.severity === 'high').length
      });

    } catch (error) {
      this.log('ERROR', 'Failed to check dependency vulnerabilities', {
        error: error.message
      });
    }
  }

  async checkSystemResources() {
    this.log('DEBUG', 'Checking system resources...');
    
    try {
      // Check disk usage
      const diskUsage = execSync("df -h / | awk 'NR==2{print $5}' | sed 's/%//'", { encoding: 'utf8' }).trim();
      const diskPercent = parseInt(diskUsage);
      
      if (diskPercent > this.alertThresholds.diskUsage) {
        this.alert(
          'WARN',
          'High Disk Usage Detected',
          `Disk usage is at ${diskPercent}%`,
          { diskUsage: diskPercent }
        );
      }

      // Check memory usage
      const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const memTotal = parseInt(memInfo.match(/MemTotal:\s+(\d+)/)[1]);
      const memAvail = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)[1]);
      const memPercent = Math.round(((memTotal - memAvail) / memTotal) * 100);
      
      if (memPercent > this.alertThresholds.memoryUsage) {
        this.alert(
          'WARN',
          'High Memory Usage Detected',
          `Memory usage is at ${memPercent}%`,
          { memoryUsage: memPercent }
        );
      }

      this.log('DEBUG', 'System resources check complete', {
        diskUsage: diskPercent,
        memoryUsage: memPercent
      });

    } catch (error) {
      this.log('WARN', 'Could not check all system resources', {
        error: error.message
      });
    }
  }

  async checkApplicationLogs() {
    this.log('DEBUG', 'Checking application logs for security events...');
    
    try {
      const logFiles = [
        'server.log',
        'dev-server.log',
        'error.log'
      ];

      for (const logFile of logFiles) {
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          const lines = content.split('\n').slice(-1000); // Check last 1000 lines
          
          // Check for suspicious patterns
          const suspiciousPatterns = [
            /rate.?limit/i,
            /authentication.?fail/i,
            /access.?denied/i,
            /unauthorized/i,
            /forbidden/i,
            /sql.?injection/i,
            /xss/i,
            /csrf/i
          ];

          let suspiciousCount = 0;
          const recentTime = Date.now() - (60 * 60 * 1000); // Last hour

          lines.forEach(line => {
            if (suspiciousPatterns.some(pattern => pattern.test(line))) {
              suspiciousCount++;
            }
          });

          if (suspiciousCount > 10) {
            this.alert(
              'WARN',
              'Suspicious Activity Detected in Logs',
              `Found ${suspiciousCount} suspicious log entries in ${logFile}`,
              { logFile, suspiciousCount }
            );
          }
        }
      }

      this.log('DEBUG', 'Application logs check complete');

    } catch (error) {
      this.log('ERROR', 'Failed to check application logs', {
        error: error.message
      });
    }
  }

  async checkEnvironmentSecurity() {
    this.log('DEBUG', 'Checking environment security...');
    
    try {
      const issues = [];

      // Check file permissions on sensitive files
      const sensitiveFiles = [
        '.env',
        '.env.local',
        '.env.production',
        '.env.production.secrets'
      ];

      for (const file of sensitiveFiles) {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          const mode = (stats.mode & parseInt('777', 8)).toString(8);
          
          if (mode !== '600') {
            issues.push(`${file} has insecure permissions: ${mode}`);
          }
        }
      }

      // Check for exposed sensitive files
      const exposedFiles = [
        '.env',
        '.env.local',
        'private.key',
        'id_rsa'
      ];

      for (const file of exposedFiles) {
        try {
          execSync(`git ls-files | grep -q ${file}`, { stdio: 'ignore' });
          issues.push(`Sensitive file ${file} may be tracked in git`);
        } catch (error) {
          // File not tracked, which is good
        }
      }

      if (issues.length > 0) {
        this.alert(
          'MEDIUM',
          'Environment Security Issues Detected',
          `Found ${issues.length} security configuration issues`,
          { issues }
        );
      }

      this.log('DEBUG', 'Environment security check complete', {
        issuesFound: issues.length
      });

    } catch (error) {
      this.log('ERROR', 'Failed to check environment security', {
        error: error.message
      });
    }
  }

  async generateSecurityReport() {
    this.log('INFO', 'Generating security report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        alertsLast24h: 0,
        criticalIssues: 0,
        vulnerabilities: 0,
        systemHealth: 'GOOD'
      },
      recommendations: []
    };

    // Read recent alerts
    try {
      if (fs.existsSync(this.alertsFile)) {
        const alerts = fs.readFileSync(this.alertsFile, 'utf8')
          .split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line))
          .filter(alert => {
            const alertTime = new Date(alert.timestamp);
            const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
            return alertTime.getTime() > dayAgo;
          });

        report.summary.alertsLast24h = alerts.length;
        report.summary.criticalIssues = alerts.filter(a => 
          a.severity === 'CRITICAL' || a.severity === 'HIGH'
        ).length;
      }
    } catch (error) {
      this.log('WARN', 'Could not read alerts for report', { error: error.message });
    }

    // Add recommendations
    if (report.summary.alertsLast24h > 5) {
      report.recommendations.push('Review and address recent security alerts');
    }
    
    if (report.summary.criticalIssues > 0) {
      report.recommendations.push('Immediately address critical security issues');
    }

    report.recommendations.push('Review access logs for unauthorized attempts');
    report.recommendations.push('Verify all security configurations are up to date');
    report.recommendations.push('Run dependency vulnerability scan');

    // Write report
    const reportPath = path.join(__dirname, '../logs/security-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.log('INFO', 'Security report generated', {
      reportPath,
      alertsLast24h: report.summary.alertsLast24h,
      criticalIssues: report.summary.criticalIssues
    });

    return report;
  }

  async runFullSecurityCheck() {
    this.log('INFO', 'Starting full security monitoring check...');
    
    try {
      await this.checkDependencyVulnerabilities();
      await this.checkSystemResources();
      await this.checkApplicationLogs();
      await this.checkEnvironmentSecurity();
      
      const report = await this.generateSecurityReport();
      
      this.log('INFO', 'Security monitoring check complete', {
        alertsGenerated: report.summary.alertsLast24h,
        criticalIssues: report.summary.criticalIssues
      });

      return report;

    } catch (error) {
      this.log('ERROR', 'Security monitoring check failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new SecurityMonitor();
  
  const command = process.argv[2] || 'full';
  
  switch (command) {
    case 'deps':
      monitor.checkDependencyVulnerabilities();
      break;
    case 'system':
      monitor.checkSystemResources();
      break;
    case 'logs':
      monitor.checkApplicationLogs();
      break;
    case 'env':
      monitor.checkEnvironmentSecurity();
      break;
    case 'report':
      monitor.generateSecurityReport();
      break;
    case 'full':
    default:
      monitor.runFullSecurityCheck();
      break;
  }
}

module.exports = SecurityMonitor;