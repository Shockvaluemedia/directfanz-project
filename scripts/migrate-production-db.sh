#!/bin/bash

# ==============================================
# PRODUCTION DATABASE MIGRATION SCRIPT
# ==============================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

log_info "🗄️  Production Database Migration Script"
echo "======================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set your production database URL:"
    echo "export DATABASE_URL='postgresql://username:password@host:port/dbname'"
    echo ""
    echo "Or create a .env.production file with:"
    echo "DATABASE_URL=postgresql://username:password@host:port/dbname"
    exit 1
fi

# Verify Prisma is available
if ! command -v npx &> /dev/null; then
    log_error "npx is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check if prisma is in the project
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root."
    exit 1
fi

if ! grep -q "prisma" package.json; then
    log_error "Prisma not found in package.json. Please ensure Prisma is installed."
    exit 1
fi

# Test database connection
log_info "Testing database connection..."
if npx prisma db pull --force --schema=./test-schema.prisma > /dev/null 2>&1; then
    rm -f ./test-schema.prisma
    log_success "Database connection successful"
else
    rm -f ./test-schema.prisma 2>/dev/null || true
    log_error "Cannot connect to database. Please check your DATABASE_URL."
    echo ""
    echo "Common issues:"
    echo "• Incorrect connection string format"
    echo "• Database server not accessible"
    echo "• Wrong credentials"
    echo "• Database does not exist"
    exit 1
fi

# Show current migration status
log_info "Checking current migration status..."
echo ""
npx prisma migrate status || true
echo ""

# Confirm before proceeding
log_warning "This will run migrations against your PRODUCTION database!"
echo "Database: $(echo $DATABASE_URL | sed 's/\/\/.*@/\/\/***:***@/')"
echo ""
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
    log_info "Migration cancelled"
    exit 0
fi

# Backup suggestion
echo ""
log_warning "💾 Backup Recommendation:"
echo "Before running migrations, consider creating a database backup:"
echo ""
echo "For PostgreSQL:"
echo "pg_dump \$DATABASE_URL > backup-\$(date +%Y%m%d_%H%M%S).sql"
echo ""
echo "For MySQL:"
echo "mysqldump --single-transaction --routines --triggers DATABASE_NAME > backup-\$(date +%Y%m%d_%H%M%S).sql"
echo ""
read -p "Do you want to proceed without backup? (y/N): " proceed

if [[ ! $proceed =~ ^[Yy]$ ]]; then
    log_info "Please create a backup first, then run this script again"
    exit 0
fi

# Run migrations
log_info "Running database migrations..."
echo ""

if npx prisma migrate deploy; then
    log_success "Migrations completed successfully"
else
    log_error "Migration failed"
    echo ""
    echo "Troubleshooting steps:"
    echo "• Check migration files in prisma/migrations/"
    echo "• Verify database schema compatibility" 
    echo "• Check database permissions"
    echo "• Review Prisma logs for detailed errors"
    exit 1
fi

# Generate Prisma client
log_info "Generating Prisma client..."
if npx prisma generate; then
    log_success "Prisma client generated successfully"
else
    log_warning "Prisma client generation failed (may not be critical for production)"
fi

# Optional: Database seeding
echo ""
read -p "Do you want to seed the database with initial data? (y/N): " seed_db

if [[ $seed_db =~ ^[Yy]$ ]]; then
    log_info "Seeding database..."
    
    if npx prisma db seed; then
        log_success "Database seeded successfully"
    else
        log_warning "Database seeding failed (this may be normal if seed script is not configured)"
    fi
else
    log_info "Skipping database seeding"
fi

# Show final status
echo ""
log_info "Checking final migration status..."
npx prisma migrate status

echo ""
log_success "🎉 Production database migration completed!"
echo ""
log_info "Next steps:"
echo "• Test your application endpoints"
echo "• Verify data integrity"
echo "• Monitor database performance"
echo "• Set up regular backups"

# Performance recommendations
echo ""
log_info "📊 Performance recommendations:"
echo "• Monitor slow queries"
echo "• Set up database connection pooling"
echo "• Configure appropriate indexes"
echo "• Set up database monitoring (e.g., pganalyze for PostgreSQL)"