#!/bin/bash

# DirectFanz Production Environment Validation Script
# Validates all required environment variables are set

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

# Load environment variables
if [ -f ".env.production" ]; then
    source .env.production
    log_info "Loaded .env.production"
else
    log_error ".env.production file not found"
    exit 1
fi

# Track validation status
VALIDATION_PASSED=true
MISSING_VARS=()
INVALID_VARS=()

# Function to check required variable
check_required() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2
    
    if [ -z "$var_value" ]; then
        log_error "❌ $var_name is not set ($description)"
        MISSING_VARS+=("$var_name")
        VALIDATION_PASSED=false
    else
        log_success "✅ $var_name is set"
    fi
}

# Function to check optional variable
check_optional() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2
    
    if [ -z "$var_value" ]; then
        log_warning "⚠️  $var_name is not set ($description) - Optional"
    else
        log_success "✅ $var_name is set"
    fi
}

# Function to validate URL format
validate_url() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2
    
    if [ -n "$var_value" ]; then
        if [[ $var_value =~ ^https?:// ]]; then
            log_success "✅ $var_name has valid URL format"
        else
            log_error "❌ $var_name has invalid URL format ($description)"
            INVALID_VARS+=("$var_name")
            VALIDATION_PASSED=false
        fi
    fi
}

echo "🔍 DirectFanz Production Environment Validation"
echo "=============================================="
echo

# Core Application Variables
echo "📱 Core Application:"
check_required "NODE_ENV" "Environment (should be 'production')"
check_required "NEXTAUTH_SECRET" "NextAuth secret key"
check_required "NEXTAUTH_URL" "NextAuth callback URL"
check_required "NEXT_PUBLIC_APP_URL" "Public app URL"
validate_url "NEXTAUTH_URL" "NextAuth URL"
validate_url "NEXT_PUBLIC_APP_URL" "Public app URL"
echo

# Database Configuration
echo "🗄️  Database Configuration:"
check_required "DATABASE_URL" "PostgreSQL connection string"
if [ -n "$DATABASE_URL" ]; then
    if [[ $DATABASE_URL =~ ^postgresql:// ]]; then
        log_success "✅ DATABASE_URL has valid PostgreSQL format"
    else
        log_error "❌ DATABASE_URL has invalid PostgreSQL format"
        INVALID_VARS+=("DATABASE_URL")
        VALIDATION_PASSED=false
    fi
fi
echo

# Redis Configuration
echo "🔴 Redis Configuration:"
check_required "REDIS_URL" "Redis connection string"
if [ -n "$REDIS_URL" ]; then
    if [[ $REDIS_URL =~ ^redis:// ]]; then
        log_success "✅ REDIS_URL has valid Redis format"
    else
        log_error "❌ REDIS_URL has invalid Redis format"
        INVALID_VARS+=("REDIS_URL")
        VALIDATION_PASSED=false
    fi
fi
echo

# AWS Configuration
echo "☁️  AWS Configuration:"
check_required "AWS_REGION" "AWS region"
check_required "AWS_ACCESS_KEY_ID" "AWS access key"
check_required "AWS_SECRET_ACCESS_KEY" "AWS secret key"
check_required "AWS_S3_BUCKET_NAME" "S3 bucket for content storage"
echo

# Stripe Configuration
echo "💳 Stripe Configuration:"
check_required "STRIPE_PUBLISHABLE_KEY" "Stripe publishable key"
check_required "STRIPE_SECRET_KEY" "Stripe secret key"
check_required "STRIPE_WEBHOOK_SECRET" "Stripe webhook secret"

# Validate Stripe key formats
if [ -n "$STRIPE_PUBLISHABLE_KEY" ]; then
    if [[ $STRIPE_PUBLISHABLE_KEY =~ ^pk_live_ ]]; then
        log_success "✅ STRIPE_PUBLISHABLE_KEY is live key"
    elif [[ $STRIPE_PUBLISHABLE_KEY =~ ^pk_test_ ]]; then
        log_warning "⚠️  STRIPE_PUBLISHABLE_KEY is test key (should be live for production)"
    else
        log_error "❌ STRIPE_PUBLISHABLE_KEY has invalid format"
        INVALID_VARS+=("STRIPE_PUBLISHABLE_KEY")
        VALIDATION_PASSED=false
    fi
fi

if [ -n "$STRIPE_SECRET_KEY" ]; then
    if [[ $STRIPE_SECRET_KEY =~ ^sk_live_ ]]; then
        log_success "✅ STRIPE_SECRET_KEY is live key"
    elif [[ $STRIPE_SECRET_KEY =~ ^sk_test_ ]]; then
        log_warning "⚠️  STRIPE_SECRET_KEY is test key (should be live for production)"
    else
        log_error "❌ STRIPE_SECRET_KEY has invalid format"
        INVALID_VARS+=("STRIPE_SECRET_KEY")
        VALIDATION_PASSED=false
    fi
fi
echo

# Email Configuration
echo "📧 Email Configuration:"
check_required "SENDGRID_API_KEY" "SendGrid API key"
check_required "FROM_EMAIL" "From email address"
echo

# Optional Monitoring
echo "📊 Monitoring (Optional):"
check_optional "SENTRY_DSN" "Sentry error tracking"
check_optional "SENTRY_ORG" "Sentry organization"
check_optional "SENTRY_PROJECT" "Sentry project"
echo

# Optional Features
echo "🚀 Feature Flags (Optional):"
check_optional "ENABLE_ANALYTICS" "Analytics feature"
check_optional "ENABLE_STREAMING" "Streaming feature"
check_optional "ENABLE_AI_FEATURES" "AI features"
check_optional "ENABLE_NOTIFICATIONS" "Notifications"
echo

# Summary
echo "📋 Validation Summary"
echo "===================="

if [ "$VALIDATION_PASSED" = true ]; then
    log_success "🎉 All required environment variables are properly configured!"
    echo
    log_info "Your DirectFanz production environment is ready for deployment."
    exit 0
else
    log_error "❌ Environment validation failed!"
    echo
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo "Missing required variables:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        echo
    fi
    
    if [ ${#INVALID_VARS[@]} -gt 0 ]; then
        echo "Invalid variable formats:"
        for var in "${INVALID_VARS[@]}"; do
            echo "  - $var"
        done
        echo
    fi
    
    log_info "Please fix the above issues and run validation again."
    exit 1
fi