// Cost Anomaly Detection Service for DirectFanz Platform
// Detects and alerts on significant cost deviations

import * as AWS from 'aws-sdk';

interface CostAnomalyConfig {
  projectName: string;
  environment: string;
  anomalyThreshold: number;
  snsTopicArn: string;
  cooldownPeriodHours?: number;
}

interface ServiceThreshold {
  threshold: number;
  enabled?: boolean;
}

interface CostAnomaly {
  anomalyId: string;
  service: string;
  impact: string;
  date: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface AnomalyDetectionResult {
  anomaliesDetected: number;
  anomalies: CostAnomaly[];
  analysisDate: string;
  alertHistory: AlertHistoryEntry[];
}

interface AlertHistoryEntry {
  anomalyId: string;
  alertSentAt: string;
  service: string;
  impact: string;
}

export class CostAnomalyDetectionService {
  private costExplorer: AWS.CostExplorer;
  private sns: AWS.SNS;
  private config: CostAnomalyConfig;
  private serviceThresholds: Map<string, ServiceThreshold>;
  private alertHistory: Map<string, AlertHistoryEntry>;

  constructor(config: CostAnomalyConfig) {
    this.config = {
      cooldownPeriodHours: 24,
      ...config
    };
    
    this.costExplorer = new AWS.CostExplorer({ region: 'us-east-1' });
    this.sns = new AWS.SNS();
    this.serviceThresholds = new Map();
    this.alertHistory = new Map();

    // Initialize default service thresholds
    this.initializeDefaultThresholds();
  }

  private initializeDefaultThresholds(): void {
    const defaultThresholds = {
      'ECS': { threshold: 100, enabled: true },
      'RDS': { threshold: 150, enabled: true },
      'S3': { threshold: 50, enabled: true },
      'CloudFront': { threshold: 75, enabled: true },
      'ElastiCache': { threshold: 100, enabled: true }
    };

    Object.entries(defaultThresholds).forEach(([service, config]) => {
      this.serviceThresholds.set(service, config);
    });
  }

  public updateServiceThresholds(thresholds: Record<string, ServiceThreshold>): void {
    Object.entries(thresholds).forEach(([service, config]) => {
      this.serviceThresholds.set(service, config);
    });
  }

  public async detectAnomalies(): Promise<AnomalyDetectionResult> {
    const analysisDate = new Date().toISOString();
    
    try {
      // Get anomalies from AWS Cost Explorer
      const anomalies = await this.getAnomaliesFromAWS();
      
      // Filter and process anomalies
      const processedAnomalies = await this.processAnomalies(anomalies);
      
      // Send alerts for new anomalies
      const alertsSent = await this.sendAlertsForAnomalies(processedAnomalies);
      
      return {
        anomaliesDetected: processedAnomalies.length,
        anomalies: processedAnomalies,
        analysisDate,
        alertHistory: Array.from(this.alertHistory.values())
      };
      
    } catch (error) {
      console.error('Error detecting cost anomalies:', error);
      throw error;
    }
  }

  private async getAnomaliesFromAWS(): Promise<AWS.CostExplorer.Anomaly[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Look back 7 days

    const params: AWS.CostExplorer.GetAnomaliesRequest = {
      DateInterval: {
        StartDate: startDate.toISOString().split('T')[0],
        EndDate: endDate.toISOString().split('T')[0]
      },
      MonitorArn: `arn:aws:ce::${await this.getAccountId()}:anomalydetector/${this.config.projectName}-service-anomaly-detector`
    };

    const result = await this.costExplorer.getAnomalies(params).promise();
    return result.Anomalies || [];
  }

  private async processAnomalies(anomalies: AWS.CostExplorer.Anomaly[]): Promise<CostAnomaly[]> {
    const processedAnomalies: CostAnomaly[] = [];

    for (const anomaly of anomalies) {
      const service = this.extractServiceFromAnomaly(anomaly);
      const impactStr = anomaly.Impact?.TotalImpact || '0';
      const impact = parseFloat(impactStr);
      
      // Check if anomaly meets service-specific threshold
      const serviceThreshold = this.serviceThresholds.get(service);
      if (!serviceThreshold?.enabled || impact < serviceThreshold.threshold) {
        continue;
      }

      // Check if we've already alerted for this anomaly recently
      if (this.shouldSkipAlert(anomaly.AnomalyId || '', service)) {
        continue;
      }

      const processedAnomaly: CostAnomaly = {
        anomalyId: anomaly.AnomalyId || '',
        service,
        impact: impactStr,
        date: anomaly.AnomalyStartDate || '',
        description: this.generateAnomalyDescription(anomaly),
        severity: this.calculateSeverity(impact)
      };

      processedAnomalies.push(processedAnomaly);
    }

    return processedAnomalies;
  }

