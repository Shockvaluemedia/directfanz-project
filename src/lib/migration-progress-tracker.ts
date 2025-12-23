/**
 * Migration Progress Tracking Service
 * Provides comprehensive tracking and reporting for AWS migration progress
 * Implements Requirements 11.6
 */

import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { 
  CloudWatchClient, 
  PutMetricDataCommand,
  StandardUnit,
  MetricDatum
} from '@aws-sdk/client-cloudwatch';
import { 
  SNSClient, 
  PublishCommand 
} from '@aws-sdk/client-sns';
import { getParameter } from './aws-config.js';
import { logger } from './logger.js';

export interface MigrationPhase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  progress: number; // 0-100
  subTasks: MigrationSubTask[];
  dependencies: string[]; // Phase IDs that must complete first
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes
  errors: string[];
  warnings: string[];
  metadata: Record<string, any>;
}

export interface MigrationSubTask {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  metadata: Record<string, any>;
}

export interface MigrationOverview {
  migrationId: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
  overallProgress: number;
  currentPhase?: string;
  totalPhases: number;
  completedPhases: number;
  failedPhases: number;
  estimatedCompletion?: Date;
  actualDuration?: number;
  phases: MigrationPhase[];
  alerts: MigrationAlert[];
  metrics: MigrationMetrics;
}

export interface MigrationAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  phase?: string;
  subTask?: string;
  acknowledged: boolean;
  metadata: Record<string, any>;
}

export interface MigrationMetrics {
  totalDataMigrated: number; // bytes
  migrationSpeed: number; // bytes per second
  errorRate: number; // percentage
  successfulOperations: number;
  failedOperations: number;
  averageOperationTime: number; // milliseconds
  resourceUtilization: {
    cpu: number; // percentage
    memory: number; // percentage
    network: number; // bytes per second
    storage: number; // bytes
  };
  costMetrics: {
    estimatedCost: number; // USD
    actualCost: number; // USD
    costPerGB: number; // USD
  };
}

export interface MigrationDashboard {
  overview: MigrationOverview;
  recentAlerts: MigrationAlert[];
  performanceMetrics: MigrationMetrics;
  phaseTimeline: PhaseTimelineEntry[];
  resourceUsage: ResourceUsageEntry[];
  costAnalysis: CostAnalysisEntry[];
}

export interface PhaseTimelineEntry {
  phaseId: string;
  phaseName: string;
  startTime: Date;
  endTime?: Date;
  status: string;
  duration?: number;
  progress: number;
}

export interface ResourceUsageEntry {
  timestamp: Date;
  cpu: number;
  memory: number;
  network: number;
  storage: number;
}

export interface CostAnalysisEntry {
  timestamp: Date;
  service: string;
  cost: number;
  usage: number;
  unit: string;
}

export class MigrationProgressTracker {
  private redis: Redis;
  private prisma: PrismaClient;
  private cloudWatch: CloudWatchClient;
  private sns: SNSClient;
  private migrationId: string;
  private alertTopicArn?: string;

  constructor(migrationId: string) {
    this.migrationId = migrationId;
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.prisma = new PrismaClient();
    this.cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.initializeAlertTopic();
  }

  private async initializeAlertTopic() {
    try {
      this.alertTopicArn = await getParameter('/migration/alert-topic-arn');
    } catch (error) {
      logger.warn('Alert topic ARN not configured', { error: error.message });
    }
  }

  /**
   * Initialize migration tracking with phases and sub-tasks
   */
  async initializeMigration(phases: MigrationPhase[]): Promise<void> {
    const overview: MigrationOverview = {
      migrationId: this.migrationId,
      startTime: new Date(),
      status: 'pending',
      overallProgress: 0,
      totalPhases: phases.length,
      completedPhases: 0,
      failedPhases: 0,
      phases,
      alerts: [],
      metrics: this.initializeMetrics()
    };

    await this.saveOverview(overview);
    await this.publishMetric('MigrationInitialized', 1);
    
    logger.info('Migration tracking initialized', {
      migrationId: this.migrationId,
      totalPhases: phases.length
    });
  }

