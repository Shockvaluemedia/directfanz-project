#!/bin/bash

# DirectFanz AWS Amplify Deployment Script
# Migrates from ECS to Amplify for simplified Next.js deployment

set -e

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

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v amplify &> /dev/null; then
    log_error "Amplify CLI is not installed. Run: npm install -g @aws-amplify/cli"
    exit 1
fi

if ! command -v git &> /dev/null; then
    log_error "Git is not installed"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository. Please initialize git first."
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_warning "You have uncommitted changes. Consider committing them first."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

log_info "🚀 Starting Amplify deployment for DirectFanz..."

# Initialize Amplify project
log_info "Initializing Amplify project..."
amplify init --yes

# Add hosting
log_info "Adding Amplify hosting..."
amplify add hosting

# Configure environment variables (will need to be set in Amplify Console)
log_warning "⚠️  IMPORTANT: You'll need to set these environment variables in Amplify Console:"
echo "- DATABASE_URL"
echo "- NEXTAUTH_SECRET"
echo "- NEXTAUTH_URL"
echo "- STRIPE_PUBLISHABLE_KEY"
echo "- STRIPE_SECRET_KEY"
echo "- STRIPE_WEBHOOK_SECRET"
echo "- AWS_ACCESS_KEY_ID"
echo "- AWS_SECRET_ACCESS_KEY"
echo "- AWS_S3_BUCKET_NAME"
echo "- SENDGRID_API_KEY"
echo "- FROM_EMAIL"
echo "- REDIS_URL"

# Deploy
log_info "Publishing to Amplify..."
amplify publish

log_success "🎉 Deployment completed!"
log_info "Next steps:"
echo "1. Go to AWS Amplify Console: https://console.aws.amazon.com/amplify/"
echo "2. Set environment variables in your app settings"
echo "3. Configure custom domain (directfanz.io)"
echo "4. Update DNS to point to Amplify"
