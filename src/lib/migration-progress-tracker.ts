/**
 * Migration Progress Tracker
 * Stub module — the AWS-to-Vercel migration is complete.
 * These types and class are retained for API/component compatibility.
 */

export interface MigrationPhase {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  startTime?: string;
  endTime?: string;
  actualDuration?: number;
  errors: string[];
  subTasks?: { name: string; status: string; progress: number }[];
}

export interface MigrationAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  phase?: string;
  subTask?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  timestamp: string;
  resolved?: boolean;
}

export interface MigrationDashboard {
  migrationId: string;
  overview: {
    status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';
    overallProgress: number;
    completedPhases: number;
    totalPhases: number;
    failedPhases: number;
    estimatedCompletion?: string;
    phases: MigrationPhase[];
  };
  performanceMetrics: {
    totalDataMigrated: number;
    migrationSpeed: number;
    errorRate: number;
    successfulOperations: number;
    averageOperationTime: number;
  };
  recentAlerts: MigrationAlert[];
}

export class MigrationProgressTracker {
  private migrationId: string;

  constructor(migrationId: string) {
    this.migrationId = migrationId;
  }

  async getDashboard(): Promise<MigrationDashboard> {
    return {
      migrationId: this.migrationId,
      overview: {
        status: 'completed',
        overallProgress: 100,
        completedPhases: 1,
        totalPhases: 1,
        failedPhases: 0,
        phases: [
          {
            id: 'aws-to-vercel',
            name: 'AWS to Vercel Migration',
            status: 'completed',
            progress: 100,
            errors: [],
          },
        ],
      },
      performanceMetrics: {
        totalDataMigrated: 0,
        migrationSpeed: 0,
        errorRate: 0,
        successfulOperations: 0,
        averageOperationTime: 0,
      },
      recentAlerts: [],
    };
  }

  async getOverview(): Promise<MigrationDashboard['overview']> {
    const dashboard = await this.getDashboard();
    return dashboard.overview;
  }

  async initializeMigration(_phases: any[]): Promise<void> {}
  async startPhase(_phaseId: string): Promise<void> {}
  async updatePhaseProgress(_phaseId: string, _progress: number, _metadata?: any): Promise<void> {}
  async completePhase(_phaseId: string, _metadata?: any): Promise<void> {}
  async failPhase(_phaseId: string, _error: string, _metadata?: any): Promise<void> {}
  async startSubTask(_phaseId: string, _subTaskId: string): Promise<void> {}
  async updateSubTaskProgress(_phaseId: string, _subTaskId: string, _progress: number, _metadata?: any): Promise<void> {}
  async completeSubTask(_phaseId: string, _subTaskId: string, _metadata?: any): Promise<void> {}
  async failSubTask(_phaseId: string, _subTaskId: string, _error: string, _metadata?: any): Promise<void> {}
  async estimateCompletion(): Promise<string | null> { return null; }

  async pauseMigration(): Promise<void> {}
  async resumeMigration(): Promise<void> {}

  async createAlert(
    type: string,
    message: string,
    phase?: string,
    subTask?: string,
    metadata?: Record<string, any>
  ): Promise<void> {}

  async updateMetrics(metrics: Record<string, any>): Promise<void> {}
}
