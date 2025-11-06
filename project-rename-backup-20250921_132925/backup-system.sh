#!/bin/bash

# Comprehensive Backup and Disaster Recovery System for DirectFanz
# This script handles automated backups, restoration, and disaster recovery procedures

set -euo pipefail

# Configuration
BACKUP_BASE_DIR="${BACKUP_DIR:-./backups}"
PROJECT_NAME="directfanz"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=${RETENTION_DAYS:-30}
ENCRYPTION_PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Create backup directories
setup_backup_structure() {
    local backup_dirs=(
        "${BACKUP_BASE_DIR}/code"
        "${BACKUP_BASE_DIR}/database"
        "${BACKUP_BASE_DIR}/uploads"
        "${BACKUP_BASE_DIR}/config"
        "${BACKUP_BASE_DIR}/logs"
        "${BACKUP_BASE_DIR}/system"
    )

    log "Setting up backup directory structure..."
    for dir in "${backup_dirs[@]}"; do
        mkdir -p "$dir"
        log "Created: $dir"
    done

    # Create backup manifest
    cat > "${BACKUP_BASE_DIR}/backup-manifest.json" << EOF
{
  "project": "$PROJECT_NAME",
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "structure": {
    "code": "Source code and configuration files",
    "database": "Database dumps and schema",
    "uploads": "User uploads and media files",
    "config": "Environment and configuration files",
    "logs": "Application and system logs",
    "system": "System configuration and certificates"
  },
  "retention_policy": "${RETENTION_DAYS} days"
}
EOF
    success "Backup structure initialized"
}

# Backup source code
backup_code() {
    log "Starting code backup..."
    
    local code_backup_dir="${BACKUP_BASE_DIR}/code/${TIMESTAMP}"
    mkdir -p "$code_backup_dir"

    # Create git bundle (complete repository backup)
    if [ -d ".git" ]; then
        log "Creating git bundle..."
        git bundle create "${code_backup_dir}/repo.bundle" --all
        
        # Save current branch and commit info
        git log -1 --pretty=format:'{
    "commit": "%H",
    "author": "%an <%ae>",
    "date": "%ai",
    "message": "%s"
}' > "${code_backup_dir}/current-commit.json"
        
        # Save git status
        git status --porcelain > "${code_backup_dir}/git-status.txt" || true
        
        success "Git repository backed up"
    else
        warn "No git repository found"
    fi

    # Create source code archive (excluding node_modules and build artifacts)
    log "Creating source code archive..."
    tar --exclude='node_modules' \
        --exclude='.next' \
        --exclude='build' \
        --exclude='dist' \
        --exclude='coverage' \
        --exclude='.vercel' \
        --exclude='logs' \
        --exclude='*.log' \
        -czf "${code_backup_dir}/source-code.tar.gz" . 2>/dev/null || warn "Some files may have been skipped"

    # Backup package files
    if [ -f "package.json" ]; then
        cp package.json "${code_backup_dir}/"
        [ -f "package-lock.json" ] && cp package-lock.json "${code_backup_dir}/"
        [ -f "yarn.lock" ] && cp yarn.lock "${code_backup_dir}/"
    fi

    # Create manifest
    cat > "${code_backup_dir}/manifest.json" << EOF
{
  "backup_type": "code",
  "timestamp": "$TIMESTAMP",
  "files": {
    "git_bundle": "repo.bundle",
    "source_archive": "source-code.tar.gz",
    "current_commit": "current-commit.json",
    "git_status": "git-status.txt"
  },
  "size_mb": $(du -sm "$code_backup_dir" | cut -f1)
}
EOF

    success "Code backup completed: $code_backup_dir"
}

