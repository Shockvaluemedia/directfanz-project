#!/bin/bash

# DirectFanz Quick Production Deploy Script
# Builds locally and deploys to ECS using existing image

set -e

# Load production environment variables
if [ -f ".env.production" ]; then
    source .env.production
    echo "[INFO] Loaded production environment variables"
else
    echo "[WARNING] .env.production not found, using default values"
fi

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ECS_CLUSTER="directfanz-production"
ECS_SERVICE="directfanz-app-new"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed"
    exit 1
fi

# Force new deployment with existing image
log_info "Forcing new ECS deployment with existing image..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --force-new-deployment \
    --region $AWS_REGION

log_success "Deployment initiated"

# Wait for service to stabilize
log_info "Waiting for service to stabilize (this may take a few minutes)..."
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION

log_success "🚀 Deployment completed successfully!"

# Verify the site
log_info "Verifying site availability..."
sleep 10
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://directfanz.io 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    log_success "✅ Site is live and returning 200 OK"
    log_success "🌐 DirectFanz is now live at: https://directfanz.io"
else
    log_error "Site returned HTTP $HTTP_CODE - may need more time to stabilize"
    log_info "Check ECS service status: aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE"
fi