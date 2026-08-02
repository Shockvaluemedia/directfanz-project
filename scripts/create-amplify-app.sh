#!/bin/bash

# DirectFanz AWS Amplify Console Deployment
# Creates and configures Amplify app via AWS CLI

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

# Configuration
APP_NAME="directfanz-production"
REGION="us-east-1"
GITHUB_REPO="https://github.com/Shockvaluemedia/directfanz-project"
BRANCH="main"

log_info "🚀 Creating DirectFanz Amplify app..."

# Create Amplify app
log_info "Creating Amplify app: $APP_NAME"
APP_ID=$(aws amplify create-app \
    --name "$APP_NAME" \
    --platform WEB \
    --region "$REGION" \
    --build-spec file://amplify.yml \
    --query 'app.appId' \
    --output text)

if [ $? -eq 0 ]; then
    log_success "✅ Amplify app created with ID: $APP_ID"
else
    log_error "❌ Failed to create Amplify app"
    exit 1
fi

# Create branch
log_info "Creating branch: $BRANCH"
aws amplify create-branch \
    --app-id "$APP_ID" \
    --branch-name "$BRANCH" \
    --region "$REGION"

log_success "✅ Branch created: $BRANCH"

# Get the app URL
APP_URL="https://$BRANCH.$APP_ID.amplifyapp.com"
CONSOLE_URL="https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID"

log_success "🎉 Amplify app created successfully!"
echo ""
log_info "📋 Next Steps:"
echo "1. Go to Amplify Console: $CONSOLE_URL"
echo "2. Connect your GitHub repository"
echo "3. Set environment variables"
echo "4. Deploy your app"
echo ""
log_info "🌐 Your app will be available at: $APP_URL"
echo ""
log_warning "⚠️  Environment Variables to Set:"
echo "- DATABASE_URL"
echo "- NEXTAUTH_SECRET"
echo "- NEXTAUTH_URL=$APP_URL"
echo "- STRIPE_PUBLISHABLE_KEY"
echo "- STRIPE_SECRET_KEY"
echo "- STRIPE_WEBHOOK_SECRET"
echo "- AWS_ACCESS_KEY_ID"
echo "- AWS_SECRET_ACCESS_KEY"
echo "- AWS_S3_BUCKET_NAME"
echo "- SENDGRID_API_KEY"
echo "- FROM_EMAIL"
echo "- REDIS_URL"