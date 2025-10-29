#!/bin/bash

# ==============================================
# PRODUCTION DATABASE SETUP HELPER
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
log_info "🗄️  Production Database Setup for DirectFanz"
echo "=============================================="

echo ""
echo "Choose your production database provider:"
echo ""
echo "1) 🔹 Neon (Recommended for Vercel) - Free tier available"
echo "   • Serverless PostgreSQL"
echo "   • Auto-scaling and branching"
echo "   • Perfect for production"
echo ""
echo "2) 🔹 Vercel Postgres - Integrated with Vercel"
echo "   • Seamless Vercel integration"
echo "   • Built-in connection pooling"
echo ""
echo "3) 🔹 Supabase - Full-featured BaaS"
echo "   • PostgreSQL with real-time features"
echo "   • Built-in auth and storage"
echo ""
echo "4) 🔹 Railway - Simple deployment"
echo "   • Easy setup with CLI"
echo "   • Good for full-stack deployment"
echo ""

read -p "Enter your choice (1-4): " db_choice

case $db_choice in
    1)
        log_action "Setting up Neon PostgreSQL..."
        echo ""
        echo "📋 Step-by-Step Neon Setup:"
        echo "1. Go to https://neon.tech"
        echo "2. Sign up/login with your GitHub account"
        echo "3. Create a new project:"
        echo "   • Name: 'directfanz-production'"
        echo "   • Region: US East (closest to Vercel)"
        echo "4. Copy the connection string from the dashboard"
        echo "5. It should look like:"
        echo "   postgresql://username:password@host.neon.tech/dbname?sslmode=require"
        echo ""
        log_warning "Make sure to:"
        echo "• Enable connection pooling for production"
        echo "• Note the database name (usually 'neondb')"
        echo "• Keep your password secure"
        ;;
    2)
        log_action "Setting up Vercel Postgres..."
        echo ""
        echo "📋 Step-by-Step Vercel Postgres Setup:"
        echo "1. Install Vercel CLI: npm i -g vercel"
        echo "2. Login: vercel login"
        echo "3. Link project: vercel link"
        echo "4. Create database: vercel storage create postgres"
        echo "5. The DATABASE_URL will be automatically added to your environment"
        echo ""
        echo "Or via Vercel Dashboard:"
        echo "1. Go to your project dashboard on vercel.com"
        echo "2. Go to Storage tab"
        echo "3. Create → Postgres Database"
        echo "4. Copy the connection string"
        ;;
    3)
        log_action "Setting up Supabase PostgreSQL..."
        echo ""
        echo "📋 Step-by-Step Supabase Setup:"
        echo "1. Go to https://supabase.com"
        echo "2. Create new project:"
        echo "   • Name: 'directfanz-production'"
        echo "   • Password: Generate strong password"
        echo "   • Region: US East 1"
        echo "3. Go to Settings → Database"
        echo "4. Copy the connection string (URI format)"
        echo "5. Use the 'Connection pooling' URL for production"
        echo ""
        log_warning "Make sure to:"
        echo "• Use connection pooling URL"
        echo "• Enable Row Level Security if needed"
        echo "• Configure database backup"
        ;;
    4)
        log_action "Setting up Railway PostgreSQL..."
        echo ""
        if ! command -v railway &> /dev/null; then
            log_info "Installing Railway CLI..."
            npm install -g @railway/cli
        fi
        echo ""
        echo "📋 Railway Setup Commands:"
        echo "1. railway login"
        echo "2. railway init (create new project)"
        echo "3. railway add postgresql"
        echo "4. railway variables (to see DATABASE_URL)"
        echo ""
        read -p "Do you want to run these commands now? (y/N): " run_railway
        if [[ $run_railway =~ ^[Yy]$ ]]; then
            railway login
            railway init
            railway add postgresql
            echo ""
            log_info "Getting database variables..."
            railway variables
        fi
        ;;
    *)
        log_warning "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
log_success "Next Steps:"
echo ""
echo "1. 📝 Copy your DATABASE_URL"
echo "2. 🔧 Update your .env.local:"
echo "   DATABASE_URL=\"your_production_database_url\""
echo ""
echo "3. 🗄️  Run database migrations:"
echo "   npx prisma migrate deploy"
echo ""
echo "4. 🌱 (Optional) Seed your database:"
echo "   npx prisma db seed"
echo ""
echo "5. ✅ Test the connection:"
echo "   node scripts/pre-deployment-check.js"
echo ""
echo "6. 🚀 Deploy to production:"
echo "   vercel --prod"
echo ""

log_warning "🔐 Security Reminder:"
echo "• Keep your database credentials secure"
echo "• Use environment variables, never hardcode passwords"
echo "• Enable SSL connections in production"
echo "• Regular backup your database"

echo ""
log_info "📚 Documentation:"
echo "• Full production setup: PRODUCTION_SETUP.md"
echo "• Deployment checklist: docs/DEPLOYMENT_CHECKLIST.md"
echo "• Vercel guide: docs/vercel-deployment.md"