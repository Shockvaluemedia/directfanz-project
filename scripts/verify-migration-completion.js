#!/usr/bin/env node

/**
 * Verify Migration Completion Script
 * 
 * Validates that all data migration phases have been completed successfully
 * before proceeding with production cutover.
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { RedisClientType, createClient } from 'redis';

const prisma = new PrismaClient();
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

interface MigrationStatus {
  database: {
    completed: boolean;
    recordCount: number;
    lastSyncTime: Date | null;
  };
  storage: {
    completed: boolean;
    objectCount: number;
    lastSyncTime: Date | null;
  };
  cache: {
    completed: boolean;
    keyCount: number;
    lastRebuildTime: Date | null;
  };
}

async function verifyDatabaseMigration(): Promise<MigrationStatus['database']> {
  console.log('🔍 Verifying database migration...');

  try {
    // Check if migration tracking table exists and has completion status
    const migrationStatus = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_records,
        MAX(updated_at) as last_sync_time,
        BOOL_AND(migration_completed) as all_completed
      FROM migration_tracking
    `;

    const recordCount = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM "User") as users,
        (SELECT COUNT(*) FROM "Content") as content,
        (SELECT COUNT(*) FROM "Subscription") as subscriptions,
        (SELECT COUNT(*) FROM "Campaign") as campaigns
    `;

    console.log('✅ Database migration verification completed');
    console.log(`   Records migrated: ${JSON.stringify(recordCount)}`);

    return {
      completed: migrationStatus[0]?.all_completed || false,
      recordCount: parseInt(migrationStatus[0]?.total_records) || 0,
      lastSyncTime: migrationStatus[0]?.last_sync_time || null
    };

  } catch (error) {
    console.error('❌ Database migration verification failed:', error);
    return {
      completed: false,
      recordCount: 0,
      lastSyncTime: null
    };
  }
}

async function verifyStorageMigration(): Promise<MigrationStatus['storage']> {
  console.log('🔍 Verifying S3 storage migration...');

  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME || 'directfanz-content-production';
    
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1000
    });

    const response = await s3Client.send(listCommand);
    const objectCount = response.KeyCount || 0;

    // Check migration status from database
    const migrationStatus = await prisma.$queryRaw`
      SELECT 
        migration_completed,
        last_sync_time
      FROM s3_migration_status 
      WHERE bucket_name = ${bucketName}
      ORDER BY last_sync_time DESC 
      LIMIT 1
    `;

    console.log('✅ S3 storage migration verification completed');
    console.log(`   Objects in bucket: ${objectCount}`);

    return {
      completed: migrationStatus[0]?.migration_completed || false,
      objectCount,
      lastSyncTime: migrationStatus[0]?.last_sync_time || null
    };

  } catch (error) {
    console.error('❌ S3 storage migration verification failed:', error);
    return {
      completed: false,
      objectCount: 0,
      lastSyncTime: null
    };
  }
}

async function verifyCacheMigration(): Promise<MigrationStatus['cache']> {
  console.log('🔍 Verifying cache migration...');

  try {
    const redis = createClient({
      url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
    });

    await redis.connect();

    // Get cache statistics
    const info = await redis.info('keyspace');
    const keyCount = info.includes('keys=') 
      ? parseInt(info.split('keys=')[1].split(',')[0]) 
      : 0;

    // Check cache rebuild status
    const rebuildStatus = await redis.get('cache:rebuild:status');
    const lastRebuildTime = await redis.get('cache:rebuild:timestamp');

    await redis.disconnect();

    console.log('✅ Cache migration verification completed');
    console.log(`   Keys in cache: ${keyCount}`);

    return {
      completed: rebuildStatus === 'completed',
      keyCount,
      lastRebuildTime: lastRebuildTime ? new Date(lastRebuildTime) : null
    };

  } catch (error) {
    console.error('❌ Cache migration verification failed:', error);
    return {
      completed: false,
      keyCount: 0,
      lastRebuildTime: null
    };
  }
}

async function main() {
  console.log('🚀 Verifying Migration Completion');
  console.log('==================================');

  try {
    const status: MigrationStatus = {
      database: await verifyDatabaseMigration(),
      storage: await verifyStorageMigration(),
      cache: await verifyCacheMigration()
    };

    console.log('\n📊 Migration Status Summary:');
    console.log('----------------------------');
    console.log(`Database: ${status.database.completed ? '✅ Completed' : '❌ Incomplete'}`);
    console.log(`  Records: ${status.database.recordCount}`);
    console.log(`  Last Sync: ${status.database.lastSyncTime || 'Never'}`);
    
    console.log(`Storage: ${status.storage.completed ? '✅ Completed' : '❌ Incomplete'}`);
    console.log(`  Objects: ${status.storage.objectCount}`);
    console.log(`  Last Sync: ${status.storage.lastSyncTime || 'Never'}`);
    
    console.log(`Cache: ${status.cache.completed ? '✅ Completed' : '❌ Incomplete'}`);
    console.log(`  Keys: ${status.cache.keyCount}`);
    console.log(`  Last Rebuild: ${status.cache.lastRebuildTime || 'Never'}`);

    const allCompleted = status.database.completed && 
                        status.storage.completed && 
                        status.cache.completed;

    if (allCompleted) {
      console.log('\n🎉 All migrations completed successfully!');
      console.log('Ready for production cutover.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Migration incomplete - cannot proceed with cutover');
      console.log('Please complete all migration phases before cutover.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();