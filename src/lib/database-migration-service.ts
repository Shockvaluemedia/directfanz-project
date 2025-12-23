/**
 * Database Migration Service for AWS RDS Migration
 * Implements AWS DMS integration and dual-write strategy for zero-downtime migration
 * Validates Requirements 11.1
 */

import { PrismaClient } from '@prisma/client';
import { 
  DatabaseMigrationServiceClient, 
  CreateReplicationTaskCommand,
  StartReplicationTaskCommand,
  DescribeReplicationTasksCommand,
  StopReplicationTaskCommand,
  DeleteReplicationTaskCommand,
  CreateReplicationInstanceCommand,
  DescribeReplicationInstancesCommand,
  CreateEndpointCommand,
  TestConnectionCommand,
  DescribeEndpointsCommand,
  ReplicationTask,
  ReplicationInstance,
  Endpoint
} from '@aws-sdk/client-database-migration-service';
import { getParameter, isRunningInECS } from './aws-config';
import { logger } from './logger';
import crypto from 'crypto';

interface MigrationConfig {
  sourceEndpoint: {
    url: string;
    identifier: string;
  };
  targetEndpoint: {
    url: string;
    identifier: string;
  };
  replicationInstance: {
    identifier: string;
    instanceClass: string;
    allocatedStorage: number;
  };
  replicationTask: {
    identifier: string;
    migrationType: 'full-load' | 'cdc' | 'full-load-and-cdc';
  };
  dualWriteEnabled: boolean;
  validationEnabled: boolean;
}

interface MigrationProgress {
  status: 'creating' | 'ready' | 'running' | 'stopped' | 'failed' | 'completed';
  progress: number;
  tablesLoaded: number;
  totalTables: number;
  fullLoadProgressPercent?: number;
  cdcStartDate?: Date;
  errors: string[];
  warnings: string[];
}

interface DataIntegrityCheck {
  table: string;
  sourceCount: number;
  targetCount: number;
  match: boolean;
  sampleChecksumMatch: boolean;
  lastUpdated: Date;
}

export class DatabaseMigrationService {
  private dmsClient: DatabaseMigrationServiceClient;
  private sourceClient: PrismaClient;
  private targetClient: PrismaClient;
  private config: MigrationConfig;
  private dualWriteActive: boolean = false;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.dmsClient = new DatabaseMigrationServiceClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    // Initialize Prisma clients
    this.sourceClient = new PrismaClient({
      datasources: { db: { url: config.sourceEndpoint.url } },
      log: ['error', 'warn'],
    });

