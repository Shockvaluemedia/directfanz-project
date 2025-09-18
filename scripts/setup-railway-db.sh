#!/bin/bash

# ==============================================
# RAILWAY DATABASE SETUP HELPER
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

log_info "🚄 Railway Database Setup Helper"
echo "================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    log_info "Installing Railway CLI..."
    npm install -g @railway/cli
    log_success "Railway CLI installed!"
fi

# Login to Railway
log_info "Please login to Railway..."
railway login

# Create new project
log_info "Creating new Railway project..."
railway init

# Add PostgreSQL database
log_info "Adding PostgreSQL database to your project..."
railway add postgresql

# Wait for database to be ready
log_info "Waiting for database to initialize..."
sleep 10

# Get environment variables
log_info "Getting database connection details..."
railway variables

echo ""
log_success "🎉 Railway database setup complete!"
echo ""
log_warning "Next steps:"
echo "1. Copy the DATABASE_URL from above"
echo "2. Add it to your production environment variables"
echo "3. Run database migrations: npx prisma migrate deploy"
echo "4. (Optional) Seed your database: npx prisma db seed"

echo ""
log_info "To deploy your app to Railway, run: railway up"