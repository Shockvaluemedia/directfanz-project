#!/bin/bash

# DirectFanz ECS Container Deployment Script
# Builds and deploys Docker images to AWS ECR for ECS deployment

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
WEB_APP_REPO="directfanz-web"
WEBSOCKET_REPO="directfanz-websocket"
IMAGE_TAG=${IMAGE_TAG:-latest}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if AWS account ID is set
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        log_error "AWS_ACCOUNT_ID environment variable is not set."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Authenticate with ECR
authenticate_ecr() {
    log_info "Authenticating with ECR..."
    
    aws ecr get-login-password --region $AWS_REGION | \
        docker login --username AWS --password-stdin $ECR_REGISTRY
    
    if [ $? -eq 0 ]; then
        log_success "ECR authentication successful"
    else
        log_error "ECR authentication failed"
        exit 1
    fi
}

# Create ECR repositories if they don't exist
create_ecr_repositories() {
    log_info "Creating ECR repositories if they don't exist..."
    
    # Create web app repository
    aws ecr describe-repositories --repository-names $WEB_APP_REPO --region $AWS_REGION &> /dev/null || {
        log_info "Creating ECR repository: $WEB_APP_REPO"
        aws ecr create-repository \
            --repository-name $WEB_APP_REPO \
            --region $AWS_REGION \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
    }
    
    # Create websocket repository
    aws ecr describe-repositories --repository-names $WEBSOCKET_REPO --region $AWS_REGION &> /dev/null || {
        log_info "Creating ECR repository: $WEBSOCKET_REPO"
        aws ecr create-repository \
            --repository-name $WEBSOCKET_REPO \
            --region $AWS_REGION \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
    }
    
    log_success "ECR repositories ready"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    # Build web app image
    log_info "Building web app image..."
    docker build -f Dockerfile.ecs -t $WEB_APP_REPO:$IMAGE_TAG .
    docker tag $WEB_APP_REPO:$IMAGE_TAG $ECR_REGISTRY/$WEB_APP_REPO:$IMAGE_TAG
    
    # Build websocket image
    log_info "Building websocket image..."
    docker build -f Dockerfile.websocket -t $WEBSOCKET_REPO:$IMAGE_TAG .
    docker tag $WEBSOCKET_REPO:$IMAGE_TAG $ECR_REGISTRY/$WEBSOCKET_REPO:$IMAGE_TAG
    
    log_success "Docker images built successfully"
}

# Push images to ECR
push_images() {
    log_info "Pushing images to ECR..."
    
    # Push web app image
    log_info "Pushing web app image..."
    docker push $ECR_REGISTRY/$WEB_APP_REPO:$IMAGE_TAG
    
    # Push websocket image
    log_info "Pushing websocket image..."
    docker push $ECR_REGISTRY/$WEBSOCKET_REPO:$IMAGE_TAG
    
    log_success "Images pushed to ECR successfully"
}

# Update ECS task definitions
update_task_definitions() {
    log_info "Updating ECS task definitions..."
    
    # Update web app task definition
    log_info "Updating web app task definition..."
    sed "s/ACCOUNT_ID/$AWS_ACCOUNT_ID/g; s/REGION/$AWS_REGION/g" \
        ecs-task-definitions/web-app-task.json > /tmp/web-app-task.json
    
    aws ecs register-task-definition \
        --cli-input-json file:///tmp/web-app-task.json \
        --region $AWS_REGION
    
    # Update websocket task definition
    log_info "Updating websocket task definition..."
    sed "s/ACCOUNT_ID/$AWS_ACCOUNT_ID/g; s/REGION/$AWS_REGION/g" \
        ecs-task-definitions/websocket-task.json > /tmp/websocket-task.json
    
    aws ecs register-task-definition \
        --cli-input-json file:///tmp/websocket-task.json \
        --region $AWS_REGION
    
    # Clean up temporary files
    rm -f /tmp/web-app-task.json /tmp/websocket-task.json
    
    log_success "Task definitions updated"
}

# Update ECS services
update_services() {
    log_info "Updating ECS services..."
    
    CLUSTER_NAME="directfanz-cluster"
    
    # Update web app service
    log_info "Updating web app service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service directfanz-web \
        --task-definition directfanz-web-app \
        --region $AWS_REGION \
        --force-new-deployment
    
    # Update websocket service
    log_info "Updating websocket service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service directfanz-websocket \
        --task-definition directfanz-websocket \
        --region $AWS_REGION \
        --force-new-deployment
    
    log_success "ECS services updated"
}

# Wait for deployment to complete
wait_for_deployment() {
    log_info "Waiting for deployment to complete..."
    
    CLUSTER_NAME="directfanz-cluster"
    
    # Wait for web app service
    log_info "Waiting for web app service deployment..."
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services directfanz-web \
        --region $AWS_REGION
    
    # Wait for websocket service
    log_info "Waiting for websocket service deployment..."
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services directfanz-websocket \
        --region $AWS_REGION
    
    log_success "Deployment completed successfully"
}

# Cleanup old images
cleanup_old_images() {
    log_info "Cleaning up old Docker images..."
    
    # Remove local images to save space
    docker rmi $WEB_APP_REPO:$IMAGE_TAG $WEBSOCKET_REPO:$IMAGE_TAG || true
    docker rmi $ECR_REGISTRY/$WEB_APP_REPO:$IMAGE_TAG $ECR_REGISTRY/$WEBSOCKET_REPO:$IMAGE_TAG || true
    
    # Clean up dangling images
    docker image prune -f
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting DirectFanz ECS deployment..."
    
    check_prerequisites
    authenticate_ecr
    create_ecr_repositories
    build_images
    push_images
    update_task_definitions
    update_services
    wait_for_deployment
    cleanup_old_images
    
    log_success "🚀 DirectFanz ECS deployment completed successfully!"
    log_info "Web App: https://your-alb-domain.com"
    log_info "WebSocket: wss://your-alb-domain.com/socket.io/"
}

# Handle script arguments
case "${1:-deploy}" in
    "build-only")
        log_info "Building images only..."
        check_prerequisites
        build_images
        ;;
    "push-only")
        log_info "Pushing images only..."
        check_prerequisites
        authenticate_ecr
        push_images
        ;;
    "deploy")
        main
        ;;
    *)
        echo "Usage: $0 [build-only|push-only|deploy]"
        echo "  build-only: Build Docker images only"
        echo "  push-only:  Push images to ECR only"
        echo "  deploy:     Full deployment (default)"
        exit 1
        ;;
esac