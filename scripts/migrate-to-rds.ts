#!/usr/bin/env tsx

/**
 * Database migration script for AWS RDS deployment
 * Handles migration from existing database to RDS with validation
 */

import { PrismaClient } from '@prisma/client';
import { getParameter, isRunningInECS } from '../src/lib/aws-config';
import { generatePgBouncerConfig, shouldUsePgBouncer } from '../src/lib/pgbouncer-config';
import { logger } from '../src/lib/logger';

interface MigrationConfig {
  sourceUrl: string;
  targetUrl: string;
  batchSize: number;
  validateData: boolean;
  dryRun: boolean;
}

class RDSMigrator {
  private sourceClient: PrismaClient;
  private targetClient: PrismaClient;
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
    
    this.sourceClient = new PrismaClient({
      datasources: { db: { url: config.sourceUrl } },
      log: ['error', 'warn'],
    });

    this.targetClient = new PrismaClient({
      datasources: { db: { url: config.targetUrl } },
      log: ['error', 'warn'],
    });
  }

  /**
   * Validate database connections
   */
  async validateConnections(): Promise<void> {
    logger.info('Validating database connections...');

    try {
      // Test source connection
      await this.sourceClient.$executeRaw`SELECT 1 as source_test`;
      logger.info('✅ Source database connection validated');

      // Test target connection
      await this.targetClient.$executeRaw`SELECT 1 as target_test`;
      logger.info('✅ Target RDS database connection validated');

      // Check if target database is empty or has expected schema
      const tables = await this.targetClient.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `;

      if (tables.length === 0) {
        logger.warn('⚠️ Target database appears to be empty - ensure schema is deployed');
      } else {
        logger.info(`✅ Target database has ${tables.length} tables`);
      }

    } catch (error) {
      logger.error('❌ Database connection validation failed', { error });
      throw error;
    }
  }

  /**
   * Compare schemas between source and target
   */
  async compareSchemas(): Promise<boolean> {
    logger.info('Comparing database schemas...');

    try {
      // Get table structures from both databases
      const sourceSchema = await this.getSchemaInfo(this.sourceClient);
      const targetSchema = await this.getSchemaInfo(this.targetClient);

      // Compare table counts
      if (sourceSchema.tables.length !== targetSchema.tables.length) {
        logger.error('❌ Table count mismatch', {
          source: sourceSchema.tables.length,
          target: targetSchema.tables.length,
        });
        return false;
      }

      // Compare individual tables
      for (const sourceTable of sourceSchema.tables) {
        const targetTable = targetSchema.tables.find(t => t.table_name === sourceTable.table_name);
        if (!targetTable) {
          logger.error(`❌ Table missing in target: ${sourceTable.table_name}`);
          return false;
        }
      }

      logger.info('✅ Schema comparison passed');
      return true;

    } catch (error) {
      logger.error('❌ Schema comparison failed', { error });
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
   * Migrate data from source to target
   */
  async migrateData(): Promise<void> {
    logger.info('Starting data migration...');

    if (this.config.dryRun) {
      logger.info('🔍 DRY RUN MODE - No data will be modified');
    }

    // Define migration order (respecting foreign key constraints)
    const migrationOrder = [
      'users',
      'artists',
      'tiers',
      'content',
      'subscriptions',
      'live_streams',
      'messages',
      'comments',
      'content_likes',
      'content_views',
      'playlists',
      'playlist_items',
      'campaigns',
      'challenges',
      'challenge_participations',
      'challenge_submissions',
      'stream_chat_messages',
      'stream_tips',
      'stream_viewers',
      'invoices',
      'payment_failures',
      'reports',
      'sessions',
      'accounts',
      'verificationtokens',
      'refresh_tokens',
      'oauth_tokens',
    ];

    for (const tableName of migrationOrder) {
      await this.migrateTable(tableName);
    }

    logger.info('✅ Data migration completed');
  }

  /**
   * Migrate a single table
   */
  private async migrateTable(tableName: string): Promise<void> {
    try {
      logger.info(`Migrating table: ${tableName}`);

      // Check if table exists in source
      const sourceCount = await this.getTableCount(this.sourceClient, tableName);
      if (sourceCount === 0) {
        logger.info(`⏭️ Skipping empty table: ${tableName}`);
        return;
      }

      // Check current target count
      const targetCount = await this.getTableCount(this.targetClient, tableName);
      logger.info(`📊 ${tableName}: source=${sourceCount}, target=${targetCount}`);

      if (targetCount > 0 && !this.config.dryRun) {
        logger.warn(`⚠️ Target table ${tableName} already has data - skipping to avoid duplicates`);
        return;
      }

      if (this.config.dryRun) {
        logger.info(`🔍 Would migrate ${sourceCount} records from ${tableName}`);
        return;
      }

      // Migrate data in batches
      let offset = 0;
      let migratedCount = 0;

      while (offset < sourceCount) {
        const batch = await this.sourceClient.$queryRawUnsafe(`
          SELECT * FROM "${tableName}" 
          ORDER BY created_at 
          LIMIT ${this.config.batchSize} 
          OFFSET ${offset}
        `);

        if (Array.isArray(batch) && batch.length > 0) {
          // Insert batch into target
          await this.insertBatch(tableName, batch);
          migratedCount += batch.length;
          offset += batch.length;

          logger.info(`📈 ${tableName}: migrated ${migratedCount}/${sourceCount} records`);
        } else {
          break;
        }
      }

      // Validate migration
      if (this.config.validateData) {
        const finalTargetCount = await this.getTableCount(this.targetClient, tableName);
        if (finalTargetCount !== sourceCount) {
          throw new Error(`Migration validation failed for ${tableName}: expected ${sourceCount}, got ${finalTargetCount}`);
        }
      }

      logger.info(`✅ ${tableName}: migration completed (${migratedCount} records)`);

    } catch (error) {
      logger.error(`❌ Failed to migrate table ${tableName}`, { error });
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
      // Table might not exist
      return 0;
    }
  }

  /**
   * Insert batch of records into target table
   */
  private async insertBatch(tableName: string, records: any[]): Promise<void> {
    if (records.length === 0) return;

    // Get column names from first record
    const columns = Object.keys(records[0]);
    const columnList = columns.map(col => `"${col}"`).join(', ');
    
    // Build values placeholder
    const valuePlaceholders = records.map((_, index) => {
      const recordPlaceholders = columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`);
      return `(${recordPlaceholders.join(', ')})`;
    }).join(', ');

    // Flatten all values
    const values = records.flatMap(record => columns.map(col => record[col]));

    // Build and execute insert query
    const query = `
      INSERT INTO "${tableName}" (${columnList}) 
      VALUES ${valuePlaceholders}
      ON CONFLICT DO NOTHING
    `;

    await this.targetClient.$executeRawUnsafe(query, ...values);
  }

  /**
   * Cleanup connections
   */
  async cleanup(): Promise<void> {
    await this.sourceClient.$disconnect();
    await this.targetClient.$disconnect();
  }
}

