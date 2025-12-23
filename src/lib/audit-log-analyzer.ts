/**
 * Audit Log Analyzer Service
 * Implements automated log analysis and threat detection
 * Requirements: 6.5 - Implement log analysis and alerting
 */

import { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface SecurityEvent {
  timestamp: Date;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  details: any;
  userIdentity?: string;
  sourceIP?: string;
  userAgent?: string;
}

interface ThreatPattern {
  name: string;
  pattern: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  action: 'LOG' | 'ALERT' | 'BLOCK';
}

interface AnalysisConfig {
  region: string;
  logGroupName: string;
  snsTopicArn: string;
  analysisIntervalMinutes: number;
  retentionDays: number;
}

export class AuditLogAnalyzer {
  private cloudWatchClient: CloudWatchLogsClient;
  private snsClient: SNSClient;
  private config: AnalysisConfig;
  private threatPatterns: ThreatPattern[];

  constructor(config: AnalysisConfig) {
    this.config = config;
    this.cloudWatchClient = new CloudWatchLogsClient({ 
      region: config.region,
      maxAttempts: 3,
      retryMode: 'adaptive'
    });
    this.snsClient = new SNSClient({ 
      region: config.region,
      maxAttempts: 3,
      retryMode: 'adaptive'
    });
    
    this.initializeThreatPatterns();
  }

  private initializeThreatPatterns(): void {
    this.threatPatterns = [
      {
        name: 'Brute Force Attack',
        pattern: '{ ($.errorCode = "*UnauthorizedOperation") || ($.errorCode = "AccessDenied*") }',
        severity: 'HIGH',
        description: 'Multiple failed authentication attempts detected',
        action: 'ALERT'
      },
      {
        name: 'Root Account Usage',
        pattern: '{ $.userIdentity.type = "Root" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != "AwsServiceEvent" }',
        severity: 'CRITICAL',
        description: 'Root account usage detected',
        action: 'ALERT'
      },
      {
        name: 'Privilege Escalation',
        pattern: '{ ($.eventName = AttachUserPolicy) || ($.eventName = AttachRolePolicy) || ($.eventName = PutUserPolicy) || ($.eventName = PutRolePolicy) }',
        severity: 'HIGH',
        description: 'Potential privilege escalation detected',
        action: 'ALERT'
      },
      {
        name: 'Security Group Modification',
        pattern: '{ ($.eventName = AuthorizeSecurityGroupIngress) || ($.eventName = AuthorizeSecurityGroupEgress) || ($.eventName = RevokeSecurityGroupIngress) || ($.eventName = RevokeSecurityGroupEgress) }',
        severity: 'MEDIUM',
        description: 'Security group rules modified',
        action: 'LOG'
      },
      {
        name: 'Data Exfiltration Attempt',
        pattern: '{ ($.eventName = GetObject) && ($.requestParameters.bucketName = "*content*") && ($.responseElements.bytesTransferred > 1000000) }',
        severity: 'HIGH',
        description: 'Large data download detected',
        action: 'ALERT'
      },
      {
        name: 'Suspicious API Activity',
        pattern: '{ ($.sourceIPAddress != "*.amazonaws.com") && ($.eventName = "*") && ($.errorCode EXISTS) }',
        severity: 'MEDIUM',
        description: 'High error rate from external IP',
        action: 'LOG'
      },
      {
        name: 'CloudTrail Tampering',
        pattern: '{ ($.eventName = StopLogging) || ($.eventName = DeleteTrail) || ($.eventName = UpdateTrail) }',
        severity: 'CRITICAL',
        description: 'CloudTrail configuration modified',
        action: 'ALERT'
      },
      {
        name: 'Unusual Geographic Access',
        pattern: '{ ($.sourceIPAddress != "10.*") && ($.sourceIPAddress != "172.*") && ($.sourceIPAddress != "192.168.*") }',
        severity: 'MEDIUM',
        description: 'Access from unusual geographic location',
        action: 'LOG'
      }
    ];
  }

  /**
   * Analyze logs for security threats
   */
  async analyzeLogs(startTime?: Date, endTime?: Date): Promise<SecurityEvent[]> {
    const events: SecurityEvent[] = [];
    const now = new Date();
    const defaultStartTime = new Date(now.getTime() - (this.config.analysisIntervalMinutes * 60 * 1000));
    
    const actualStartTime = startTime || defaultStartTime;
    const actualEndTime = endTime || now;

    try {
      for (const pattern of this.threatPatterns) {
        const patternEvents = await this.searchLogPattern(
          pattern.pattern,
          actualStartTime,
          actualEndTime
        );

        for (const event of patternEvents) {
          const securityEvent: SecurityEvent = {
            timestamp: new Date(event.timestamp || 0),
            eventType: pattern.name,
            severity: pattern.severity,
            source: 'CloudTrail',
            details: event,
            userIdentity: this.extractUserIdentity(event),
            sourceIP: this.extractSourceIP(event),
            userAgent: this.extractUserAgent(event)
          };

          events.push(securityEvent);

          // Take action based on pattern configuration
          if (pattern.action === 'ALERT') {
            await this.sendSecurityAlert(securityEvent);
          }
        }
      }

      // Analyze for anomalies
      const anomalies = await this.detectAnomalies(events);
      events.push(...anomalies);

      return events;
    } catch (error) {
      console.error('Log analysis failed:', error);
      throw new Error(`Log analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for specific log patterns
   */
  private async searchLogPattern(
    filterPattern: string,
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    try {
      const command = new FilterLogEventsCommand({
        logGroupName: this.config.logGroupName,
        filterPattern,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        limit: 1000
      });

      const response = await this.cloudWatchClient.send(command);
      return response.events?.map(event => {
        try {
          return JSON.parse(event.message || '{}');
        } catch {
          return { message: event.message, timestamp: event.timestamp };
        }
      }) || [];
    } catch (error) {
      console.error(`Pattern search failed for: ${filterPattern}`, error);
      return [];
    }
  }

  /**
   * Detect anomalies in log patterns
   */
  private async detectAnomalies(events: SecurityEvent[]): Promise<SecurityEvent[]> {
    const anomalies: SecurityEvent[] = [];

    // Group events by source IP
    const ipGroups = new Map<string, SecurityEvent[]>();
    events.forEach(event => {
      if (event.sourceIP) {
        if (!ipGroups.has(event.sourceIP)) {
          ipGroups.set(event.sourceIP, []);
        }
        ipGroups.get(event.sourceIP)!.push(event);
      }
    });

    // Detect suspicious IP activity
    for (const [ip, ipEvents] of ipGroups) {
      if (ipEvents.length > 50) { // Threshold for suspicious activity
        anomalies.push({
          timestamp: new Date(),
          eventType: 'Suspicious IP Activity',
          severity: 'HIGH',
          source: 'AnomalyDetection',
          details: {
            sourceIP: ip,
            eventCount: ipEvents.length,
            eventTypes: [...new Set(ipEvents.map(e => e.eventType))]
          },
          sourceIP: ip
        });
      }
    }

    // Detect time-based anomalies
    const hourlyActivity = new Map<number, number>();
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1);
    });

    // Check for unusual activity during off-hours (midnight to 6 AM)
    const offHoursActivity = Array.from(hourlyActivity.entries())
      .filter(([hour]) => hour >= 0 && hour <= 6)
      .reduce((sum, [, count]) => sum + count, 0);

    if (offHoursActivity > 20) { // Threshold for off-hours activity
      anomalies.push({
        timestamp: new Date(),
        eventType: 'Off-Hours Activity',
        severity: 'MEDIUM',
        source: 'AnomalyDetection',
        details: {
          offHoursEventCount: offHoursActivity,
          timeRange: '00:00-06:00'
        }
      });
    }

    return anomalies;
  }

  /**
   * Send security alert via SNS
   */
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      const message = {
        eventType: event.eventType,
        severity: event.severity,
        timestamp: event.timestamp.toISOString(),
        source: event.source,
        userIdentity: event.userIdentity,
        sourceIP: event.sourceIP,
        details: event.details
      };

      const command = new PublishCommand({
        TopicArn: this.config.snsTopicArn,
        Subject: `Security Alert: ${event.eventType} (${event.severity})`,
        Message: JSON.stringify(message, null, 2)
      });

      await this.snsClient.send(command);
      console.log(`Security alert sent for: ${event.eventType}`);
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  /**
   * Extract user identity from log event
   */
  private extractUserIdentity(event: any): string | undefined {
    return event.userIdentity?.userName || 
           event.userIdentity?.arn || 
           event.userIdentity?.type;
  }

  /**
   * Extract source IP from log event
   */
  private extractSourceIP(event: any): string | undefined {
    return event.sourceIPAddress;
  }

  /**
   * Extract user agent from log event
   */
  private extractUserAgent(event: any): string | undefined {
    return event.userAgent;
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(
    startTime: Date,
    endTime: Date
  ): Promise<{
    summary: any;
    events: SecurityEvent[];
    recommendations: string[];
  }> {
    const events = await this.analyzeLogs(startTime, endTime);
    
    const summary = {
      totalEvents: events.length,
      criticalEvents: events.filter(e => e.severity === 'CRITICAL').length,
      highSeverityEvents: events.filter(e => e.severity === 'HIGH').length,
      mediumSeverityEvents: events.filter(e => e.severity === 'MEDIUM').length,
      lowSeverityEvents: events.filter(e => e.severity === 'LOW').length,
      uniqueSourceIPs: new Set(events.map(e => e.sourceIP).filter(Boolean)).size,
      topEventTypes: this.getTopEventTypes(events, 5)
    };

    const recommendations = this.generateRecommendations(events);

    return {
      summary,
      events,
      recommendations
    };
  }

  /**
   * Get top event types by frequency
   */
  private getTopEventTypes(events: SecurityEvent[], limit: number): Array<{type: string, count: number}> {
    const eventCounts = new Map<string, number>();
    events.forEach(event => {
      eventCounts.set(event.eventType, (eventCounts.get(event.eventType) || 0) + 1);
    });

    return Array.from(eventCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Generate security recommendations based on events
   */
  private generateRecommendations(events: SecurityEvent[]): string[] {
    const recommendations: string[] = [];

    const criticalEvents = events.filter(e => e.severity === 'CRITICAL');
    if (criticalEvents.length > 0) {
      recommendations.push('Immediate action required: Critical security events detected');
    }

    const rootUsage = events.filter(e => e.eventType === 'Root Account Usage');
    if (rootUsage.length > 0) {
      recommendations.push('Consider implementing IAM users instead of root account access');
    }

    const bruteForce = events.filter(e => e.eventType === 'Brute Force Attack');
    if (bruteForce.length > 5) {
      recommendations.push('Consider implementing additional rate limiting or IP blocking');
    }

    const offHours = events.filter(e => e.eventType === 'Off-Hours Activity');
    if (offHours.length > 0) {
      recommendations.push('Review off-hours access patterns and consider time-based access controls');
    }

    return recommendations;
  }

  /**
   * Start continuous monitoring
   */
  startContinuousMonitoring(): NodeJS.Timeout {
    const intervalMs = this.config.analysisIntervalMinutes * 60 * 1000;
    
    return setInterval(async () => {
      try {
        console.log('Starting scheduled log analysis...');
        const events = await this.analyzeLogs();
        console.log(`Log analysis completed. Found ${events.length} security events.`);
      } catch (error) {
        console.error('Scheduled log analysis failed:', error);
      }
    }, intervalMs);
  }
}

// Singleton instance for application use
let auditLogAnalyzerInstance: AuditLogAnalyzer | null = null;

export function getAuditLogAnalyzer(): AuditLogAnalyzer {
  if (!auditLogAnalyzerInstance) {
    const config: AnalysisConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      logGroupName: process.env.CLOUDTRAIL_LOG_GROUP_NAME || '/aws/cloudtrail/direct-fan-platform',
      snsTopicArn: process.env.SECURITY_ALERTS_SNS_TOPIC_ARN || '',
      analysisIntervalMinutes: parseInt(process.env.LOG_ANALYSIS_INTERVAL_MINUTES || '15'),
      retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '90')
    };

    if (!config.snsTopicArn) {
      throw new Error('SECURITY_ALERTS_SNS_TOPIC_ARN environment variable is required');
    }

    auditLogAnalyzerInstance = new AuditLogAnalyzer(config);
  }

  return auditLogAnalyzerInstance;
}

// Export types for use in other modules
export type { SecurityEvent, ThreatPattern, AnalysisConfig };