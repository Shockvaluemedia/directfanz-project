#!/bin/bash

# DirectFanz Production Database Setup Script
# Sets up RDS PostgreSQL instance with proper configuration

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
DB_INSTANCE_ID="directfanz-production-postgres"
DB_NAME="directfanz"
DB_USERNAME="postgres"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

# Get RDS instance endpoint
log_info "Getting RDS instance endpoint..."
DB_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier $DB_INSTANCE_ID \
    --region $AWS_REGION \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text 2>/dev/null || echo "")

if [ -z "$DB_ENDPOINT" ] || [ "$DB_ENDPOINT" = "None" ]; then
    log_error "RDS instance '$DB_INSTANCE_ID' not found or not available"
    log_info "Please ensure your Terraform infrastructure is deployed first"
    exit 1
fi

log_success "Found RDS instance: $DB_ENDPOINT"

# Get database password from Secrets Manager
log_info "Retrieving database password from Secrets Manager..."
DB_SECRET_NAME="directfanz-production-db-password"
DB_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id $DB_SECRET_NAME \
    --region $AWS_REGION \
    --query 'SecretString' \
    --output text 2>/dev/null | jq -r '.password' || echo "")

if [ -z "$DB_PASSWORD" ]; then
    log_error "Could not retrieve database password from Secrets Manager"
    log_info "Secret name: $DB_SECRET_NAME"
    exit 1
fi

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_ENDPOINT}:5432/${DB_NAME}"

log_success "Database connection configured"

# Update .env.production with actual DATABASE_URL
log_info "Updating .env.production with RDS endpoint..."
if [ -f ".env.production" ]; then
    # Escape special characters for sed
    ESCAPED_URL=$(echo "$DATABASE_URL" | sed 's/[[\.*^$()+?{|]/\\&/g')
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=\"$ESCAPED_URL\"|" .env.production
    log_success "Updated DATABASE_URL in .env.production"
else
    log_warning ".env.production not found, creating it..."
    echo "DATABASE_URL=\"$DATABASE_URL\"" > .env.production
fi

# Test database connection
log_info "Testing database connection..."
if command -v psql &> /dev/null; then
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -c "SELECT version();" &> /dev/null; then
        log_success "✅ Database connection successful"
    else
        log_error "❌ Database connection failed"
        log_info "This might be due to security group restrictions"
    fi
else
    log_warning "psql not installed, skipping connection test"
fi

# Run Prisma migrations
log_info "Running Prisma database migrations..."
if [ -f "package.json" ]; then
    export DATABASE_URL="$DATABASE_URL"
    
    # Generate Prisma client
    npm run db:generate || log_warning "Failed to generate Prisma client"
    
    # Deploy migrations
    npm run db:deploy || log_warning "Failed to deploy migrations"
    
    log_success "Database migrations completed"
else
    log_warning "package.json not found, skipping Prisma migrations"
fi

# Output connection details
log_success "🎉 Production database setup complete!"
echo
echo "Database Details:"
echo "  Endpoint: $DB_ENDPOINT"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USERNAME"
echo "  Port: 5432"
echo
echo "Environment Variable:"
echo "  DATABASE_URL=\"$DATABASE_URL\""
echo
log_info "Add this DATABASE_URL to your deployment environment variables"