  /**
   * Start a migration phase
   */
  async startPhase(phaseId: string): Promise<void> {
    const overview = await this.getOverview();
    const phase = overview.phases.find(p => p.id === phaseId);
    
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    if (phase.dependencies.length > 0) {
      const uncompletedDeps = phase.dependencies.filter(depId => {
        const dep = overview.phases.find(p => p.id === depId);
        return !dep || dep.status !== 'completed';
      });

      if (uncompletedDeps.length > 0) {
        throw new Error(`Phase ${phaseId} has uncompleted dependencies: ${uncompletedDeps.join(', ')}`);
      }
    }

    phase.status = 'in_progress';
    phase.startTime = new Date();
    overview.currentPhase = phaseId;
    overview.status = 'in_progress';

    await this.saveOverview(overview);
    await this.publishMetric('PhaseStarted', 1, { PhaseId: phaseId });
    await this.createAlert('info', `Phase ${phase.name} started`, phaseId);

    logger.info('Migration phase started', {
      migrationId: this.migrationId,
      phaseId,
      phaseName: phase.name
    });
  }

  /**
   * Update phase progress
   */
  async updatePhaseProgress(phaseId: string, progress: number, metadata?: Record<string, any>): Promise<void> {
    const overview = await this.getOverview();
    const phase = overview.phases.find(p => p.id === phaseId);
    
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    phase.progress = Math.min(100, Math.max(0, progress));
    if (metadata) {
      phase.metadata = { ...phase.metadata, ...metadata };
    }

    // Calculate overall progress
    overview.overallProgress = this.calculateOverallProgress(overview.phases);

    await this.saveOverview(overview);
    await this.publishMetric('PhaseProgress', progress, { PhaseId: phaseId });

    logger.debug('Phase progress updated', {
      migrationId: this.migrationId,
      phaseId,
      progress,
      overallProgress: overview.overallProgress
    });
  }

  /**
   * Complete a migration phase
   */
  async completePhase(phaseId: string, metadata?: Record<string, any>): Promise<void> {
    const overview = await this.getOverview();
    const phase = overview.phases.find(p => p.id === phaseId);
    
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    phase.status = 'completed';
    phase.endTime = new Date();
    phase.progress = 100;
    phase.actualDuration = phase.startTime ? 
      Math.round((phase.endTime.getTime() - phase.startTime.getTime()) / 60000) : 0;

    if (metadata) {
      phase.metadata = { ...phase.metadata, ...metadata };
    }

    overview.completedPhases++;
    overview.overallProgress = this.calculateOverallProgress(overview.phases);

    // Check if migration is complete
    if (overview.completedPhases === overview.totalPhases) {
      overview.status = 'completed';
      overview.endTime = new Date();
      overview.actualDuration = Math.round(
        (overview.endTime.getTime() - overview.startTime.getTime()) / 60000
      );
    }

    await this.saveOverview(overview);
    await this.publishMetric('PhaseCompleted', 1, { PhaseId: phaseId });
    await this.createAlert('info', `Phase ${phase.name} completed successfully`, phaseId);

    logger.info('Migration phase completed', {
      migrationId: this.migrationId,
      phaseId,
      phaseName: phase.name,
      duration: phase.actualDuration,
      overallProgress: overview.overallProgress
    });
  }

  /**
   * Fail a migration phase
   */
  async failPhase(phaseId: string, error: string, metadata?: Record<string, any>): Promise<void> {
    const overview = await this.getOverview();
    const phase = overview.phases.find(p => p.id === phaseId);
    
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    phase.status = 'failed';
    phase.endTime = new Date();
    phase.errors.push(error);

    if (metadata) {
      phase.metadata = { ...phase.metadata, ...metadata };
    }

    overview.failedPhases++;
    overview.status = 'failed';

    await this.saveOverview(overview);
    await this.publishMetric('PhaseFailed', 1, { PhaseId: phaseId });
    await this.createAlert('error', `Phase ${phase.name} failed: ${error}`, phaseId);

    logger.error('Migration phase failed', {
      migrationId: this.migrationId,
      phaseId,
      phaseName: phase.name,
      error
    });
  }

