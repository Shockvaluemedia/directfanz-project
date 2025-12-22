#!/bin/bash
# Build script for PgBouncer Docker image

set -e

# Configuration
IMAGE_NAME="direct-fan-platform-pgbouncer"
IMAGE_TAG="latest"
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${IMAGE_NAME}"

echo "Building PgBouncer Docker image..."

# Build the Docker image
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# Tag for ECR
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${ECR_REPOSITORY}:${IMAGE_TAG}

echo "Docker image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "ECR tag: ${ECR_REPOSITORY}:${IMAGE_TAG}"

# Optional: Push to ECR (uncomment if needed)
# echo "Logging in to ECR..."
# aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY}
# 
# echo "Creating ECR repository if it doesn't exist..."
# aws ecr create-repository --repository-name ${IMAGE_NAME} --region ${AWS_REGION} || true
# 
# echo "Pushing image to ECR..."
# docker push ${ECR_REPOSITORY}:${IMAGE_TAG}
# 
# echo "Image pushed successfully to ECR: ${ECR_REPOSITORY}:${IMAGE_TAG}"