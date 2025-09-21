#!/bin/bash

# ==============================================
# SETUP GITHUB SECRETS FROM ENV
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

# Load environment variables
if [[ -f .env.local ]]; then
    source .env.local
else
    log_error "❌ .env.local not found!"
    exit 1
fi

log_info "🔐 Setting up GitHub repository secrets for DirectFanz"
echo "====================================================="

# Required secrets mapping
declare -A secrets=(
    ["DATABASE_URL"]="$DATABASE_URL"
    ["NEXTAUTH_SECRET"]="$NEXTAUTH_SECRET"
    ["NEXTAUTH_URL"]="$NEXTAUTH_URL"
    ["AWS_ACCESS_KEY_ID"]="$AWS_ACCESS_KEY_ID"
    ["AWS_SECRET_ACCESS_KEY"]="$AWS_SECRET_ACCESS_KEY"
    ["AWS_S3_BUCKET_NAME"]="$AWS_S3_BUCKET_NAME"
    ["AWS_REGION"]="$AWS_REGION"
    ["NODE_ENV"]="$NODE_ENV"
    ["NEXT_PUBLIC_APP_URL"]="$NEXT_PUBLIC_APP_URL"
)

# Optional secrets (only set if they exist)
declare -A optional_secrets=(
    ["STRIPE_SECRET_KEY"]="$STRIPE_SECRET_KEY"
    ["STRIPE_PUBLISHABLE_KEY"]="$STRIPE_PUBLISHABLE_KEY"
    ["SENDGRID_API_KEY"]="$SENDGRID_API_KEY"
    ["FROM_EMAIL"]="$FROM_EMAIL"
    ["REDIS_URL"]="$REDIS_URL"
    ["NEXT_PUBLIC_SENTRY_DSN"]="$NEXT_PUBLIC_SENTRY_DSN"
)

echo ""
log_info "📋 Setting required secrets..."

for secret_name in "${!secrets[@]}"; do
    secret_value="${secrets[$secret_name]}"
    
    if [[ -n "$secret_value" ]]; then
        echo "$secret_value" | gh secret set "$secret_name"
        log_success "✅ Set $secret_name"
    else
        log_warning "⚠️  Skipped $secret_name (empty value)"
    fi
done

echo ""
log_info "📋 Setting optional secrets..."

for secret_name in "${!optional_secrets[@]}"; do
    secret_value="${optional_secrets[$secret_name]}"
    
    if [[ -n "$secret_value" ]]; then
        echo "$secret_value" | gh secret set "$secret_name"
        log_success "✅ Set $secret_name"
    else
        log_warning "⚠️  Skipped $secret_name (not configured)"
    fi
done

echo ""
log_info "🔍 Verifying secrets..."
gh secret list

echo ""
log_success "🎉 GitHub secrets setup complete!"
echo ""
log_info "📚 Next steps:"
echo "1. Your GitHub Actions will now have access to production environment variables"
echo "2. Push to main branch to trigger automated deployment: git push origin main"
echo "3. Monitor deployment: gh run list"
echo "4. Your site will be live at: https://www.directfanz.io"

echo ""
log_warning "🔐 Security reminders:"
echo "• These secrets are now securely stored in GitHub"
echo "• Only repository collaborators with admin access can view them"
echo "• GitHub Actions can access them during workflow execution"
echo "• Update secrets here when you change environment variables"