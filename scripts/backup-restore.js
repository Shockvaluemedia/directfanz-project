#!/usr/bin/env node

/**
 * Backup and Disaster Recovery Script
 * Automates database backups, file backups, and disaster recovery procedures
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function executeCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options,
    });
    return result;
  } catch (error) {
    log(`Error executing command: ${command}`, colors.red);
    log(error.message, colors.red);
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

// Backup configurations
const backupConfigs = {
  databases: {
    postgresql: {
      backupCommand: (host, port, database, username, filename) =>
        `PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --verbose --clean --no-owner --no-acl --format=custom -f ${filename}`,
      restoreCommand: (host, port, database, username, filename) =>
        `PGPASSWORD=$POSTGRES_PASSWORD pg_restore -h ${host} -p ${port} -U ${username} -d ${database} --verbose --clean --no-owner --no-acl ${filename}`,
    },
    mysql: {
      backupCommand: (host, port, database, username, filename) =>
        `mysqldump -h ${host} -P ${port} -u ${username} -p${password} ${database} > ${filename}`,
      restoreCommand: (host, port, database, username, filename) =>
        `mysql -h ${host} -P ${port} -u ${username} -p${password} ${database} < ${filename}`,
    },
  },

  storage: {
    s3: {
      uploadCommand: (localPath, s3Path) => `aws s3 cp ${localPath} ${s3Path} --recursive`,
      downloadCommand: (s3Path, localPath) => `aws s3 cp ${s3Path} ${localPath} --recursive`,
      syncCommand: (localPath, s3Path) => `aws s3 sync ${localPath} ${s3Path} --delete`,
    },
    gcs: {
      uploadCommand: (localPath, gcsPath) => `gsutil -m cp -r ${localPath} ${gcsPath}`,
      downloadCommand: (gcsPath, localPath) => `gsutil -m cp -r ${gcsPath} ${localPath}`,
      syncCommand: (localPath, gcsPath) => `gsutil -m rsync -r -d ${localPath} ${gcsPath}`,
    },
  },
};

// Backup schedule configurations
const backupSchedules = {
  cron: {
    daily: '0 2 * * *',
    weekly: '0 2 * * 0',
    monthly: '0 2 1 * *',
  },
};

class BackupManager {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || './backups';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      log(`Created backup directory: ${this.backupDir}`, colors.green);
    }
  }

  async backupDatabase() {
    log('🗄️ Starting database backup...', colors.cyan);

    const dbType = await question('Database type (postgresql/mysql): ');
    if (!backupConfigs.databases[dbType]) {
      throw new Error(`Unsupported database type: ${dbType}`);
    }

    const config = backupConfigs.databases[dbType];
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || (dbType === 'postgresql' ? '5432' : '3306');
    const database = process.env.DB_NAME || (await question('Database name: '));
    const username = process.env.DB_USER || (await question('Database username: '));

    const filename = path.join(this.backupDir, `${database}_${this.timestamp}.backup`);
    const command = config.backupCommand(host, port, database, username, filename);

    log(`Backing up database ${database}...`, colors.blue);
    executeCommand(command);

    // Compress backup
    log('Compressing backup...', colors.blue);
    executeCommand(`gzip ${filename}`);

    const compressedFile = `${filename}.gz`;
    log(`✅ Database backup completed: ${compressedFile}`, colors.green);

    return compressedFile;
  }

  async restoreDatabase() {
    log('🔄 Starting database restoration...', colors.cyan);

    const backupFile = await question('Backup file path: ');
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    const dbType = await question('Database type (postgresql/mysql): ');
    if (!backupConfigs.databases[dbType]) {
      throw new Error(`Unsupported database type: ${dbType}`);
    }

    const config = backupConfigs.databases[dbType];
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || (dbType === 'postgresql' ? '5432' : '3306');
    const database = process.env.DB_NAME || (await question('Database name: '));
    const username = process.env.DB_USER || (await question('Database username: '));

    // Decompress if needed
    let fileToRestore = backupFile;
    if (backupFile.endsWith('.gz')) {
      log('Decompressing backup...', colors.blue);
      executeCommand(`gunzip -c ${backupFile} > ${backupFile.replace('.gz', '')}`);
      fileToRestore = backupFile.replace('.gz', '');
    }

    // Confirm restoration
    const confirm = await question(
      `⚠️ This will replace the current database "${database}". Continue? (y/N): `
    );
    if (confirm.toLowerCase() !== 'y') {
      log('Database restoration cancelled.', colors.yellow);
      return;
    }

    const command = config.restoreCommand(host, port, database, username, fileToRestore);

    log(`Restoring database ${database}...`, colors.blue);
    executeCommand(command);

    log('✅ Database restoration completed!', colors.green);
  }

  async backupFiles() {
    log('📁 Starting file backup...', colors.cyan);

    const sourceDirs = [
      './uploads',
      './public/uploads',
      './storage',
      './.env.production',
      './package.json',
      './next.config.js',
    ].filter(dir => fs.existsSync(dir));

    if (sourceDirs.length === 0) {
      log('No files to backup found.', colors.yellow);
      return;
    }

    const backupPath = path.join(this.backupDir, `files_${this.timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    for (const sourceDir of sourceDirs) {
      log(`Backing up ${sourceDir}...`, colors.blue);
      if (fs.statSync(sourceDir).isDirectory()) {
        executeCommand(`cp -r ${sourceDir} ${backupPath}/`, { ignoreError: true });
      } else {
        executeCommand(`cp ${sourceDir} ${backupPath}/`, { ignoreError: true });
      }
    }

    // Create archive
    const archiveName = `${backupPath}.tar.gz`;
    executeCommand(`tar -czf ${archiveName} -C ${this.backupDir} files_${this.timestamp}`);

    // Remove uncompressed directory
    executeCommand(`rm -rf ${backupPath}`);

    log(`✅ File backup completed: ${archiveName}`, colors.green);
    return archiveName;
  }

  async uploadToCloud() {
    log('☁️ Uploading backups to cloud storage...', colors.cyan);

    const provider = await question('Cloud provider (s3/gcs): ');
    if (!backupConfigs.storage[provider]) {
      throw new Error(`Unsupported cloud provider: ${provider}`);
    }

    const config = backupConfigs.storage[provider];
    const bucketName = process.env.BACKUP_BUCKET || (await question('Bucket/Container name: '));
    const cloudPath =
      provider === 's3' ? `s3://${bucketName}/backups/` : `gs://${bucketName}/backups/`;

    log(`Uploading to ${provider.toUpperCase()}...`, colors.blue);
    const command = config.uploadCommand(this.backupDir, cloudPath);
    executeCommand(command);

    log('✅ Cloud upload completed!', colors.green);
  }

  async downloadFromCloud() {
    log('☁️ Downloading backups from cloud storage...', colors.cyan);

    const provider = await question('Cloud provider (s3/gcs): ');
    if (!backupConfigs.storage[provider]) {
      throw new Error(`Unsupported cloud provider: ${provider}`);
    }

    const config = backupConfigs.storage[provider];
    const bucketName = process.env.BACKUP_BUCKET || (await question('Bucket/Container name: '));
    const cloudPath =
      provider === 's3' ? `s3://${bucketName}/backups/` : `gs://${bucketName}/backups/`;
    const localPath = './restored-backups';

    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true });
    }

    log(`Downloading from ${provider.toUpperCase()}...`, colors.blue);
    const command = config.downloadCommand(cloudPath, localPath);
    executeCommand(command);

    log(`✅ Cloud download completed to: ${localPath}`, colors.green);
  }

  listBackups() {
    log('📋 Available backups:', colors.cyan);

    if (!fs.existsSync(this.backupDir)) {
      log('No backups found.', colors.yellow);
      return;
    }

    const files = fs.readdirSync(this.backupDir);
    const backups = files.filter(
      file => file.endsWith('.backup.gz') || file.endsWith('.tar.gz') || file.endsWith('.sql.gz')
    );

    if (backups.length === 0) {
      log('No backups found.', colors.yellow);
      return;
    }

    backups.forEach((backup, index) => {
      const stats = fs.statSync(path.join(this.backupDir, backup));
      const size = (stats.size / (1024 * 1024)).toFixed(2);
      log(`${index + 1}. ${backup} (${size} MB) - ${stats.mtime.toISOString()}`, colors.yellow);
    });
  }

  async cleanupOldBackups() {
    log('🧹 Cleaning up old backups...', colors.cyan);

    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    if (!fs.existsSync(this.backupDir)) {
      log('No backup directory found.', colors.yellow);
      return;
    }

    const files = fs.readdirSync(this.backupDir);
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(this.backupDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        log(`Deleted old backup: ${file}`, colors.blue);
        deletedCount++;
      }
    });

    log(`✅ Cleanup completed. Deleted ${deletedCount} old backups.`, colors.green);
  }
}

async function createBackupScript() {
  log('📜 Creating automated backup script...', colors.cyan);

  const backupScript = `#!/bin/bash

# Automated Backup Script for Direct Fan Platform
# This script performs automated backups and can be scheduled with cron

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

# Configuration
BACKUP_DIR="\${BACKUP_DIR:-/app/backups}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="/var/log/backup.log"

# Logging function
log() {
    echo -e "\$(date '+%Y-%m-%d %H:%M:%S') - \$1" | tee -a "\$LOG_FILE"
}

# Error handling
error_exit() {
    log "\${RED}ERROR: \$1\${NC}"
    exit 1
}

# Create backup directory
mkdir -p "\$BACKUP_DIR"

log "\${BLUE}Starting automated backup - \$TIMESTAMP\${NC}"

# Database backup
if [ ! -z "\$DATABASE_URL" ]; then
    log "\${BLUE}Backing up PostgreSQL database...\${NC}"
    
    # Extract database connection details from DATABASE_URL
    DB_HOST=\$(echo \$DATABASE_URL | sed -n 's/.*@\\([^:]*\\).*/\\1/p')
    DB_PORT=\$(echo \$DATABASE_URL | sed -n 's/.*:\\([0-9]*\\)\\/.*/\\1/p')
    DB_NAME=\$(echo \$DATABASE_URL | sed -n 's/.*\\/\\([^?]*\\).*/\\1/p')
    DB_USER=\$(echo \$DATABASE_URL | sed -n 's/.*\\/\\/\\([^:]*\\).*/\\1/p')
    
    BACKUP_FILE="\$BACKUP_DIR/database_\$TIMESTAMP.backup"
    
    if PGPASSWORD=\$POSTGRES_PASSWORD pg_dump -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" --verbose --clean --no-owner --no-acl --format=custom -f "\$BACKUP_FILE"; then
        gzip "\$BACKUP_FILE"
        log "\${GREEN}Database backup completed: \$BACKUP_FILE.gz\${NC}"
    else
        error_exit "Database backup failed"
    fi