  private extractServiceFromAnomaly(anomaly: AWS.CostExplorer.Anomaly): string {
    if (anomaly.RootCauses && anomaly.RootCauses.length > 0) {
      return anomaly.RootCauses[0].Service || 'Unknown';
    }
    return 'Unknown';
  }

  private shouldSkipAlert(anomalyId: string, _service: string): boolean {
    const existingAlert = this.alertHistory.get(anomalyId);
    if (!existingAlert) {
      return false;
    }

    const alertTime = new Date(existingAlert.alertSentAt);
    const now = new Date();
    const hoursSinceAlert = (now.getTime() - alertTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceAlert < (this.config.cooldownPeriodHours || 24);
  }

  private generateAnomalyDescription(anomaly: AWS.CostExplorer.Anomaly): string {
    const service = this.extractServiceFromAnomaly(anomaly);
    const impact = anomaly.Impact?.TotalImpact || '0';
    const date = anomaly.AnomalyStartDate || '';
    
    return `Cost anomaly detected for ${service} on ${date}. Impact: $${impact}`;
  }

  private calculateSeverity(impact: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (impact >= 1000) return 'CRITICAL';
    if (impact >= 500) return 'HIGH';
    if (impact >= 200) return 'MEDIUM';
    return 'LOW';
  }

  private async sendAlertsForAnomalies(anomalies: CostAnomaly[]): Promise<number> {
    let alertsSent = 0;

    for (const anomaly of anomalies) {
      try {
        await this.sendAlert(anomaly);
        
        // Record alert in history
        this.alertHistory.set(anomaly.anomalyId, {
          anomalyId: anomaly.anomalyId,
          alertSentAt: new Date().toISOString(),
          service: anomaly.service,
          impact: anomaly.impact
        });
        
        alertsSent++;
      } catch (error) {
        console.error(`Failed to send alert for anomaly ${anomaly.anomalyId}:`, error);
      }
    }

    return alertsSent;
  }

  private async sendAlert(anomaly: CostAnomaly): Promise<void> {
    const subject = `Cost Anomaly Detected - ${anomaly.service} - ${this.config.projectName}`;
    const message = this.formatAlertMessage(anomaly);

    const params: AWS.SNS.PublishInput = {
      TopicArn: this.config.snsTopicArn,
      Subject: subject,
      Message: message
    };

    await this.sns.publish(params).promise();
  }

  private formatAlertMessage(anomaly: CostAnomaly): string {
    return `
Cost Anomaly Alert - ${this.config.projectName} (${this.config.environment})

Service: ${anomaly.service}
Anomaly ID: ${anomaly.anomalyId}
Date: ${anomaly.date}
Impact: $${anomaly.impact}
Severity: ${anomaly.severity}

Description: ${anomaly.description}

Recommended Actions:
1. Review service usage patterns for ${anomaly.service}
2. Check for unexpected resource provisioning
3. Verify auto-scaling configurations
4. Review recent deployments or configuration changes

Dashboard: https://console.aws.amazon.com/cost-management/home#/anomaly-detection
Cost Explorer: https://console.aws.amazon.com/cost-management/home#/cost-explorer

This alert was generated automatically by the DirectFanz cost monitoring system.
    `.trim();
  }

  private async getAccountId(): Promise<string> {
    const sts = new AWS.STS();
    const identity = await sts.getCallerIdentity().promise();
    return identity.Account || '';
  }

  // Public method for testing
  public getAlertHistory(): AlertHistoryEntry[] {
    return Array.from(this.alertHistory.values());
  }

  // Public method for testing
  public clearAlertHistory(): void {
    this.alertHistory.clear();
  }
}

export default CostAnomalyDetectionService;