  /**
   * Start a sub-task within a phase
   */
  async startSubTask(phaseId: string, subTaskId: string): Promise<void> {
    const overview = await this.getOverview();
    const phase = overview.phases.find(p => p.id === phaseId);
    
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    const subTask = phase.subTasks.find(st => st.id === subTaskId);
    if (!subTask) {
      throw new Error(`SubTask ${subTaskId} not found in phase ${phaseId}`);
    }

    subTask.status = 'in_progress';
    subTask.startTime = new Date();

    await this.saveOverview(overview);
    await this.publishMetric('SubTaskStarted', 1, { PhaseId: phaseId, SubTaskId: subTaskId });

    logger.debug('Sub-task started', {
      migrationId: this.migrationId,
      phaseId,
      subTaskId,
      subTaskName: subTask.name
    });
  }

  /**
   * Update sub-task progress
   */
  async updateSubTaskProgress(phaseId: string, subTaskId: string, progress: number, metadata?: Record<string, any>): Promise<void> {
    const overview = await this.getOverview();
    const phase = overview.phases.find(p => p.id === phaseId);
    
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    const subTask = phase.subTasks.find(st => st.id === subTaskId);
    if (!subTask) {
      throw new Error(`SubTask ${subTaskId} not found in phase ${phaseId}`);
    }

    subTask.progress = Math.min(100, Math.max(0, progress));
    if (metadata) {
      subTask.metadata = { ...subTask.metadata, ...metadata };
    }

    // Update phase progress based on sub-task progress
    const avgSubTaskProgress = phase.subTasks.reduce((sum, st) => sum + st.progress, 0) / phase.subTasks.length;
    phase.progress = Math.round(avgSubTaskProgress);
    overview.overallProgress = this.calculateOverallProgress(overview.phases);

    await this.saveOverview(overview);
    await this.publishMetric('SubTaskProgress', progress, { PhaseId: phaseId, SubTaskId: subTaskId });
  }

  /**
   * Complete a sub-task
   */
  async completeSubTask(phaseId: string, subTaskId: string, metadata?: Record<string, any>): Promise<void> {
    const overview = await this.getOverview();
    const phase = overview.phases.find(p => p.id === phaseId);
    
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    const subTask = phase.subTasks.find(st => st.id === subTaskId);
    if (!subTask) {
      throw new Error(`SubTask ${subTaskId} not found in phase ${phaseId}`);
    }

    subTask.status = 'completed';
    subTask.endTime = new Date();
    subTask.progress = 100;

    if (metadata) {
      subTask.metadata = { ...subTask.metadata, ...metadata };
    }

    // Update phase progress
    const avgSubTaskProgress = phase.subTasks.reduce((sum, st) => sum + st.progress, 0) / phase.subTasks.length;
    phase.progress = Math.round(avgSubTaskProgress);
    overview.overallProgress = this.calculateOverallProgress(overview.phases);

    await this.saveOverview(overview);
    await this.publishMetric('SubTaskCompleted', 1, { PhaseId: phaseId, SubTaskId: subTaskId });

    logger.debug('Sub-task completed', {
      migrationId: this.migrationId,
      phaseId,
      subTaskId,
      subTaskName: subTask.name
    });
  }

  /**
   * Fail a sub-task
   */
  async failSubTask(phaseId: string, subTaskId: string, error: string, metadata?: Record<string, any>): Promise<void> {
    const overview = await this.getOverview();
    const phase = overview.phases.find(p => p.id === phaseId);
    
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    const subTask = phase.subTasks.find(st => st.id === subTaskId);
    if (!subTask) {
      throw new Error(`SubTask ${subTaskId} not found in phase ${phaseId}`);
    }

    subTask.status = 'failed';
    subTask.endTime = new Date();
    subTask.error = error;

    if (metadata) {
      subTask.metadata = { ...subTask.metadata, ...metadata };
    }

    await this.saveOverview(overview);
    await this.publishMetric('SubTaskFailed', 1, { PhaseId: phaseId, SubTaskId: subTaskId });
    await this.createAlert('error', `Sub-task ${subTask.name} failed: ${error}`, phaseId, subTaskId);

    logger.error('Sub-task failed', {
      migrationId: this.migrationId,
      phaseId,
      subTaskId,
      subTaskName: subTask.name,
      error
    });
  }