/**
 * Main migration function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipValidation = args.includes('--skip-validation');

  try {
    logger.info('🚀 Starting RDS migration process...');

    // Get database URLs
    const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
    const targetUrl = await getParameter('/directfanz/database/url', 'TARGET_DATABASE_URL');

    if (!sourceUrl || !targetUrl) {
      throw new Error('Source and target database URLs are required');
    }

    if (sourceUrl === targetUrl) {
      throw new Error('Source and target URLs cannot be the same');
    }

    // Configuration
    const config: MigrationConfig = {
      sourceUrl,
      targetUrl,
      batchSize: 1000,
      validateData: !skipValidation,
      dryRun,
    };

    logger.info('Migration configuration:', {
      sourceUrl: sourceUrl.replace(/:[^:@]*@/, ':***@'), // Hide password
      targetUrl: targetUrl.replace(/:[^:@]*@/, ':***@'), // Hide password
      batchSize: config.batchSize,
      validateData: config.validateData,
      dryRun: config.dryRun,
    });

    // Initialize migrator
    const migrator = new RDSMigrator(config);

    // Validate connections
    await migrator.validateConnections();

    // Compare schemas
    const schemaMatch = await migrator.compareSchemas();
    if (!schemaMatch) {
      throw new Error('Schema mismatch detected - please ensure target schema is up to date');
    }

    // Migrate data
    await migrator.migrateData();

    // Cleanup
    await migrator.cleanup();

    logger.info('🎉 RDS migration completed successfully!');

    if (dryRun) {
      logger.info('💡 This was a dry run. Use without --dry-run to perform actual migration.');
    }

  } catch (error) {
    logger.error('❌ Migration failed', { error });
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  main();
}

export { RDSMigrator, MigrationConfig };