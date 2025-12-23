#!/bin/bash

# Setup script for RDS migration
# Prepares the environment and runs database migration to AWS RDS

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
RDS_INSTANCE_IDENTIFIER=${RDS_INSTANCE_IDENTIFIER:-directfanz-db}
MIGRATION_MODE=${1:-dry-run}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Node.js and npm are available
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    # Check if tsx is available for TypeScript execution
    if ! command -v tsx &> /dev/null; then
        log_info "Installing tsx for TypeScript execution..."
        npm install -g tsx
    fi
    
    log_success "Prerequisites check passed"
}

# Get RDS endpoint
get_rds_endpoint() {
    log_info "Getting RDS endpoint..."
    
    RDS_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier $RDS_INSTANCE_IDENTIFIER \
        --region $AWS_REGION \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ]; then
        log_error "RDS instance '$RDS_INSTANCE_IDENTIFIER' not found or not available"
        log_info "Available RDS instances:"
        aws rds describe-db-instances --region $AWS_REGION --query 'DBInstances[].DBInstanceIdentifier' --output table
        exit 1
    fi
    
    log_success "RDS endpoint found: $RDS_ENDPOINT"
}

# Verify RDS connectivity
verify_rds_connectivity() {
    log_info "Verifying RDS connectivity..."
    
    # Get database credentials from Parameter Store
    DB_USERNAME=$(aws ssm get-parameter \
        --name "/directfanz/database/username" \
        --region $AWS_REGION \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || echo "postgres")
    
    DB_PASSWORD=$(aws ssm get-parameter \
        --name "/directfanz/database/password" \
        --with-decryption \
        --region $AWS_REGION \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || echo "")
    
    DB_NAME=$(aws ssm get-parameter \
        --name "/directfanz/database/name" \
        --region $AWS_REGION \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || echo "directfanz")
    
    if [ -z "$DB_PASSWORD" ]; then
        log_error "Database password not found in Parameter Store"
        log_info "Please ensure the following parameters are set:"
        log_info "  /directfanz/database/username"
        log_info "  /directfanz/database/password"
        log_info "  /directfanz/database/name"
        exit 1
    fi
    
    # Construct target database URL
    TARGET_DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}"
    
    log_success "Database credentials retrieved from Parameter Store"
}

# Run Prisma migrations on target database
run_prisma_migrations() {
    log_info "Running Prisma migrations on target RDS database..."
    
    # Temporarily set DATABASE_URL to target for migrations
    export DATABASE_URL="$TARGET_DATABASE_URL"
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    npx prisma generate
    
    # Run migrations
    log_info "Applying database migrations..."
    npx prisma migrate deploy
    
    # Verify schema
    log_info "Verifying database schema..."
    npx prisma db pull --print
    
    log_success "Prisma migrations completed"
}

# Run data migration
run_data_migration() {
    log_info "Running data migration..."
    
    # Set environment variables for migration script
    export TARGET_DATABASE_URL="$TARGET_DATABASE_URL"
    
    # Determine migration flags
    MIGRATION_FLAGS=""
    case "$MIGRATION_MODE" in
        "dry-run")
            MIGRATION_FLAGS="--dry-run"
            log_info "Running in DRY RUN mode - no data will be modified"
            ;;
        "migrate")
            log_warning "Running LIVE migration - data will be copied to RDS"
            ;;
        "skip-validation")
            MIGRATION_FLAGS="--skip-validation"
            log_warning "Skipping data validation"
            ;;
        *)
            log_error "Invalid migration mode: $MIGRATION_MODE"
            log_info "Valid modes: dry-run, migrate, skip-validation"
            exit 1
            ;;
    esac
    
    # Run migration script
    tsx scripts/migrate-to-rds.ts $MIGRATION_FLAGS
    
    log_success "Data migration completed"
}

# Update Parameter Store with new database URL
update_parameter_store() {
    if [ "$MIGRATION_MODE" = "migrate" ]; then
        log_info "Updating Parameter Store with new database URL..."
        
        aws ssm put-parameter \
            --name "/directfanz/database/url" \
            --value "$TARGET_DATABASE_URL" \
            --type "SecureString" \
            --overwrite \
            --region $AWS_REGION
        
        log_success "Parameter Store updated"
    else
        log_info "Skipping Parameter Store update (dry-run mode)"
    fi
}

# Verify migration success
verify_migration() {
    log_info "Verifying migration success..."
    
    # Set DATABASE_URL to target for verification
    export DATABASE_URL="$TARGET_DATABASE_URL"
    
    # Run a simple query to verify data
    node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function verify() {
            try {
                const userCount = await prisma.users.count();
                const contentCount = await prisma.content.count();
                
                console.log('✅ Verification results:');
                console.log('  Users:', userCount);
                console.log('  Content:', contentCount);
                
                await prisma.\$disconnect();
            } catch (error) {
                console.error('❌ Verification failed:', error.message);
                process.exit(1);
            }
        }
        
        verify();
    "
    
    log_success "Migration verification completed"
}

# Main function
main() {
    log_info "Starting RDS migration setup..."
    log_info "Migration mode: $MIGRATION_MODE"
    
    check_prerequisites
    get_rds_endpoint
    verify_rds_connectivity
    run_prisma_migrations
    run_data_migration
    update_parameter_store
    verify_migration
    
    log_success "🎉 RDS migration setup completed successfully!"
    
    if [ "$MIGRATION_MODE" = "dry-run" ]; then
        log_info "💡 This was a dry run. To perform actual migration, run:"
        log_info "    $0 migrate"
    else
        log_info "🚀 Your application is now ready to use AWS RDS!"
        log_info "📝 Next steps:"
        log_info "  1. Update your application configuration to use the new database URL"
        log_info "  2. Deploy your application to ECS"
        log_info "  3. Test the application thoroughly"
        log_info "  4. Update DNS to point to the new deployment"
    fi
}

# Handle script arguments
case "${MIGRATION_MODE}" in
    "dry-run"|"migrate"|"skip-validation")
        main
        ;;
    "help"|"--help"|"-h")
        echo "Usage: $0 [dry-run|migrate|skip-validation]"
        echo ""
        echo "Migration modes:"
        echo "  dry-run         - Preview migration without making changes (default)"
        echo "  migrate         - Perform actual data migration"
        echo "  skip-validation - Skip data validation during migration"
        echo ""
        echo "Environment variables:"
        echo "  AWS_REGION                 - AWS region (default: us-east-1)"
        echo "  RDS_INSTANCE_IDENTIFIER    - RDS instance identifier (default: directfanz-db)"
        echo ""
        exit 0
        ;;
    *)
        log_error "Invalid migration mode: $MIGRATION_MODE"
        log_info "Run '$0 help' for usage information"
        exit 1
        ;;
esac