  /**
   * Create an alert
   */
  async createAlert(type: 'info' | 'warning' | 'error' | 'critical', message: string, phase?: string, subTask?: string, metadata?: Record<string, any>): Promise<void> {
    const alert: MigrationAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      phase,
      subTask,
      acknowledged: false,
      metadata: metadata || {}
    };

    const overview = await this.getOverview();
    overview.alerts.unshift(alert);
    
    // Keep only the last 100 alerts
    overview.alerts = overview.alerts.slice(0, 100);

    await this.saveOverview(overview);
    await this.publishMetric('AlertCreated', 1, { AlertType: type });

    // Send critical and error alerts via SNS
    if ((type === 'critical' || type === 'error') && this.alertTopicArn) {
      await this.sendAlert(alert);
    }

    logger.info('Migration alert created', {
      migrationId: this.migrationId,
      alertType: type,
      message,
      phase,
      subTask
    });
  }

  /**
   * Update migration metrics
   */
  async updateMetrics(metrics: Partial<MigrationMetrics>): Promise<void> {
    const overview = await this.getOverview();
    overview.metrics = { ...overview.metrics, ...metrics };

    await this.saveOverview(overview);

    // Publish key metrics to CloudWatch
    if (metrics.totalDataMigrated) {
      await this.publishMetric('TotalDataMigrated', metrics.totalDataMigrated);
    }
    if (metrics.migrationSpeed) {
      await this.publishMetric('MigrationSpeed', metrics.migrationSpeed);
    }
    if (metrics.errorRate) {
      await this.publishMetric('ErrorRate', metrics.errorRate);
    }

    logger.debug('Migration metrics updated', {
      migrationId: this.migrationId,
      metrics
    });
  }

  /**
   * Get migration overview
   */
  async getOverview(): Promise<MigrationOverview> {
    const key = `migration:${this.migrationId}:overview`;
    const data = await this.redis.get(key);
    
    if (!data) {
      throw new Error(`Migration ${this.migrationId} not found`);
    }

    return JSON.parse(data, (key, value) => {
      // Parse dates
      if (key.endsWith('Time') || key === 'timestamp') {
        return new Date(value);
      }
      return value;
    });
  }

  /**
   * Get migration dashboard data
   */
  async getDashboard(): Promise<MigrationDashboard> {
    const overview = await this.getOverview();
    
    return {
      overview,
      recentAlerts: overview.alerts.slice(0, 10),
      performanceMetrics: overview.metrics,
      phaseTimeline: this.generatePhaseTimeline(overview.phases),
      resourceUsage: await this.getResourceUsage(),
      costAnalysis: await this.getCostAnalysis()
    };
  }

  /**
   * Generate estimated completion time
   */
  async estimateCompletion(): Promise<Date | null> {
    const overview = await this.getOverview();
    
    if (overview.status === 'completed') {
      return overview.endTime || null;
    }

    const completedPhases = overview.phases.filter(p => p.status === 'completed');
    const remainingPhases = overview.phases.filter(p => p.status !== 'completed');

    if (completedPhases.length === 0) {
      // Use estimated durations
      const totalEstimated = remainingPhases.reduce((sum, p) => sum + p.estimatedDuration, 0);
      return new Date(Date.now() + totalEstimated * 60000);
    }

    // Calculate average actual duration vs estimated
    const avgActualDuration = completedPhases.reduce((sum, p) => sum + (p.actualDuration || p.estimatedDuration), 0) / completedPhases.length;
    const avgEstimatedDuration = completedPhases.reduce((sum, p) => sum + p.estimatedDuration, 0) / completedPhases.length;
    const durationMultiplier = avgActualDuration / avgEstimatedDuration;

    const remainingEstimated = remainingPhases.reduce((sum, p) => sum + p.estimatedDuration, 0);
    const adjustedRemaining = remainingEstimated * durationMultiplier;

    return new Date(Date.now() + adjustedRemaining * 60000);
  }

  /**
   * Pause migration
   */
  async pauseMigration(): Promise<void> {
    const overview = await this.getOverview();
    overview.status = 'paused';

    await this.saveOverview(overview);
    await this.publishMetric('MigrationPaused', 1);
    await this.createAlert('warning', 'Migration has been paused');

    logger.info('Migration paused', { migrationId: this.migrationId });
  }

  /**
   * Resume migration
   */
  async resumeMigration(): Promise<void> {
    const overview = await this.getOverview();
    overview.status = 'in_progress';

    await this.saveOverview(overview);
    await this.publishMetric('MigrationResumed', 1);
    await this.createAlert('info', 'Migration has been resumed');

    logger.info('Migration resumed', { migrationId: this.migrationId });
  }

  /**
   * Private helper methods
   */
  private async saveOverview(overview: MigrationOverview): Promise<void> {
    const key = `migration:${this.migrationId}:overview`;
    await this.redis.set(key, JSON.stringify(overview), 'EX', 86400 * 7); // 7 days TTL
  }

  private calculateOverallProgress(phases: MigrationPhase[]): number {
    if (phases.length === 0) return 0;
    
    const totalProgress = phases.reduce((sum, phase) => sum + phase.progress, 0);
    return Math.round(totalProgress / phases.length);
  }

  private initializeMetrics(): MigrationMetrics {
    return {
      totalDataMigrated: 0,
      migrationSpeed: 0,
      errorRate: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageOperationTime: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        network: 0,
        storage: 0
      },
      costMetrics: {
        estimatedCost: 0,
        actualCost: 0,
        costPerGB: 0
      }
    };
  }

  private async publishMetric(metricName: string, value: number, dimensions?: Record<string, string>): Promise<void> {
    try {
      const metricData: MetricDatum = {
        MetricName: metricName,
        Value: value,
        Unit: StandardUnit.Count,
        Timestamp: new Date(),
        Dimensions: dimensions ? Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })) : undefined
      };

      await this.cloudWatch.send(new PutMetricDataCommand({
        Namespace: 'DirectFanz/Migration',
        MetricData: [metricData]
      }));
    } catch (error) {
      logger.error('Failed to publish metric', { metricName, value, error: error.message });
    }
  }

  private async sendAlert(alert: MigrationAlert): Promise<void> {
    if (!this.alertTopicArn) return;

    try {
      const message = {
        migrationId: this.migrationId,
        alert: {
          type: alert.type,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
          phase: alert.phase,
          subTask: alert.subTask
        }
      };

      await this.sns.send(new PublishCommand({
        TopicArn: this.alertTopicArn,
        Message: JSON.stringify(message),
        Subject: `Migration Alert: ${alert.type.toUpperCase()}`
      }));
    } catch (error) {
      logger.error('Failed to send alert', { alertId: alert.id, error: error.message });
    }
  }

  private generatePhaseTimeline(phases: MigrationPhase[]): PhaseTimelineEntry[] {
    return phases.map(phase => ({
      phaseId: phase.id,
      phaseName: phase.name,
      startTime: phase.startTime || new Date(),
      endTime: phase.endTime,
      status: phase.status,
      duration: phase.actualDuration,
      progress: phase.progress
    }));
  }

  private async getResourceUsage(): Promise<ResourceUsageEntry[]> {
    // This would typically fetch from CloudWatch metrics
    // For now, return mock data
    const now = new Date();
    const entries: ResourceUsageEntry[] = [];
    
    for (let i = 0; i < 24; i++) {
      entries.push({
        timestamp: new Date(now.getTime() - i * 3600000),
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        network: Math.random() * 1000000,
        storage: Math.random() * 10000000
      });
    }
    
    return entries.reverse();
  }

  private async getCostAnalysis(): Promise<CostAnalysisEntry[]> {
    // This would typically fetch from AWS Cost Explorer API
    // For now, return mock data
    const now = new Date();
    const entries: CostAnalysisEntry[] = [];
    const services = ['EC2', 'RDS', 'S3', 'CloudFront', 'ElastiCache'];
    
    for (let i = 0; i < 7; i++) {
      for (const service of services) {
        entries.push({
          timestamp: new Date(now.getTime() - i * 86400000),
          service,
          cost: Math.random() * 100,
          usage: Math.random() * 1000,
          unit: service === 'S3' ? 'GB' : service === 'EC2' ? 'hours' : 'requests'
        });
      }
    }
    
    return entries.reverse();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.redis.quit();
    await this.prisma.$disconnect();
  }
}