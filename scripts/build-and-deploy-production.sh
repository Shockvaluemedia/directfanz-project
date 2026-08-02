#!/bin/bash

# DirectFanz Production Build and Deploy Script
# Builds Docker image for linux/amd64 and deploys to ECS

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
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-545582548240}
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_REPO="directfanz-production"
IMAGE_TAG=${IMAGE_TAG:-latest}
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

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi

if ! docker info &> /dev/null; then
    log_error "Docker is not running"
    exit 1
fi

# Authenticate with ECR
log_info "Authenticating with ECR..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_REGISTRY

# Build image for linux/amd64 platform (required for ECS Fargate)
log_info "Building Docker image for linux/amd64..."
docker buildx build \
    --platform linux/amd64 \
    -f Dockerfile.production \
    -t $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG \
    --load \
    .

log_success "Docker image built successfully"

# Push to ECR
log_info "Pushing image to ECR..."
docker push $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG

log_success "Image pushed to ECR"

# Force new deployment
log_info "Forcing new ECS deployment..."
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
else
    log_error "Site returned HTTP $HTTP_CODE - may need more time to stabilize"
fi