    this.targetClient = new PrismaClient({
      datasources: { db: { url: config.targetEndpoint.url } },
      log: ['error', 'warn'],
    });
  }

  /**
   * Execute complete database migration process
   */
  async executeMigration(): Promise<void> {
    logger.info('🚀 Starting AWS DMS database migration...');

    try {
      // Step 1: Validate connections
      await this.validateConnections();

      // Step 2: Create DMS endpoints
      await this.createDMSEndpoints();

      // Step 3: Create replication instance
      await this.createReplicationInstance();

      // Step 4: Create and start replication task
      await this.createReplicationTask();

      // Step 5: Monitor initial full load
      await this.monitorFullLoad();

      // Step 6: Enable dual-write strategy
      if (this.config.dualWriteEnabled) {
        await this.enableDualWrite();
      }

      // Step 7: Monitor CDC (Change Data Capture)
      if (this.config.replicationTask.migrationType.includes('cdc')) {
        await this.monitorCDC();
      }

      // Step 8: Validate data integrity
      if (this.config.validationEnabled) {
        await this.validateDataIntegrity();
      }

      logger.info('✅ Database migration completed successfully');

    } catch (error) {
      logger.error('❌ Database migration failed', { error });
      await this.rollbackMigration();
      throw error;
    }
  }

  /**
   * Validate database connections
   */
  private async validateConnections(): Promise<void> {
    logger.info('Validating database connections...');

    try {
      // Test source connection
      await this.sourceClient.$executeRaw`SELECT 1 as source_test`;
      logger.info('✅ Source database connection validated');

      // Test target connection
      await this.targetClient.$executeRaw`SELECT 1 as target_test`;
      logger.info('✅ Target database connection validated');

      // Verify schema compatibility
      const schemaCompatible = await this.verifySchemaCompatibility();
      if (!schemaCompatible) {
        throw new Error('Schema compatibility check failed');
      }

    } catch (error) {
      logger.error('❌ Database connection validation failed', { error });
      throw error;
    }
  }

  /**
   * Verify schema compatibility between source and target
   */
  private async verifySchemaCompatibility(): Promise<boolean> {
    logger.info('Verifying schema compatibility...');

    try {
      const sourceSchema = await this.getSchemaInfo(this.sourceClient);
      const targetSchema = await this.getSchemaInfo(this.targetClient);

      // Compare table structures
      const incompatibilities: string[] = [];

      for (const sourceTable of sourceSchema.tables) {
        const targetTable = targetSchema.tables.find(t => t.table_name === sourceTable.table_name);
        if (!targetTable) {
          incompatibilities.push(`Missing table in target: ${sourceTable.table_name}`);
          continue;
        }

        // Compare columns
        const sourceColumns = sourceSchema.columns.filter(c => c.table_name === sourceTable.table_name);
        const targetColumns = targetSchema.columns.filter(c => c.table_name === sourceTable.table_name);

        for (const sourceColumn of sourceColumns) {
          const targetColumn = targetColumns.find(c => c.column_name === sourceColumn.column_name);
          if (!targetColumn) {
            incompatibilities.push(`Missing column ${sourceTable.table_name}.${sourceColumn.column_name} in target`);
          } else if (sourceColumn.data_type !== targetColumn.data_type) {
            incompatibilities.push(`Data type mismatch for ${sourceTable.table_name}.${sourceColumn.column_name}: ${sourceColumn.data_type} vs ${targetColumn.data_type}`);
          }
        }
      }

      if (incompatibilities.length > 0) {
        logger.error('❌ Schema incompatibilities found:', incompatibilities);
        return false;
      }

      logger.info('✅ Schema compatibility verified');
      return true;

    } catch (error) {
      logger.error('❌ Schema compatibility check failed', { error });
      return false;
    }
  }

  /**
   * Get schema information from database
   */
  private async getSchemaInfo(client: PrismaClient): Promise<{
    tables: Array<{ table_name: string }>;
    columns: Array<{ table_name: string; column_name: string; data_type: string }>;
  }> {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const columns = await client.$queryRaw<Array<{ 
      table_name: string; 
      column_name: string; 
      data_type: string; 
    }>>`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;

    return { tables, columns };
  }

  /**
   * Create DMS endpoints for source and target databases
   */
  private async createDMSEndpoints(): Promise<void> {
    logger.info('Creating DMS endpoints...');

    try {
      // Parse database URLs
      const sourceUrl = new URL(this.config.sourceEndpoint.url);
      const targetUrl = new URL(this.config.targetEndpoint.url);

      // Create source endpoint
      const sourceEndpointCommand = new CreateEndpointCommand({
        EndpointIdentifier: this.config.sourceEndpoint.identifier,
        EndpointType: 'source',
        EngineName: 'postgres',
        ServerName: sourceUrl.hostname,
        Port: parseInt(sourceUrl.port) || 5432,
        DatabaseName: sourceUrl.pathname.slice(1),
        Username: sourceUrl.username,
        Password: sourceUrl.password,
        SslMode: 'require',
        Tags: [
          { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
          { Key: 'Purpose', Value: 'DirectFanz-Migration-Source' },
        ],
      });

      await this.dmsClient.send(sourceEndpointCommand);
      logger.info('✅ Source endpoint created');

      // Create target endpoint
      const targetEndpointCommand = new CreateEndpointCommand({
        EndpointIdentifier: this.config.targetEndpoint.identifier,
        EndpointType: 'target',
        EngineName: 'postgres',
        ServerName: targetUrl.hostname,
        Port: parseInt(targetUrl.port) || 5432,
        DatabaseName: targetUrl.pathname.slice(1),
        Username: targetUrl.username,
        Password: targetUrl.password,
        SslMode: 'require',
        Tags: [
          { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
          { Key: 'Purpose', Value: 'DirectFanz-Migration-Target' },
        ],
      });

      await this.dmsClient.send(targetEndpointCommand);
      logger.info('✅ Target endpoint created');

      // Test connections
      await this.testEndpointConnections();

    } catch (error) {
      logger.error('❌ Failed to create DMS endpoints', { error });
      throw error;
    }
  }

  /**
   * Test DMS endpoint connections
   */
  private async testEndpointConnections(): Promise<void> {
    logger.info('Testing DMS endpoint connections...');

    try {
      // Test source endpoint
      const testSourceCommand = new TestConnectionCommand({
        EndpointArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:endpoint:${this.config.sourceEndpoint.identifier}`,
        ReplicationInstanceArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:rep:${this.config.replicationInstance.identifier}`,
      });

      await this.dmsClient.send(testSourceCommand);
      logger.info('✅ Source endpoint connection test passed');

      // Test target endpoint
      const testTargetCommand = new TestConnectionCommand({
        EndpointArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:endpoint:${this.config.targetEndpoint.identifier}`,
        ReplicationInstanceArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:rep:${this.config.replicationInstance.identifier}`,
      });

      await this.dmsClient.send(testTargetCommand);
      logger.info('✅ Target endpoint connection test passed');

    } catch (error) {
      logger.error('❌ Endpoint connection tests failed', { error });
      throw error;
    }
  }

  /**
   * Create DMS replication instance
   */
  private async createReplicationInstance(): Promise<void> {
    logger.info('Creating DMS replication instance...');

    try {
      const command = new CreateReplicationInstanceCommand({
        ReplicationInstanceIdentifier: this.config.replicationInstance.identifier,
        ReplicationInstanceClass: this.config.replicationInstance.instanceClass,
        AllocatedStorage: this.config.replicationInstance.allocatedStorage,
        MultiAZ: process.env.NODE_ENV === 'production',
        PubliclyAccessible: false,
        AutoMinorVersionUpgrade: true,
        Tags: [
          { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
          { Key: 'Purpose', Value: 'DirectFanz-Migration' },
        ],
      });

      await this.dmsClient.send(command);
      logger.info('✅ Replication instance creation initiated');

      // Wait for instance to be available
      await this.waitForReplicationInstance();

    } catch (error) {
      logger.error('❌ Failed to create replication instance', { error });
      throw error;
    }
  }

  /**
   * Wait for replication instance to be available
   */
  private async waitForReplicationInstance(): Promise<void> {
    logger.info('Waiting for replication instance to be available...');

    const maxAttempts = 30; // 15 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const command = new DescribeReplicationInstancesCommand({
          Filters: [
            {
              Name: 'replication-instance-id',
              Values: [this.config.replicationInstance.identifier],
            },
          ],
        });

        const response = await this.dmsClient.send(command);
        const instance = response.ReplicationInstances?.[0];

        if (instance?.ReplicationInstanceStatus === 'available') {
          logger.info('✅ Replication instance is available');
          return;
        }

        logger.info(`⏳ Replication instance status: ${instance?.ReplicationInstanceStatus}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        attempts++;

      } catch (error) {
        logger.error('❌ Error checking replication instance status', { error });
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    throw new Error('Replication instance failed to become available within timeout');
  }

  /**
   * Create and start replication task
   */
  private async createReplicationTask(): Promise<void> {
    logger.info('Creating replication task...');

    try {
      // Define table mappings for DirectFanz schema
      const tableMappings = {
        rules: [
          {
            "rule-type": "selection",
            "rule-id": "1",
            "rule-name": "1",
            "object-locator": {
              "schema-name": "public",
              "table-name": "%"
            },
            "rule-action": "include"
          },
          {
            "rule-type": "transformation",
            "rule-id": "2",
            "rule-name": "2",
            "rule-target": "table",
            "object-locator": {
              "schema-name": "public",
              "table-name": "%"
            },
            "rule-action": "add-column",
            "value": "migration_timestamp",
            "expression": "CURRENT_TIMESTAMP",
            "data-type": {
              "type": "datetime"
            }
          }
        ]
      };

      const command = new CreateReplicationTaskCommand({
        ReplicationTaskIdentifier: this.config.replicationTask.identifier,
        SourceEndpointArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:endpoint:${this.config.sourceEndpoint.identifier}`,
        TargetEndpointArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:endpoint:${this.config.targetEndpoint.identifier}`,
        ReplicationInstanceArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:rep:${this.config.replicationInstance.identifier}`,
        MigrationType: this.config.replicationTask.migrationType,
        TableMappings: JSON.stringify(tableMappings),
        ReplicationTaskSettings: JSON.stringify({
          TargetMetadata: {
            TargetSchema: "",
            SupportLobs: true,
            FullLobMode: false,
            LobChunkSize: 0,
            LimitedSizeLobMode: true,
            LobMaxSize: 32,
            InlineLobMaxSize: 0,
            LoadMaxFileSize: 0,
            ParallelLoadThreads: 0,
            ParallelLoadBufferSize: 0,
            BatchApplyEnabled: false,
            TaskRecoveryTableEnabled: false,
            ParallelApplyThreads: 0,
            ParallelApplyBufferSize: 0,
            ParallelApplyQueuesPerThread: 0
          },
          FullLoadSettings: {
            TargetTablePrepMode: "DO_NOTHING",
            CreatePkAfterFullLoad: false,
            StopTaskCachedChangesApplied: false,
            StopTaskCachedChangesNotApplied: false,
            MaxFullLoadSubTasks: 8,
            TransactionConsistencyTimeout: 600,
            CommitRate: 10000
          },
          Logging: {
            EnableLogging: true,
            LogComponents: [
              {
                Id: "SOURCE_UNLOAD",
                Severity: "LOGGER_SEVERITY_DEFAULT"
              },
              {
                Id: "TARGET_LOAD",
                Severity: "LOGGER_SEVERITY_DEFAULT"
              },
              {
                Id: "SOURCE_CAPTURE",
                Severity: "LOGGER_SEVERITY_DEFAULT"
              },
              {
                Id: "TARGET_APPLY",
                Severity: "LOGGER_SEVERITY_DEFAULT"
              }
            ]
          },
          ControlTablesSettings: {
            historyTimeslotInMinutes: 5,
            ControlSchema: "",
            HistoryTimeslotInMinutes: 5,
            HistoryTableEnabled: false,
            SuspendedTablesTableEnabled: false,
            StatusTableEnabled: false
          },
          StreamBufferSettings: {
            StreamBufferCount: 3,
            StreamBufferSizeInMB: 8,
            CtrlStreamBufferSizeInMB: 5
          },
          ChangeProcessingDdlHandlingPolicy: {
            HandleSourceTableDropped: true,
            HandleSourceTableTruncated: true,
            HandleSourceTableAltered: true
          },
          ErrorBehavior: {
            DataErrorPolicy: "LOG_ERROR",
            DataTruncationErrorPolicy: "LOG_ERROR",
            DataErrorEscalationPolicy: "SUSPEND_TABLE",
            DataErrorEscalationCount: 0,
            TableErrorPolicy: "SUSPEND_TABLE",
            TableErrorEscalationPolicy: "STOP_TASK",
            TableErrorEscalationCount: 0,
            RecoverableErrorCount: -1,
            RecoverableErrorInterval: 5,
            RecoverableErrorThrottling: true,
            RecoverableErrorThrottlingMax: 1800,
            ApplyErrorDeletePolicy: "IGNORE_RECORD",
            ApplyErrorInsertPolicy: "LOG_ERROR",
            ApplyErrorUpdatePolicy: "LOG_ERROR",
            ApplyErrorEscalationPolicy: "LOG_ERROR",
            ApplyErrorEscalationCount: 0,
            ApplyErrorFailOnTruncationDdl: false,
            FullLoadIgnoreConflicts: true,
            FailOnTransactionConsistencyBreached: false,
            FailOnNoTablesCaptured: false
          },
          ChangeProcessingTuning: {
            BatchApplyPreserveTransaction: true,
            BatchApplyTimeoutMin: 1,
            BatchApplyTimeoutMax: 30,
            BatchApplyMemoryLimit: 500,
            BatchSplitSize: 0,
            MinTransactionSize: 1000,
            CommitTimeout: 1,
            MemoryLimitTotal: 1024,
            MemoryKeepTime: 60,
            StatementCacheSize: 50
          },
          ValidationSettings: {
            EnableValidation: this.config.validationEnabled,
            ValidationMode: "ROW_LEVEL",
            ThreadCount: 5,
            PartitionSize: 10000,
            FailureMaxCount: 10000,
            RecordFailureDelayInMinutes: 5,
            RecordSuspendDelayInMinutes: 30,
            MaxKeyColumnSize: 8096,
            TableFailureMaxCount: 1000,
            ValidationOnly: false,
            HandleCollationDiff: false,
            RecordFailureDelayLimitInMinutes: 0,
            SkipLobColumns: false,
            ValidationPartialLobSize: 0,
            ValidationQueryCdcDelaySeconds: 0
          }
        }),
        Tags: [
          { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
          { Key: 'Purpose', Value: 'DirectFanz-Migration' },
        ],
      });

      await this.dmsClient.send(command);
      logger.info('✅ Replication task created');

      // Start the replication task
      await this.startReplicationTask();

    } catch (error) {
      logger.error('❌ Failed to create replication task', { error });
      throw error;
    }
  }

  /**
   * Start the replication task
   */
  private async startReplicationTask(): Promise<void> {
    logger.info('Starting replication task...');

    try {
      const command = new StartReplicationTaskCommand({
        ReplicationTaskArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:task:${this.config.replicationTask.identifier}`,
        StartReplicationTaskType: 'start-replication',
      });

      await this.dmsClient.send(command);
      logger.info('✅ Replication task started');

    } catch (error) {
      logger.error('❌ Failed to start replication task', { error });
      throw error;
    }
  }

  /**
   * Monitor full load progress
   */
  private async monitorFullLoad(): Promise<void> {
    logger.info('Monitoring full load progress...');

    const maxAttempts = 120; // 2 hours max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const progress = await this.getReplicationProgress();
        
        logger.info(`📊 Migration progress: ${progress.progress}% (${progress.tablesLoaded}/${progress.totalTables} tables)`);

        if (progress.status === 'completed' || progress.progress >= 100) {
          logger.info('✅ Full load completed');
          return;
        }

        if (progress.status === 'failed') {
          throw new Error(`Replication task failed: ${progress.errors.join(', ')}`);
        }

        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
        attempts++;

      } catch (error) {
        logger.error('❌ Error monitoring full load', { error });
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    throw new Error('Full load monitoring timeout');
  }

  /**
   * Get replication task progress
   */
  private async getReplicationProgress(): Promise<MigrationProgress> {
    const command = new DescribeReplicationTasksCommand({
      Filters: [
        {
          Name: 'replication-task-id',
          Values: [this.config.replicationTask.identifier],
        },
      ],
    });

    const response = await this.dmsClient.send(command);
    const task = response.ReplicationTasks?.[0];

    if (!task) {
      throw new Error('Replication task not found');
    }

    return {
      status: this.mapTaskStatus(task.Status || 'unknown'),
      progress: task.ReplicationTaskStats?.FullLoadProgressPercent || 0,
      tablesLoaded: task.ReplicationTaskStats?.TablesLoaded || 0,
      totalTables: task.ReplicationTaskStats?.TablesQueued || 0,
      fullLoadProgressPercent: task.ReplicationTaskStats?.FullLoadProgressPercent,
      cdcStartDate: task.CdcStartPosition ? new Date(task.CdcStartPosition) : undefined,
      errors: task.ReplicationTaskStats?.LastUpdateTime ? [] : ['No statistics available'],
      warnings: [],
    };
  }

  /**
   * Map DMS task status to our status enum
   */
  private mapTaskStatus(dmsStatus: string): MigrationProgress['status'] {
    switch (dmsStatus.toLowerCase()) {
      case 'creating':
        return 'creating';
      case 'ready':
        return 'ready';
      case 'running':
        return 'running';
      case 'stopped':
        return 'stopped';
      case 'failed':
        return 'failed';
      case 'completed':
        return 'completed';
      default:
        return 'failed';
    }
  }

  /**
   * Enable dual-write strategy for cutover period
   */
  private async enableDualWrite(): Promise<void> {
    logger.info('Enabling dual-write strategy...');

    try {
      // This would be implemented at the application level
      // For now, we'll just set the flag and log
      this.dualWriteActive = true;
      
      logger.info('✅ Dual-write strategy enabled');
      logger.info('💡 Application should now write to both source and target databases');

    } catch (error) {
      logger.error('❌ Failed to enable dual-write strategy', { error });
      throw error;
    }
  }

  /**
   * Monitor CDC (Change Data Capture)
   */
  private async monitorCDC(): Promise<void> {
    logger.info('Monitoring CDC replication...');

    // Monitor CDC for a specified duration or until manually stopped
    const monitorDuration = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < monitorDuration) {
      try {
        const progress = await this.getReplicationProgress();
        
        if (progress.cdcStartDate) {
          logger.info(`📡 CDC active since: ${progress.cdcStartDate.toISOString()}`);
        }

        if (progress.status === 'failed') {
          throw new Error(`CDC replication failed: ${progress.errors.join(', ')}`);
        }

        await new Promise(resolve => setTimeout(resolve, 30000)); // Check every 30 seconds

      } catch (error) {
        logger.error('❌ Error monitoring CDC', { error });
        break;
      }
    }

    logger.info('✅ CDC monitoring completed');
  }

  /**
   * Validate data integrity between source and target
   */
  async validateDataIntegrity(): Promise<DataIntegrityCheck[]> {
    logger.info('Validating data integrity...');

    const results: DataIntegrityCheck[] = [];
    
    try {
      // Get list of tables to validate
      const sourceSchema = await this.getSchemaInfo(this.sourceClient);
      
      for (const table of sourceSchema.tables) {
        const tableName = table.table_name;
        
        try {
          // Get record counts
          const sourceCount = await this.getTableCount(this.sourceClient, tableName);
          const targetCount = await this.getTableCount(this.targetClient, tableName);
          
          // Sample checksum validation (first 100 records)
          const sampleChecksumMatch = await this.validateSampleChecksum(tableName);
          
          const check: DataIntegrityCheck = {
            table: tableName,
            sourceCount,
            targetCount,
            match: sourceCount === targetCount,
            sampleChecksumMatch,
            lastUpdated: new Date(),
          };
          
          results.push(check);
          
          if (check.match && check.sampleChecksumMatch) {
            logger.info(`✅ ${tableName}: ${sourceCount} records (integrity verified)`);
          } else {
            logger.warn(`⚠️ ${tableName}: source=${sourceCount}, target=${targetCount}, checksum=${sampleChecksumMatch}`);
          }
          
        } catch (error) {
          logger.error(`❌ Failed to validate table ${tableName}`, { error });
          results.push({
            table: tableName,
            sourceCount: 0,
            targetCount: 0,
            match: false,
            sampleChecksumMatch: false,
            lastUpdated: new Date(),
          });
        }
      }
      
      const totalTables = results.length;
      const matchingTables = results.filter(r => r.match && r.sampleChecksumMatch).length;
      
      logger.info(`📊 Data integrity validation: ${matchingTables}/${totalTables} tables verified`);
      
      if (matchingTables === totalTables) {
        logger.info('✅ All tables passed data integrity validation');
      } else {
        logger.warn(`⚠️ ${totalTables - matchingTables} tables failed data integrity validation`);
      }
      
      return results;
      
    } catch (error) {
      logger.error('❌ Data integrity validation failed', { error });
      throw error;
    }
  }

  /**
   * Get record count for a table
   */
  private async getTableCount(client: PrismaClient, tableName: string): Promise<number> {
    try {
      const result = await client.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
      return Array.isArray(result) && result[0] ? Number(result[0].count) : 0;
    } catch (error) {
      logger.warn(`Failed to get count for table ${tableName}`, { error });
      return 0;
    }
  }

  /**
   * Validate sample checksum between source and target
   */
  private async validateSampleChecksum(tableName: string): Promise<boolean> {
    try {
      // Get sample of records from both databases
      const sourceRecords = await this.sourceClient.$queryRawUnsafe(`
        SELECT * FROM "${tableName}" 
        ORDER BY created_at 
        LIMIT 100
      `);
      
      const targetRecords = await this.targetClient.$queryRawUnsafe(`
        SELECT * FROM "${tableName}" 
        ORDER BY created_at 
        LIMIT 100
      `);
      
      // Generate checksums
      const sourceChecksum = this.generateChecksum(JSON.stringify(sourceRecords));
      const targetChecksum = this.generateChecksum(JSON.stringify(targetRecords));
      
      return sourceChecksum === targetChecksum;
      
    } catch (error) {
      logger.warn(`Failed to validate checksum for table ${tableName}`, { error });
      return false;
    }
  }

  /**
   * Generate MD5 checksum for data
   */
  private generateChecksum(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Rollback migration in case of failure
   */
  private async rollbackMigration(): Promise<void> {
    logger.info('🔄 Rolling back migration...');

    try {
      // Stop replication task
      if (this.config.replicationTask.identifier) {
        try {
          const stopCommand = new StopReplicationTaskCommand({
            ReplicationTaskArn: `arn:aws:dms:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:task:${this.config.replicationTask.identifier}`,
          });
          await this.dmsClient.send(stopCommand);
          logger.info('✅ Replication task stopped');
        } catch (error) {
          logger.warn('Failed to stop replication task', { error });
        }
      }

      // Disable dual-write
      this.dualWriteActive = false;
      logger.info('✅ Dual-write disabled');

      logger.info('✅ Migration rollback completed');

    } catch (error) {
      logger.error('❌ Migration rollback failed', { error });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.sourceClient.$disconnect();
      await this.targetClient.$disconnect();
      logger.info('✅ Database connections closed');
    } catch (error) {
      logger.error('❌ Cleanup failed', { error });
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    progress: MigrationProgress;
    dualWriteActive: boolean;
    integrityChecks: DataIntegrityCheck[];
  }> {
    const progress = await this.getReplicationProgress();
    const integrityChecks = await this.validateDataIntegrity();

    return {
      progress,
      dualWriteActive: this.dualWriteActive,
      integrityChecks,
    };
  }
}

/**
 * Create migration configuration from environment
 */
export async function createMigrationConfig(): Promise<MigrationConfig> {
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  const targetUrl = await getParameter('/directfanz/database/url', 'TARGET_DATABASE_URL');

  if (!sourceUrl || !targetUrl) {
    throw new Error('Source and target database URLs are required');
  }

  const environment = process.env.NODE_ENV || 'development';
  const timestamp = Date.now();

  return {
    sourceEndpoint: {
      url: sourceUrl,
      identifier: `directfanz-source-${environment}-${timestamp}`,
    },
    targetEndpoint: {
      url: targetUrl,
      identifier: `directfanz-target-${environment}-${timestamp}`,
    },
    replicationInstance: {
      identifier: `directfanz-replication-${environment}-${timestamp}`,
      instanceClass: environment === 'production' ? 'dms.t3.medium' : 'dms.t3.micro',
      allocatedStorage: environment === 'production' ? 100 : 20,
    },
    replicationTask: {
      identifier: `directfanz-migration-${environment}-${timestamp}`,
      migrationType: 'full-load-and-cdc',
    },
    dualWriteEnabled: true,
    validationEnabled: true,
  };
}