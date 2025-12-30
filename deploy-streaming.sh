#!/bin/bash

# AWS Streaming Infrastructure Deployment Script
# Deploys MediaLive, MediaPackage, and CloudFront for DirectFanz streaming

set -e

echo "🚀 Deploying AWS Streaming Infrastructure for DirectFanz..."

# Check AWS CLI and credentials
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Set variables
REGION=${AWS_REGION:-us-east-1}
ENVIRONMENT=${ENVIRONMENT:-production}
PROJECT_NAME="directfanz"

echo "📍 Deploying to region: $REGION"
echo "🏷️  Environment: $ENVIRONMENT"

# Deploy Terraform infrastructure
echo "🏗️  Deploying Terraform infrastructure..."
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan deployment
echo "📋 Planning Terraform deployment..."
terraform plan -var="environment=$ENVIRONMENT" -var="aws_region=$REGION"

# Apply infrastructure
echo "🚀 Applying Terraform configuration..."
terraform apply -var="environment=$ENVIRONMENT" -var="aws_region=$REGION" -auto-approve

# Get outputs
RTMP_ENDPOINT=$(terraform output -raw rtmp_endpoint)
HLS_URL=$(terraform output -raw hls_playback_url)
CDN_DOMAIN=$(terraform output -raw cdn_domain)
RECORDINGS_BUCKET=$(terraform output -raw stream_recordings_bucket)

echo "✅ Infrastructure deployed successfully!"
echo ""
echo "📺 Streaming Endpoints:"
echo "   RTMP Endpoint: $RTMP_ENDPOINT"
echo "   HLS Playback: $HLS_URL"
echo "   CDN Domain: $CDN_DOMAIN"
echo "   Recordings: s3://$RECORDINGS_BUCKET"
echo ""

# Update environment variables
echo "🔧 Updating environment variables..."
cd ../../

# Create/update .env.production with streaming config
cat >> .env.production << EOF

# AWS Streaming Configuration
AWS_MEDIALIVE_RTMP_ENDPOINT=$RTMP_ENDPOINT
AWS_MEDIAPACKAGE_HLS_URL=$HLS_URL
CLOUDFRONT_STREAMING_DOMAIN=$CDN_DOMAIN
AWS_STREAM_RECORDINGS_BUCKET=$RECORDINGS_BUCKET
WS_PORT=3001

EOF

echo "✅ Environment variables updated!"

# Install streaming dependencies
echo "📦 Installing streaming dependencies..."
npm install @aws-sdk/client-medialive@^3.450.0 @aws-sdk/client-mediapackage@^3.450.0 hls.js@^1.4.12 socket.io@^4.7.4 socket.io-client@^4.7.4
npm install -D @types/hls.js@^1.0.1

echo "✅ Dependencies installed!"

# Build and deploy application
echo "🏗️  Building application with streaming features..."
npm run build

echo "🚀 Deploying to production..."
npm run deploy

echo ""
echo "🎉 AWS Streaming Infrastructure Deployment Complete!"
echo ""
echo "🎬 Your DirectFanz platform now supports:"
echo "   ✅ Professional RTMP streaming (OBS, XSplit, etc.)"
echo "   ✅ Multi-bitrate transcoding (480p, 720p, 1080p)"
echo "   ✅ Global CDN delivery via CloudFront"
echo "   ✅ Real-time chat and donations"
echo "   ✅ Stream analytics and monitoring"
echo "   ✅ Automatic stream recording to S3"
echo ""
echo "📖 Next Steps:"
echo "   1. Configure OBS with RTMP endpoint: $RTMP_ENDPOINT"
echo "   2. Test streaming from dashboard: https://directfanz.io/dashboard/artist/livestreams"
echo "   3. Monitor streams: https://directfanz.io/streaming/live"
echo ""
echo "🎯 Ready for production streaming! 🚀"