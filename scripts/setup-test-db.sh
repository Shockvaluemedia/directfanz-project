#!/bin/bash

# ==============================================
# TEMPORARY DATABASE SETUP FOR TESTING
# ==============================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo ""
log_info "🔧 Setting up temporary SQLite database for testing..."
echo ""

# Create temporary .env for testing
cp .env.local .env.local.backup
echo "# Temporary test environment" > .env.test
echo "DATABASE_URL=\"file:./test.db\"" >> .env.test

# Copy other required vars
grep -E "^(NEXTAUTH_SECRET|NEXTAUTH_URL|NODE_ENV|AWS_)" .env.local >> .env.test

log_info "Creating test database..."

# Switch to SQLite temporarily
export DATABASE_URL="file:./test.db"

# Generate Prisma client for SQLite
npx prisma generate

# Create test database with schema
npx prisma db push --force-reset

log_success "Test database created successfully!"

echo ""
log_info "Running readiness check with test database..."
DATABASE_URL="file:./test.db" node scripts/pre-deployment-check.js

echo ""
log_info "Cleaning up test database..."
rm -f test.db .env.test

log_success "Test completed! Restoring original environment..."

echo ""
log_warning "Next step: Set up your production database"
echo "Run: ./scripts/setup-production-db.sh"