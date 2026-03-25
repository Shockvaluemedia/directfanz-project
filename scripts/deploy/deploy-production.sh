#!/bin/bash

echo "🚀 DirectFanz Production Deployment"
echo "=================================="

# Step 1: Build and push Docker image
echo "1. Building production Docker image..."
docker build -f Dockerfile.production -t directfanz-prod .
docker tag directfanz-prod:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/directfanz:latest

# Step 2: Push to ECR
echo "2. Pushing to ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/directfanz:latest

# Step 3: Update ECS service
echo "3. Updating ECS service..."
aws ecs update-service \
  --cluster directfanz-cluster \
  --service directfanz-web \
  --force-new-deployment \
  --region us-east-1

# Step 4: Wait for deployment
echo "4. Waiting for deployment to complete..."
aws ecs wait services-stable \
  --cluster directfanz-cluster \
  --services directfanz-web \
  --region us-east-1

echo "✅ Deployment complete!"
echo "🌐 Visit: https://directfanz.io"