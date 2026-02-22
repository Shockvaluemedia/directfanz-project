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
