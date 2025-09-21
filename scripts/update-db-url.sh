#!/bin/bash

# ==============================================
# QUICK DATABASE URL UPDATE
# ==============================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo ""
log_info "🔄 Quick DATABASE_URL Update"
echo "============================="

echo ""
echo "Current DATABASE_URL in .env.local:"
grep "DATABASE_URL=" .env.local || echo "DATABASE_URL not found"

echo ""
log_warning "⚠️  Make sure you have your Supabase connection string ready"
echo "It should look like:"
echo "postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
echo ""

read -p "Enter your Supabase DATABASE_URL: " DB_URL

if [[ -n "$DB_URL" ]]; then
    # Backup current .env.local
    cp .env.local .env.local.backup
    log_info "📋 Backed up current .env.local to .env.local.backup"
    
    # Update DATABASE_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed syntax
        sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|" .env.local
    else
        # Linux sed syntax
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|" .env.local
    fi
    
    log_success "✅ DATABASE_URL updated successfully!"
    
    echo ""
    echo "Updated .env.local:"
    grep "DATABASE_URL=" .env.local
    
    echo ""
    log_info "🔄 Next steps:"
    echo "1. Test connection: node scripts/production-readiness-summary.js"
    echo "2. Run migrations: npx prisma migrate deploy"
    echo "3. Deploy to production: vercel --prod"
else
    log_warning "❌ No DATABASE_URL provided. Update cancelled."
fi