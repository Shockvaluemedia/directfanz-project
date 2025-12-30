#!/bin/bash

# DirectFanz Production Deployment Script
# This script automates the deployment of DirectFanz to AWS production environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="directfanz"
ENVIRONMENT="prod"
AWS_REGION="us-east-1"
DOMAIN_NAME="directfanz.io"

# Functions
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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed and configured
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    log_success "All prerequisites met"
}

setup_terraform() {
    log_info "Setting up Terraform configuration..."
    
    if [ ! -d "infrastructure/terraform" ]; then
        log_error "Terraform directory not found. Please ensure you're in the project root."
        exit 1
    fi
    
    cd infrastructure/terraform
    
    # Create terraform.tfvars if it doesn't exist
    if [ ! -f terraform.tfvars ]; then
        log_info "Creating terraform.tfvars from example..."
        cp terraform.tfvars.example terraform.tfvars
        
        # Prompt for required values
        read -p "Enter your alert email: " ALERT_EMAIL
        
        # Update terraform.tfvars
        sed -i.bak "s/# alert_email = \"admin@directfanz.io\"/alert_email = \"$ALERT_EMAIL\"/" terraform.tfvars
        
        log_warning "Please review and update terraform.tfvars with your specific configuration"
        read -p "Press Enter to continue after reviewing terraform.tfvars..."
    else
        log_info "terraform.tfvars already exists"
        
        # Check if alert_email is configured
        if ! grep -q "alert_email" terraform.tfvars; then
            read -p "Enter your alert email for notifications: " ALERT_EMAIL
            echo "" >> terraform.tfvars
            echo "# Alert Configuration" >> terraform.tfvars
            echo "alert_email = \"$ALERT_EMAIL\"" >> terraform.tfvars
            log_success "Alert email added to terraform.tfvars"
        fi
    fi
    
    log_success "Terraform configuration ready"
}

deploy_infrastructure() {
    log_info "Deploying AWS infrastructure..."
    
    if [ ! -d "infrastructure/terraform" ]; then
        log_error "Terraform directory not found. Please ensure you're in the project root."
        exit 1
    fi
    
    cd infrastructure/terraform
    
    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init
    
    # Plan deployment
    log_info "Planning Terraform deployment..."
    terraform plan -out=tfplan
    
    # Confirm deployment
    read -p "Do you want to proceed with the infrastructure deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Deployment cancelled"
        exit 0
    fi
    
    # Apply deployment
    log_info "Applying Terraform deployment..."
    terraform apply tfplan
    
    # Get outputs
    log_info "Getting Terraform outputs..."
    ROUTE53_NAME_SERVERS=$(terraform output -json route53_name_servers | jq -r '.[]')
    ALB_DNS_NAME=$(terraform output -raw alb_dns_name)
    RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
    REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
    ECR_REPOSITORY_URL=$(terraform output -raw ecr_repository_url)
    
    # Save outputs to file
    cat > ../../deployment_outputs.txt << EOF
Route 53 Name Servers:
$ROUTE53_NAME_SERVERS

Load Balancer DNS: $ALB_DNS_NAME
RDS Endpoint: $RDS_ENDPOINT
Redis Endpoint: $REDIS_ENDPOINT
ECR Repository: $ECR_REPOSITORY_URL
EOF
    
    log_success "Infrastructure deployed successfully"
    log_info "Deployment outputs saved to deployment_outputs.txt"
    
    cd ../..
}

show_dns_instructions() {
    log_info "DNS Configuration Instructions:"
    echo
    echo "1. Log into your Hostinger control panel"
    echo "2. Navigate to DNS/Name Servers section"
    echo "3. Change name servers to:"
    echo "$ROUTE53_NAME_SERVERS"
    echo "4. Save changes"
    echo
    log_warning "DNS propagation can take 24-48 hours"
    echo
    read -p "Press Enter after updating DNS settings in Hostinger..."
}

