#!/bin/bash

# DirectFanz Application Deployment Script
# Builds and deploys the DirectFanz app to ECS using AWS CodeBuild

set -e

echo "🚀 Starting DirectFanz Application Deployment..."

# Configuration
REGION="us-east-1"
ECR_REPO="545582548240.dkr.ecr.us-east-1.amazonaws.com/directfanz-production"
CLUSTER_NAME="directfanz-cluster"
SERVICE_NAME="directfanz-app"
TASK_FAMILY="directfanz-app"

echo "📦 Creating CodeBuild project for DirectFanz..."

# Create buildspec for DirectFanz application
cat > buildspec-directfanz.yml << 'EOF'
version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
      - REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/directfanz-production
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}
  build:
    commands:
      - echo Build started on `date`
      - echo Building the Docker image...
      - docker build --platform linux/amd64 -f Dockerfile.ecs -t $REPOSITORY_URI:latest .
      - docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing the Docker images...
      - docker push $REPOSITORY_URI:latest
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - echo Writing image definitions file...
      - printf '[{"name":"directfanz-app","imageUri":"%s"}]' $REPOSITORY_URI:latest > imagedefinitions.json
artifacts:
  files:
    - imagedefinitions.json
EOF

# Create CodeBuild project
aws codebuild create-project \
  --name "directfanz-app-build" \
  --source type=S3,location="directfanz-deployment-bucket/source.zip" \
  --artifacts type=NO_ARTIFACTS \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/amazonlinux2-x86_64-standard:3.0,computeType=BUILD_GENERAL1_MEDIUM,privilegedMode=true \
  --service-role "arn:aws:iam::545582548240:role/codebuild-directfanz-service-role" \
  --region $REGION 2>/dev/null || echo "CodeBuild project already exists"

echo "📁 Creating deployment package..."

# Create a temporary directory for the build
TEMP_DIR=$(mktemp -d)
cp -r . $TEMP_DIR/
cd $TEMP_DIR

# Remove unnecessary files to reduce package size
rm -rf .git node_modules .next logs test-results performance-results playwright-report
rm -f *.log *.db

# Create zip file
zip -r source.zip . -x "*.git*" "node_modules/*" ".next/*" "logs/*" "test-results/*"

echo "📤 Uploading source to S3..."

# Upload to S3
aws s3 cp source.zip s3://directfanz-deployment-bucket/source.zip --region $REGION

echo "🔨 Starting CodeBuild..."

# Start the build
BUILD_ID=$(aws codebuild start-build \
  --project-name "directfanz-app-build" \
  --source-version "main" \
  --region $REGION \
  --query 'build.id' \
  --output text)

echo "Build started with ID: $BUILD_ID"

# Wait for build to complete
echo "⏳ Waiting for build to complete..."
aws codebuild batch-get-builds --ids $BUILD_ID --region $REGION --query 'builds[0].buildStatus' --output text

# Monitor build status
while true; do
  STATUS=$(aws codebuild batch-get-builds --ids $BUILD_ID --region $REGION --query 'builds[0].buildStatus' --output text)
  echo "Build status: $STATUS"
  
  if [ "$STATUS" = "SUCCEEDED" ]; then
    echo "✅ Build completed successfully!"
    break
  elif [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "FAULT" ] || [ "$STATUS" = "STOPPED" ] || [ "$STATUS" = "TIMED_OUT" ]; then
    echo "❌ Build failed with status: $STATUS"
    # Get build logs
    aws logs get-log-events \
      --log-group-name "/aws/codebuild/directfanz-app-build" \
      --log-stream-name "$BUILD_ID" \
      --region $REGION \
      --query 'events[*].message' \
      --output text | tail -20
    exit 1
  fi
  
  sleep 30
done

echo "🔄 Updating ECS service..."

# Force new deployment of ECS service
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment \
  --region $REGION

echo "⏳ Waiting for service to stabilize..."

# Wait for service to be stable
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $REGION

echo "✅ DirectFanz application deployed successfully!"

# Check service status
RUNNING_COUNT=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $REGION \
  --query 'services[0].runningCount' \
  --output text)

DESIRED_COUNT=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $REGION \
  --query 'services[0].desiredCount' \
  --output text)

echo "Service Status: $RUNNING_COUNT/$DESIRED_COUNT tasks running"

if [ "$RUNNING_COUNT" = "$DESIRED_COUNT" ]; then
  echo "🎉 DirectFanz is now live at https://directfanz.io"
else
  echo "⚠️  Service is still starting up. Check ECS console for details."
fi

# Cleanup
cd - > /dev/null
rm -rf $TEMP_DIR

echo "🧹 Cleanup completed"