fi

# File backup
log "\${BLUE}Backing up application files...\${NC}"
FILES_BACKUP="\$BACKUP_DIR/files_\$TIMESTAMP.tar.gz"

# Create list of directories/files to backup
BACKUP_PATHS=(
    "./uploads"
    "./public/uploads"
    "./storage"
    "./.env.production"
    "./package.json"
    "./next.config.js"
)

# Create archive of existing files
EXISTING_PATHS=()
for path in "\${BACKUP_PATHS[@]}"; do
    if [ -e "\$path" ]; then
        EXISTING_PATHS+=("\$path")
    fi
done

if [ \${#EXISTING_PATHS[@]} -gt 0 ]; then
    if tar -czf "\$FILES_BACKUP" "\${EXISTING_PATHS[@]}"; then
        log "\${GREEN}Files backup completed: \$FILES_BACKUP\${NC}"
    else
        error_exit "Files backup failed"
    fi
else
    log "\${YELLOW}No files found to backup\${NC}"
fi

# Upload to cloud storage (if configured)
if [ ! -z "\$BACKUP_BUCKET" ] && [ ! -z "\$AWS_ACCESS_KEY_ID" ]; then
    log "\${BLUE}Uploading backups to S3...\${NC}"
    if aws s3 sync "\$BACKUP_DIR" "s3://\$BACKUP_BUCKET/backups/" --exclude "*" --include "*.gz"; then
        log "\${GREEN}Cloud upload completed\${NC}"
    else
        log "\${YELLOW}Cloud upload failed, backups stored locally only\${NC}"
    fi
fi

# Cleanup old backups
RETENTION_DAYS=\${BACKUP_RETENTION_DAYS:-30}
log "\${BLUE}Cleaning up backups older than \$RETENTION_DAYS days...\${NC}"
find "\$BACKUP_DIR" -type f -name "*.gz" -mtime +\$RETENTION_DAYS -delete
log "\${GREEN}Old backup cleanup completed\${NC}"

# Send notification (if configured)
if [ ! -z "\$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \\
        --data "{\\"text\\":\\"✅ Automated backup completed successfully at \$TIMESTAMP\\"}" \\
        "\$SLACK_WEBHOOK_URL" || log "\${YELLOW}Failed to send Slack notification\${NC}"
fi

log "\${GREEN}Automated backup completed successfully!\${NC}"
`;

  fs.writeFileSync('scripts/automated-backup.sh', backupScript);
  executeCommand('chmod +x scripts/automated-backup.sh');
  log('✅ Created automated backup script: scripts/automated-backup.sh', colors.green);
}

async function createCronJob() {
  log('⏰ Setting up cron job for automated backups...', colors.cyan);

  const frequency = await question('Backup frequency (daily/weekly/monthly): ');
  const schedule = backupSchedules.cron[frequency];

  if (!schedule) {
    throw new Error(`Invalid frequency: ${frequency}`);
  }

  const cronEntry = `${schedule} /usr/bin/docker exec direct-fan-platform-app /app/scripts/automated-backup.sh >> /var/log/cron.log 2>&1`;

  log('Add this line to your crontab (run: crontab -e):', colors.yellow);
  log(cronEntry, colors.cyan);

  // Create systemd timer as alternative
  const timerContent = `[Unit]
Description=Direct Fan Platform Backup Timer
Requires=backup.service

[Timer]
OnCalendar=${frequency === 'daily' ? 'daily' : frequency === 'weekly' ? 'weekly' : 'monthly'}
Persistent=true

[Install]
WantedBy=timers.target`;

  const serviceContent = `[Unit]
Description=Direct Fan Platform Backup Service

[Service]
Type=oneshot
ExecStart=/app/scripts/automated-backup.sh
User=app
WorkingDirectory=/app

[Install]
WantedBy=multi-user.target`;

  fs.writeFileSync('/tmp/backup.timer', timerContent);
  fs.writeFileSync('/tmp/backup.service', serviceContent);

  log('Systemd timer files created in /tmp/', colors.green);
  log(
    'To install: sudo cp /tmp/backup.* /etc/systemd/system/ && sudo systemctl enable backup.timer',
    colors.yellow
  );
}

async function createDisasterRecoveryPlan() {
  log('🚨 Creating disaster recovery plan...', colors.cyan);

  const drPlan = `# Disaster Recovery Plan for Direct Fan Platform

## Overview
This document outlines the disaster recovery procedures for the Direct Fan Platform.

## Recovery Time Objectives (RTO)
- Database: 2 hours
- Application: 1 hour
- File Storage: 30 minutes

## Recovery Point Objectives (RPO)
- Database: 24 hours (daily backups)
- Files: 24 hours (daily backups)

## Backup Locations
- Local: /app/backups
- Cloud: s3://direct-fan-platform-backups/
- Offsite: [Configure secondary region]

## Recovery Procedures

### 1. Database Recovery
\`\`\`bash
# Download latest database backup
aws s3 cp s3://backup-bucket/backups/database_latest.backup.gz ./

# Decompress
gunzip database_latest.backup.gz

# Restore (ensure database is empty/recreated)
PGPASSWORD=$POSTGRES_PASSWORD pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --clean --if-exists database_latest.backup
\`\`\`

### 2. File Recovery
\`\`\`bash
# Download latest file backup
aws s3 cp s3://backup-bucket/backups/files_latest.tar.gz ./

# Extract files
tar -xzf files_latest.tar.gz

# Copy to appropriate locations
cp -r uploads/ /app/uploads/
cp -r public/uploads/ /app/public/uploads/
\`\`\`

### 3. Infrastructure Recovery (AWS)
\`\`\`bash
# Deploy infrastructure
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# Deploy application
docker build -f Dockerfile.production -t app:latest .
# Push to ECR and update ECS service
\`\`\`

### 4. Complete System Recovery
\`\`\`bash
# Run the recovery script
node scripts/backup-restore.js

# Follow prompts for:
# 1. Database restoration
# 2. File restoration
# 3. Infrastructure deployment
# 4. Application deployment
\`\`\`

## Testing Recovery Procedures
- Monthly: Test database recovery in staging environment
- Quarterly: Full disaster recovery drill
- Annually: Review and update recovery procedures

## Emergency Contacts
- DevOps Team: [Contact Information]
- Database Admin: [Contact Information]
- Infrastructure Team: [Contact Information]

## Monitoring and Alerts
- Backup failures: Immediate alert
- Storage usage: Alert at 80% capacity
- RTO/RPO breaches: Immediate escalation

## Post-Recovery Checklist
- [ ] Verify database integrity
- [ ] Test critical application functions
- [ ] Verify file uploads/downloads
- [ ] Check monitoring and alerting
- [ ] Update DNS if necessary
- [ ] Notify stakeholders of recovery completion
`;

  fs.writeFileSync('DISASTER_RECOVERY.md', drPlan);
  log('✅ Created disaster recovery plan: DISASTER_RECOVERY.md', colors.green);
}

async function main() {
  log('💾 Backup and Disaster Recovery Setup', colors.cyan);
  log('=====================================', colors.cyan);

  try {
    const manager = new BackupManager();

    const action = await question(`
Choose an action:
1. Backup database
2. Restore database
3. Backup files
4. Upload to cloud
5. Download from cloud
6. List backups
7. Cleanup old backups
8. Create automated backup script
9. Setup cron job
10. Create disaster recovery plan
11. Full backup (database + files + cloud upload)

Enter your choice (1-11): `);

    switch (action) {
      case '1':
        await manager.backupDatabase();
        break;
      case '2':
        await manager.restoreDatabase();
        break;
      case '3':
        await manager.backupFiles();
        break;
      case '4':
        await manager.uploadToCloud();
        break;
      case '5':
        await manager.downloadFromCloud();
        break;
      case '6':
        manager.listBackups();
        break;
      case '7':
        await manager.cleanupOldBackups();
        break;
      case '8':
        await createBackupScript();
        break;
      case '9':
        await createCronJob();
        break;
      case '10':
        await createDisasterRecoveryPlan();
        break;
      case '11':
        log('🔄 Running full backup...', colors.cyan);
        const dbBackup = await manager.backupDatabase();
        const filesBackup = await manager.backupFiles();
        await manager.uploadToCloud();
        await manager.cleanupOldBackups();
        log('✅ Full backup completed!', colors.green);
        break;
      default:
        log('❌ Invalid choice', colors.red);
        break;
    }
  } catch (error) {
    log(`❌ Operation failed: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
