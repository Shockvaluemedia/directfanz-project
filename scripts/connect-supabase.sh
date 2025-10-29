#!/bin/bash

# ==============================================
# SUPABASE CONNECTION HELPER
# ==============================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_action() { echo -e "${CYAN}🔧 $1${NC}"; }

echo ""
log_info "🗄️  Supabase Connection Setup for DirectFanz"
echo "============================================="

echo ""
log_action "Getting your Supabase database connection string..."
echo ""
echo "Please follow these steps to get your Supabase DATABASE_URL:"
echo ""
echo "1. 🌐 Go to https://supabase.com/dashboard/projects"
echo "2. 📂 Select your DirectFanz project"
echo "3. ⚙️  Click on 'Settings' in the sidebar"
echo "4. 🗄️  Click on 'Database'"
echo "5. 📋 Under 'Connection string', select 'URI' format"
echo "6. 👁️  Click 'Show' to reveal the full connection string"
echo "7. 📝 Copy the connection string"
echo ""
echo "It should look like:"
echo "postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
echo ""

read -p "Press Enter when you have copied your Supabase DATABASE_URL..."

echo ""
log_warning "🔐 Important Security Notes:"
echo "• Never share your database password"
echo "• Use environment variables for sensitive data"
echo "• For production, use the connection pooling URL"
echo ""

echo ""
log_success "✅ Next Steps:"
echo ""
echo "1. 📝 Update your .env.local file:"
echo '   DATABASE_URL="your-supabase-connection-string"'
echo ""
echo "2. 🔄 Test the connection:"
echo "   node scripts/production-readiness-summary.js"
echo ""
echo "3. 🗄️  Run database migrations:"
echo "   npx prisma migrate deploy"
echo ""
echo "4. 🌱 (Optional) Seed your database:"
echo "   npx prisma db seed"
echo ""
echo "5. 🚀 Deploy to production:"
echo "   vercel --prod"
echo ""

echo ""
log_info "🔧 Alternative: Quick Update Script"
echo ""
echo "If you want to update .env.local automatically:"
echo 'read -p "Enter your Supabase DATABASE_URL: " DB_URL'
echo 'sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|" .env.local'
echo 'echo "✅ DATABASE_URL updated!"'
echo ""

log_warning "📚 Documentation:"
echo "• Supabase setup: https://supabase.com/docs/guides/integrations/prisma"
echo "• Connection pooling: Use the pooled connection for production"
echo "• Security: Enable Row Level Security (RLS) if needed"