#!/usr/bin/env node

/**
 * Verify Backup Status Script
 * 
 * Ensures all critical backups are in place and verified before cutover
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BackupStatus {
  database: {
    available: boolean;
    lastBackup: Date | null;
    verified: boolean;
    size: string;
  };
  storage: {
    available: boolean;
    lastBackup: Date | null;
    verified: boolean;
    objectCount: number;
  };
  configuration: {
    available: boolean;
    lastBackup: Date | null;
    verified: boolean;
  };
}

function executeCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return '';
  }
}

async function verifyDatabaseBackup(): Promise<BackupStatus['database']> {
  console.log('🔍 Verifying database backup status...');

  try {
    // Check RDS automated backups
    const backupInfo = executeCommand(`
      aws rds describe-db-instances \\
        --db-instance-identifier directfanz-postgres-production \\
        --query 'DBInstances[0].{BackupRetentionPeriod:BackupRetentionPeriod,LatestRestorableTime:LatestRestorableTime,PreferredBackupWindow:PreferredBackupWindow}' \\
        --output json
    `);

    if (!backupInfo) {
      throw new Error('Could not retrieve RDS backup information');
    }

    const backup = JSON.parse(backupInfo);
    const lastBackup = backup.LatestRestorableTime ? new Date(backup.LatestRestorableTime) : null;
    const backupAge = lastBackup ? Date.now() - lastBackup.getTime() : Infinity;
    
    // Backup should be less than 24 hours old
    const isRecent = backupAge < 24 * 60 * 60 * 1000;

    // Get database size
    const sizeResult = await prisma.$queryRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    const size = sizeResult[0]?.size || 'Unknown';

    console.log('✅ Database backup verification completed');
    console.log(`   Last backup: ${lastBackup?.toISOString() || 'Unknown'}`);
    console.log(`   Database size: ${size}`);

    return {
      available: !!lastBackup,
      lastBackup,
      verified: isRecent,
      size
    };

  } catch (error) {
    console.error('❌ Database backup verification failed:', error);
    return {
      available: false,
      lastBackup: null,
      verified: false,
      size: 'Unknown'
    };
  }
}

async function verifyStorageBackup(): Promise<BackupStatus['storage']> {
  console.log('🔍 Verifying S3 storage backup status...');

  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME || 'directfanz-content-production';
    const backupBucket = `${bucketName}-backup`;

    // Check if backup bucket exists and has recent backups
    const backupInfo = executeCommand(`
      aws s3api head-bucket --bucket ${backupBucket} 2>/dev/null && \\
      aws s3 ls s3://${backupBucket}/ --recursive --summarize | tail -2
    `);

    if (!backupInfo) {
      throw new Error('Backup bucket not accessible or empty');
    }

    // Get object count from backup bucket
    const objectCountMatch = backupInfo.match(/Total Objects: (\d+)/);
    const objectCount = objectCountMatch ? parseInt(objectCountMatch[1]) : 0;

    // Check versioning status
    const versioningInfo = executeCommand(`
      aws s3api get-bucket-versioning --bucket ${bucketName}
    `);

    const versioning = JSON.parse(versioningInfo || '{}');
    const versioningEnabled = versioning.Status === 'Enabled';

    // Check cross-region replication
    const replicationInfo = executeCommand(`
      aws s3api get-bucket-replication --bucket ${bucketName} 2>/dev/null || echo '{}'
    `);

    const replication = JSON.parse(replicationInfo);
    const replicationEnabled = !!replication.ReplicationConfiguration;

    console.log('✅ S3 storage backup verification completed');
    console.log(`   Backup objects: ${objectCount}`);
    console.log(`   Versioning: ${versioningEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   Replication: ${replicationEnabled ? 'Enabled' : 'Disabled'}`);

    return {
      available: objectCount > 0,
      lastBackup: new Date(), // S3 backups are continuous
      verified: versioningEnabled && replicationEnabled,
      objectCount
    };

  } catch (error) {
    console.error('❌ S3 storage backup verification failed:', error);
    return {
      available: false,
      lastBackup: null,
      verified: false,
      objectCount: 0
    };
  }
}

async function verifyConfigurationBackup(): Promise<BackupStatus['configuration']> {
  console.log('🔍 Verifying configuration backup status...');

  try {
    // Check if Terraform state is backed up
    const stateBackup = executeCommand(`
      aws s3 ls s3://directfanz-terraform-state/terraform.tfstate
    `);

    // Check if environment variables are backed up
    const envBackup = executeCommand(`
      aws s3 ls s3://directfanz-config-backup/production/
    `);

    // Check if infrastructure code is in version control
    const gitStatus = executeCommand('git status --porcelain infrastructure/');

    const hasStateBackup = !!stateBackup;
    const hasEnvBackup = !!envBackup;
    const hasCleanGit = gitStatus.trim() === '';

    console.log('✅ Configuration backup verification completed');
    console.log(`   Terraform state backup: ${hasStateBackup ? 'Available' : 'Missing'}`);
    console.log(`   Environment backup: ${hasEnvBackup ? 'Available' : 'Missing'}`);
    console.log(`   Git status: ${hasCleanGit ? 'Clean' : 'Uncommitted changes'}`);

    return {
      available: hasStateBackup && hasEnvBackup,
      lastBackup: new Date(),
      verified: hasStateBackup && hasEnvBackup && hasCleanGit
    };

  } catch (error) {
    console.error('❌ Configuration backup verification failed:', error);
    return {
      available: false,
      lastBackup: null,
      verified: false
    };
  }
}

async function main() {
  console.log('🚀 Verifying Backup Status');
  console.log('==========================');

  try {
    const status: BackupStatus = {
      database: await verifyDatabaseBackup(),
      storage: await verifyStorageBackup(),
      configuration: await verifyConfigurationBackup()
    };

    console.log('\n📊 Backup Status Summary:');
    console.log('-------------------------');
    
    console.log(`Database Backup: ${status.database.available ? '✅ Available' : '❌ Missing'}`);
    console.log(`  Last Backup: ${status.database.lastBackup?.toISOString() || 'Unknown'}`);
    console.log(`  Verified: ${status.database.verified ? '✅ Yes' : '❌ No'}`);
    console.log(`  Size: ${status.database.size}`);
    
    console.log(`Storage Backup: ${status.storage.available ? '✅ Available' : '❌ Missing'}`);
    console.log(`  Objects: ${status.storage.objectCount}`);
    console.log(`  Verified: ${status.storage.verified ? '✅ Yes' : '❌ No'}`);
    
    console.log(`Configuration Backup: ${status.configuration.available ? '✅ Available' : '❌ Missing'}`);
    console.log(`  Verified: ${status.configuration.verified ? '✅ Yes' : '❌ No'}`);

    const allVerified = status.database.verified && 
                       status.storage.verified && 
                       status.configuration.verified;

    if (allVerified) {
      console.log('\n🎉 All backups verified successfully!');
      console.log('Safe to proceed with production cutover.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Backup verification failed - high risk for cutover');
      console.log('Please ensure all backups are in place and verified.');
      
      // Still allow cutover but with warning
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('Do you want to proceed anyway? (yes/no): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'yes') {
          console.log('⚠️  Proceeding with cutover despite backup issues');
          process.exit(0);
        } else {
          console.log('Cutover cancelled - please fix backup issues first');
          process.exit(1);
        }
      });
    }

  } catch (error) {
    console.error('❌ Backup verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();