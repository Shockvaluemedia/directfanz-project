#!/bin/bash

echo "🚀 DirectFanz Quick Deploy"
echo "========================="

# Check if infrastructure exists
echo "1. Checking AWS infrastructure..."
if aws ecs describe-clusters --clusters directfanz-cluster --region us-east-1 >/dev/null 2>&1; then
    echo "✅ ECS cluster exists"
else
    echo "❌ ECS cluster not found - deploying infrastructure first..."
    cd infrastructure/terraform
    terraform init
    terraform apply -auto-approve
    cd ../..
fi

# Deploy using existing task definition
echo "2. Deploying application..."
aws ecs update-service \
  --cluster directfanz-cluster \
  --service directfanz-web \
  --task-definition directfanz-web:1 \
  --desired-count 2 \
  --region us-east-1

echo "3. Checking deployment status..."
aws ecs describe-services \
  --cluster directfanz-cluster \
  --services directfanz-web \
  --region us-east-1 \
  --query 'services[0].deployments[0].status'

echo "✅ DirectFanz deployed!"
echo "🌐 Access at: https://directfanz.io"