build_and_push_image() {
    log_info "Building and pushing Docker image..."
    
    # Build Docker image
    log_info "Building Docker image..."
    docker build -t $PROJECT_NAME:latest .
    
    # Tag for ECR
    docker tag $PROJECT_NAME:latest $ECR_REPOSITORY_URL:latest
    
    # Login to ECR
    log_info "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY_URL
    
    # Push image
    log_info "Pushing image to ECR..."
    docker push $ECR_REPOSITORY_URL:latest
    
    log_success "Docker image pushed successfully"
}

setup_environment_variables() {
    log_info "Setting up production environment variables..."
    
    if [ ! -f .env.production ]; then
        log_info "Creating .env.production template..."
        
        # Prompt for required values
        read -s -p "Enter database password: " DB_PASSWORD
        echo
        read -p "Enter Stripe publishable key: " STRIPE_PK
        read -s -p "Enter Stripe secret key: " STRIPE_SK
        echo
        read -s -p "Enter Stripe webhook secret: " STRIPE_WEBHOOK
        echo
        read -p "Enter SendGrid API key: " SENDGRID_KEY
        read -s -p "Enter NextAuth secret: " NEXTAUTH_SECRET
        echo
        
        # Create .env.production
        cat > .env.production << EOF
# Database
DATABASE_URL="postgresql://postgres:$DB_PASSWORD@$RDS_ENDPOINT:5432/directfanz"

# Redis
REDIS_URL="redis://$REDIS_ENDPOINT:6379"

# NextAuth.js
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="https://$DOMAIN_NAME"

# Stripe
STRIPE_PUBLISHABLE_KEY="$STRIPE_PK"
STRIPE_SECRET_KEY="$STRIPE_SK"
STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK"

# SendGrid
SENDGRID_API_KEY="$SENDGRID_KEY"
FROM_EMAIL="noreply@$DOMAIN_NAME"

# App Configuration
NEXT_PUBLIC_APP_URL="https://$DOMAIN_NAME"
NEXT_PUBLIC_APP_VERSION="1.0.0"

# AWS
AWS_REGION="$AWS_REGION"
AWS_S3_BUCKET_NAME="$PROJECT_NAME-content-prod"
EOF
        
        log_success "Environment variables configured"
    else
        log_info ".env.production already exists"
    fi
}

deploy_application() {
    log_info "Deploying application to ECS..."
    
    # Update ECS service
    CLUSTER_NAME="$PROJECT_NAME-cluster"
    SERVICE_NAME="$PROJECT_NAME-web-app"
    
    log_info "Updating ECS service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $AWS_REGION
    
    # Wait for deployment to complete
    log_info "Waiting for deployment to complete..."
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $AWS_REGION
    
    log_success "Application deployed successfully"
}

run_database_migrations() {
    log_info "Running database migrations..."
    
    # This would typically be done via ECS task or bastion host
    log_warning "Database migrations need to be run manually:"
    echo "1. Connect to ECS task or use bastion host"
    echo "2. Run: npm run db:migrate"
    echo "3. Run: npm run db:seed"
    
    read -p "Press Enter after running database migrations..."
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Test health endpoints
    ENDPOINTS=(
        "https://$DOMAIN_NAME/api/health"
        "https://api.$DOMAIN_NAME/api/health"
    )
    
    for endpoint in "${ENDPOINTS[@]}"; do
        log_info "Testing $endpoint..."
        if curl -f -s "$endpoint" > /dev/null; then
            log_success "$endpoint is responding"
        else
            log_warning "$endpoint is not responding (this is expected if DNS hasn't propagated)"
        fi
    done
}

main() {
    echo "========================================="
    echo "DirectFanz Production Deployment Script"
    echo "========================================="
    echo
    
    check_prerequisites
    setup_terraform
    deploy_infrastructure
    show_dns_instructions
    build_and_push_image
    setup_environment_variables
    deploy_application
    run_database_migrations
    verify_deployment
    
    echo
    log_success "Deployment completed!"
    echo
    echo "Next steps:"
    echo "1. Wait for DNS propagation (24-48 hours)"
    echo "2. Verify SSL certificates are issued"
    echo "3. Test all functionality"
    echo "4. Monitor CloudWatch metrics"
    echo
    echo "Deployment outputs saved in: deployment_outputs.txt"
    echo "Environment variables saved in: .env.production"
}

# Run main function
main "$@"