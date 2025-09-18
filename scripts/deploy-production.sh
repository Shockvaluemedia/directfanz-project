#!/bin/bash

# ==============================================
# DIRECT FAN PLATFORM - PRODUCTION DEPLOYMENT
# ==============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    if ! command -v npx &> /dev/null; then
        log_error "npx is not installed. Please install npx first."
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Generate required secrets
generate_secrets() {
    log_info "Generating production secrets..."
    
    echo "# Generated secrets for production deployment" > .env.production.secrets
    echo "NEXTAUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env.production.secrets
    echo "ENCRYPTION_KEY=\"$(openssl rand -hex 32)\"" >> .env.production.secrets
    echo "JWT_SECRET=\"$(openssl rand -base64 32)\"" >> .env.production.secrets
    
    log_success "Secrets generated and saved to .env.production.secrets"
    log_warning "Please copy these secrets to your production environment variables"
}

# Set up Railway database
setup_railway_database() {
    log_info "Setting up Railway PostgreSQL database..."
    
    if ! command -v railway &> /dev/null; then
        log_info "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    log_info "Please follow these steps to set up your Railway database:"
    echo "1. Run: railway login"
    echo "2. Run: railway init (select 'Create new project')"
    echo "3. Run: railway add postgresql"
    echo "4. Run: railway variables to get your DATABASE_URL"
    echo "5. Copy the DATABASE_URL to your environment variables"
    
    read -p "Press Enter when you've completed the Railway setup..."
}

# Set up AWS S3 bucket
setup_s3_bucket() {
    log_info "Setting up AWS S3 bucket for file storage..."
    
    echo "Please complete these steps in the AWS Console:"
    echo "1. Create a new S3 bucket (e.g., 'your-fan-platform-content')"
    echo "2. Enable public read access for uploaded content"
    echo "3. Set up CORS policy for your domain"
    echo "4. Create an IAM user with S3 access permissions"
    echo "5. Generate access keys for the IAM user"
    
    cat > s3-cors-policy.json << 'EOL'
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
        "ExposeHeaders": ["ETag"]
    }
]
EOL
    
    log_success "CORS policy saved to s3-cors-policy.json - apply this to your S3 bucket"
    read -p "Press Enter when you've completed the S3 setup..."
}

# Deploy to Vercel
deploy_to_vercel() {
    log_info "Deploying to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        log_info "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Build the project first
    log_info "Building the project..."
    npm run build
    
    if [ $? -eq 0 ]; then
        log_success "Build completed successfully"
    else
        log_error "Build failed. Please fix the errors before deploying."
        exit 1
    fi
    
    # Deploy to Vercel
    log_info "Deploying to Vercel..."
    vercel --prod
    
    log_success "Deployment to Vercel completed!"
}

# Deploy to Railway
deploy_to_railway() {
    log_info "Deploying to Railway..."
    
    if ! command -v railway &> /dev/null; then
        log_info "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    # Build the project first
    log_info "Building the project..."
    npm run build
    
    if [ $? -eq 0 ]; then
        log_success "Build completed successfully"
    else
        log_error "Build failed. Please fix the errors before deploying."
        exit 1
    fi
    
    # Deploy to Railway
    log_info "Deploying to Railway..."
    railway up
    
    log_success "Deployment to Railway completed!"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL is not set. Please set it in your environment."
        exit 1
    fi
    
    npx prisma migrate deploy
    
    log_success "Database migrations completed"
}

# Seed production database
seed_database() {
    log_info "Seeding production database..."
    
    read -p "Do you want to seed the production database? (y/N): " seed_confirm
    if [[ $seed_confirm =~ ^[Yy]$ ]]; then
        npx prisma db seed
        log_success "Database seeded successfully"
    else
        log_info "Skipping database seeding"
    fi
}

# Main deployment flow
main() {
    log_info "🚀 Starting Direct Fan Platform production deployment"
    echo "=================================================="
    
    check_dependencies
    
    echo ""
    echo "Select deployment platform:"
    echo "1) Vercel (Recommended for Next.js)"
    echo "2) Railway (Full-stack with database)"
    echo "3) Setup only (Database and S3, no deployment)"
    read -p "Enter your choice (1-3): " platform_choice
    
    case $platform_choice in
        1|2|3)
            generate_secrets
            
            echo ""
            read -p "Do you need to set up a Railway database? (y/N): " setup_db
            if [[ $setup_db =~ ^[Yy]$ ]]; then
                setup_railway_database
            fi
            
            echo ""
            read -p "Do you need to set up AWS S3? (y/N): " setup_s3
            if [[ $setup_s3 =~ ^[Yy]$ ]]; then
                setup_s3_bucket
            fi
            
            echo ""
            log_warning "Please make sure to set all environment variables in your deployment platform"
            log_warning "Refer to .env.example for the complete list of required variables"
            
            if [ "$platform_choice" = "1" ]; then
                deploy_to_vercel
            elif [ "$platform_choice" = "2" ]; then
                deploy_to_railway
            fi
            
            echo ""
            read -p "Do you want to run database migrations now? (y/N): " run_migrations_confirm
            if [[ $run_migrations_confirm =~ ^[Yy]$ ]]; then
                run_migrations
                seed_database
            fi
            ;;
        *)
            log_error "Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    echo ""
    log_success "🎉 Production deployment setup completed!"
    echo "Next steps:"
    echo "1. Set up your custom domain"
    echo "2. Configure SSL certificates"
    echo "3. Test all functionality in production"
    echo "4. Set up monitoring and alerts"
}

# Run main function
main "$@"