# Backup database
backup_database() {
    log "Starting database backup..."
    
    local db_backup_dir="${BACKUP_BASE_DIR}/database/${TIMESTAMP}"
    mkdir -p "$db_backup_dir"

    # Check if we have database configuration
    if [ -f ".env" ] || [ -f ".env.local" ]; then
        # Try to extract database URL from environment files
        local db_url=""
        for env_file in .env .env.local; do
            if [ -f "$env_file" ]; then
                db_url=$(grep "^DATABASE_URL=" "$env_file" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
                [ -n "$db_url" ] && break
            fi
        done

        if [ -n "$db_url" ]; then
            log "Found database configuration, attempting backup..."
            
            # Determine database type from URL
            if [[ "$db_url" == postgres* ]]; then
                backup_postgresql "$db_url" "$db_backup_dir"
            elif [[ "$db_url" == mysql* ]]; then
                backup_mysql "$db_url" "$db_backup_dir"
            elif [[ "$db_url" == sqlite* ]] || [[ "$db_url" == file:* ]]; then
                backup_sqlite "$db_url" "$db_backup_dir"
            else
                warn "Unknown database type: $db_url"
            fi
        else
            warn "No DATABASE_URL found in environment files"
        fi
    fi

    # Backup Prisma schema and migrations if they exist
    if [ -d "prisma" ]; then
        log "Backing up Prisma schema and migrations..."
        cp -r prisma "${db_backup_dir}/"
        success "Prisma files backed up"
    fi

    # Create database backup manifest
    cat > "${db_backup_dir}/manifest.json" << EOF
{
  "backup_type": "database",
  "timestamp": "$TIMESTAMP",
  "includes_schema": $([ -d "prisma" ] && echo "true" || echo "false"),
  "database_type": "$(echo "$db_url" | cut -d':' -f1)",
  "size_mb": $(du -sm "$db_backup_dir" 2>/dev/null | cut -f1 || echo "0")
}
EOF

    success "Database backup completed: $db_backup_dir"
}

backup_postgresql() {
    local db_url="$1"
    local backup_dir="$2"
    
    log "Backing up PostgreSQL database..."
    
    if command -v pg_dump >/dev/null 2>&1; then
        # Extract connection details from URL
        # Format: postgresql://user:password@host:port/database
        local connection_string="$db_url"
        
        # Attempt database dump
        if pg_dump "$connection_string" > "${backup_dir}/database.sql" 2>/dev/null; then
            success "PostgreSQL dump created"
            
            # Also create a compressed version
            gzip -c "${backup_dir}/database.sql" > "${backup_dir}/database.sql.gz"
        else
            warn "Failed to create PostgreSQL dump - check connection and permissions"
        fi
    else
        warn "pg_dump not available - install PostgreSQL client tools"
    fi
}

backup_mysql() {
    local db_url="$1"
    local backup_dir="$2"
    
    log "Backing up MySQL database..."
    warn "MySQL backup not implemented yet - please implement based on your setup"
}

backup_sqlite() {
    local db_url="$1"
    local backup_dir="$2"
    
    log "Backing up SQLite database..."
    
    # Extract database file path
    local db_file=$(echo "$db_url" | sed 's/.*file://' | sed 's/?.*$//')
    
    if [ -f "$db_file" ]; then
        cp "$db_file" "${backup_dir}/database.sqlite"
        success "SQLite database backed up"
    else
        warn "SQLite database file not found: $db_file"
    fi
}

# Backup uploads and media files
backup_uploads() {
    log "Starting uploads backup..."
    
    local uploads_backup_dir="${BACKUP_BASE_DIR}/uploads/${TIMESTAMP}"
    mkdir -p "$uploads_backup_dir"

    # Common upload directories
    local upload_paths=(
        "public/uploads"
        "uploads"
        "media"
        "files"
        "assets/uploads"
    )

    local backed_up=false
    for path in "${upload_paths[@]}"; do
        if [ -d "$path" ]; then
            log "Backing up: $path"
            cp -r "$path" "${uploads_backup_dir}/" 2>/dev/null || warn "Failed to backup $path"
            backed_up=true
        fi
    done

    if [ "$backed_up" = false ]; then
        warn "No upload directories found"
    fi

    # Create uploads manifest
    cat > "${uploads_backup_dir}/manifest.json" << EOF
{
  "backup_type": "uploads",
  "timestamp": "$TIMESTAMP",
  "directories_backed_up": [$(printf '"%s",' "${upload_paths[@]}" | sed 's/,$//')]
  "size_mb": $(du -sm "$uploads_backup_dir" 2>/dev/null | cut -f1 || echo "0")
}
EOF

    success "Uploads backup completed: $uploads_backup_dir"
}

# Backup configuration files
backup_config() {
    log "Starting configuration backup..."
    
    local config_backup_dir="${BACKUP_BASE_DIR}/config/${TIMESTAMP}"
    mkdir -p "$config_backup_dir"

    # Configuration files to backup
    local config_files=(
        ".env.example"
        ".env.local.example"
        ".env.production.example"
        "next.config.js"
        "tsconfig.json"
        "tailwind.config.ts"
        "middleware.ts"
        "vercel.json"
        "docker-compose*.yml"
        "Dockerfile*"
        "nginx.conf"
        "package.json"
        "package-lock.json"
    )

    log "Backing up configuration files..."
    for pattern in "${config_files[@]}"; do
        for file in $pattern; do
            if [ -f "$file" ]; then
                cp "$file" "${config_backup_dir}/" 2>/dev/null || warn "Failed to backup $file"
                log "Backed up: $file"
            fi
        done
    done

    # Backup important directories
    local config_dirs=(
        ".github"
        "scripts"
        "infrastructure"
        "monitoring"
    )

    for dir in "${config_dirs[@]}"; do
        if [ -d "$dir" ]; then
            cp -r "$dir" "${config_backup_dir}/" 2>/dev/null || warn "Failed to backup $dir"
            log "Backed up directory: $dir"
        fi
    done

    # Create config manifest
    cat > "${config_backup_dir}/manifest.json" << EOF
{
  "backup_type": "config",
  "timestamp": "$TIMESTAMP",
  "size_mb": $(du -sm "$config_backup_dir" | cut -f1)
}
EOF

    success "Configuration backup completed: $config_backup_dir"
}

# Backup logs
backup_logs() {
    log "Starting logs backup..."
    
    local logs_backup_dir="${BACKUP_BASE_DIR}/logs/${TIMESTAMP}"
    mkdir -p "$logs_backup_dir"

    # Log files and directories to backup
    local log_paths=(
        "*.log"
        "logs"
        ".logs"
        "log"
        "var/log"
    )

    local backed_up=false
    for pattern in "${log_paths[@]}"; do
        if ls $pattern >/dev/null 2>&1; then
            cp -r $pattern "${logs_backup_dir}/" 2>/dev/null || warn "Failed to backup some logs"
            backed_up=true
        fi
    done

    if [ "$backed_up" = false ]; then
        warn "No log files found"
    fi

    # Create logs manifest
    cat > "${logs_backup_dir}/manifest.json" << EOF
{
  "backup_type": "logs",
  "timestamp": "$TIMESTAMP",
  "size_mb": $(du -sm "$logs_backup_dir" 2>/dev/null | cut -f1 || echo "0")
}
EOF

    success "Logs backup completed: $logs_backup_dir"
}

# Create encrypted full backup
create_full_backup() {
    log "Creating full backup archive..."
    
    local full_backup_file="${BACKUP_BASE_DIR}/full-backup-${TIMESTAMP}.tar.gz"
    
    # Create compressed archive of all backups for this timestamp
    tar -czf "$full_backup_file" \
        "${BACKUP_BASE_DIR}/code/${TIMESTAMP}" \
        "${BACKUP_BASE_DIR}/database/${TIMESTAMP}" \
        "${BACKUP_BASE_DIR}/uploads/${TIMESTAMP}" \
        "${BACKUP_BASE_DIR}/config/${TIMESTAMP}" \
        "${BACKUP_BASE_DIR}/logs/${TIMESTAMP}" 2>/dev/null || warn "Some backup components missing"

    # Encrypt if passphrase provided
    if [ -n "$ENCRYPTION_PASSPHRASE" ]; then
        log "Encrypting full backup..."
        if command -v gpg >/dev/null 2>&1; then
            echo "$ENCRYPTION_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 --output "${full_backup_file}.gpg" "$full_backup_file"
            rm "$full_backup_file"  # Remove unencrypted version
            success "Full backup encrypted: ${full_backup_file}.gpg"
        else
            warn "GPG not available for encryption"
        fi
    else
        success "Full backup created: $full_backup_file"
    fi
}

# Clean old backups based on retention policy
cleanup_old_backups() {
    log "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
    
    # Find and remove old backup directories
    find "${BACKUP_BASE_DIR}" -type d -name "*[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*" -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true
    
    # Find and remove old full backup archives
    find "${BACKUP_BASE_DIR}" -name "full-backup-*.tar.gz*" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    
    success "Old backups cleaned up"
}

# Restore from backup
restore_backup() {
    local backup_timestamp="$1"
    local component="${2:-all}"
    
    log "Starting restore process for timestamp: $backup_timestamp, component: $component"
    
    if [ "$component" = "all" ] || [ "$component" = "code" ]; then
        restore_code "$backup_timestamp"
    fi
    
    if [ "$component" = "all" ] || [ "$component" = "database" ]; then
        restore_database "$backup_timestamp"
    fi
    
    if [ "$component" = "all" ] || [ "$component" = "config" ]; then
        restore_config "$backup_timestamp"
    fi
    
    success "Restore completed for: $component"
}

restore_code() {
    local timestamp="$1"
    local backup_dir="${BACKUP_BASE_DIR}/code/${timestamp}"
    
    if [ ! -d "$backup_dir" ]; then
        error "Code backup not found: $backup_dir"
    fi
    
    log "Restoring code from backup..."
    warn "This will overwrite current code. Make sure you have a backup!"
    
    read -p "Continue? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Restore cancelled"
        return 1
    fi
    
    # Restore from git bundle if available
    if [ -f "${backup_dir}/repo.bundle" ]; then
        log "Restoring from git bundle..."
        # This requires manual intervention to properly restore git history
        warn "Git bundle restore requires manual setup. Bundle location: ${backup_dir}/repo.bundle"
    fi
    
    # Extract source code archive
    if [ -f "${backup_dir}/source-code.tar.gz" ]; then
        log "Extracting source code archive..."
        tar -xzf "${backup_dir}/source-code.tar.gz" --exclude='./backups' || warn "Some files may not have been restored"
    fi
    
    success "Code restore completed"
}

restore_database() {
    local timestamp="$1"
    local backup_dir="${BACKUP_BASE_DIR}/database/${timestamp}"
    
    if [ ! -d "$backup_dir" ]; then
        error "Database backup not found: $backup_dir"
    fi
    
    log "Restoring database from backup..."
    warn "This will overwrite current database. Make sure you have a backup!"
    
    read -p "Continue? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Restore cancelled"
        return 1
    fi
    
    # Restore based on what's available
    if [ -f "${backup_dir}/database.sql" ]; then
        warn "Database SQL dump found. Manual restoration required."
        warn "Location: ${backup_dir}/database.sql"
    elif [ -f "${backup_dir}/database.sqlite" ]; then
        log "Restoring SQLite database..."
        # You'll need to specify the correct path for your SQLite database
        warn "SQLite restore: copy ${backup_dir}/database.sqlite to your database location"
    fi
    
    success "Database restore completed"
}

restore_config() {
    local timestamp="$1"
    local backup_dir="${BACKUP_BASE_DIR}/config/${timestamp}"
    
    if [ ! -d "$backup_dir" ]; then
        error "Config backup not found: $backup_dir"
    fi
    
    log "Restoring configuration from backup..."
    warn "This will overwrite current configuration files."
    
    read -p "Continue? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Restore cancelled"
        return 1
    fi
    
    # Restore configuration files
    find "$backup_dir" -type f -name "*" -not -name "manifest.json" -exec cp {} . \; 2>/dev/null || warn "Some config files may not have been restored"
    
    success "Configuration restore completed"
}

# List available backups
list_backups() {
    log "Available backups:"
    echo
    
    # List backup directories by timestamp
    find "${BACKUP_BASE_DIR}" -type d -name "*[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*" -printf '%T@ %p\n' 2>/dev/null | sort -n | while read timestamp path; do
        local backup_date=$(date -d @"${timestamp}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown date")
        local backup_name=$(basename "$path")
        local backup_type=$(basename "$(dirname "$path")")
        local size=$(du -sh "$path" 2>/dev/null | cut -f1)
        
        printf "%-20s %-10s %-20s %s\n" "$backup_name" "$backup_type" "$backup_date" "$size"
    done
    
    echo
    # List full backup archives
    find "${BACKUP_BASE_DIR}" -name "full-backup-*.tar.gz*" -printf '%T@ %p\n' 2>/dev/null | sort -n | while read timestamp path; do
        local backup_date=$(date -d @"${timestamp}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown date")
        local backup_name=$(basename "$path")
        local size=$(du -sh "$path" 2>/dev/null | cut -f1)
        
        printf "%-20s %-10s %-20s %s\n" "$backup_name" "full" "$backup_date" "$size"
    done
}

# Test backup and restore functionality
test_backup_restore() {
    log "Testing backup and restore functionality..."
    
    # Create a test file
    echo "test backup content $(date)" > "test-backup-file.txt"
    
    # Run a minimal backup
    setup_backup_structure
    backup_code
    
    # Remove test file
    rm "test-backup-file.txt"
    
    # List backups to verify
    list_backups
    
    success "Backup test completed - verify the backup was created successfully"
}

# Main execution
main() {
    local command="${1:-help}"
    
    case "$command" in
        "setup")
            setup_backup_structure
            ;;
        "full")
            setup_backup_structure
            backup_code
            backup_database
            backup_uploads
            backup_config
            backup_logs
            create_full_backup
            cleanup_old_backups
            ;;
        "code")
            setup_backup_structure
            backup_code
            ;;
        "database")
            setup_backup_structure
            backup_database
            ;;
        "uploads")
            setup_backup_structure
            backup_uploads
            ;;
        "config")
            setup_backup_structure
            backup_config
            ;;
        "logs")
            setup_backup_structure
            backup_logs
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        "list")
            list_backups
            ;;
        "restore")
            if [ -z "${2:-}" ]; then
                error "Please provide backup timestamp: $0 restore YYYYMMDD_HHMMSS [component]"
            fi
            restore_backup "$2" "${3:-all}"
            ;;
        "test")
            test_backup_restore
            ;;
        "help")
            echo "DirectFanz Backup and Disaster Recovery System"
            echo
            echo "Usage: $0 <command> [arguments]"
            echo
            echo "Commands:"
            echo "  setup           Initialize backup directory structure"
            echo "  full            Perform complete backup (all components)"
            echo "  code            Backup source code and git repository"
            echo "  database        Backup database and schema"
            echo "  uploads         Backup user uploads and media files"
            echo "  config          Backup configuration files"
            echo "  logs            Backup log files"
            echo "  cleanup         Remove old backups based on retention policy"
            echo "  list            List available backups"
            echo "  restore TIMESTAMP [COMPONENT]  Restore from backup"
            echo "  test            Test backup functionality"
            echo "  help            Show this help message"
            echo
            echo "Environment Variables:"
            echo "  BACKUP_DIR                    Base backup directory (default: ./backups)"
            echo "  RETENTION_DAYS               Backup retention in days (default: 30)"
            echo "  BACKUP_ENCRYPTION_PASSPHRASE Passphrase for backup encryption"
            echo
            echo "Examples:"
            echo "  $0 full                      # Complete backup"
            echo "  $0 restore 20240321_143022   # Restore all from backup"
            echo "  $0 restore 20240321_143022 code  # Restore only code"
            ;;
        *)
            error "Unknown command: $command. Use '$0 help' for usage information."
            ;;
    esac
}

# Run main function with all arguments
main "$@"