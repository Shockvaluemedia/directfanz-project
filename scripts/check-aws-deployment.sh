#!/bin/bash

# Script to check AWS deployment status before connecting domain
echo "🔍 Checking AWS Deployment Status"
echo "=================================="

# Check if AWS CLI is configured
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install and configure AWS CLI first."
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    echo "✅ AWS credentials configured"
    aws sts get-caller-identity --query 'Account' --output text | xargs echo "Account ID:"
else
    echo "❌ AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

echo ""
echo "🏗️  Checking Infrastructure Components..."

# Check if terraform directory exists
if [ ! -d "infrastructure/terraform" ]; then
    echo "❌ Terraform directory not found"
    exit 1
fi

cd infrastructure/terraform

# Check terraform state
if [ ! -f "terraform.tfstate" ] && [ ! -f ".terraform/terraform.tfstate" ]; then
    echo "❌ No terraform state found. Infrastructure may not be deployed."
    echo "💡 Run: terraform init && terraform apply"
    exit 1
fi

echo "✅ Terraform state found"

# Check key AWS resources
echo ""
echo "🔍 Checking AWS Resources..."

# Check ECS Cluster
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name 2>/dev/null)
if [ ! -z "$CLUSTER_NAME" ]; then
    if aws ecs describe-clusters --clusters "$CLUSTER_NAME" --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
        echo "✅ ECS Cluster: $CLUSTER_NAME (ACTIVE)"
    else
        echo "❌ ECS Cluster: $CLUSTER_NAME (NOT ACTIVE)"
    fi
else
    echo "❌ ECS Cluster not found in terraform output"
fi

# Check RDS Instance
DB_INSTANCE_ID=$(terraform output -raw db_enhanced_instance_id 2>/dev/null)
if [ ! -z "$DB_INSTANCE_ID" ]; then
    DB_STATUS=$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null)
    if [ "$DB_STATUS" = "available" ]; then
        echo "✅ RDS Database: $DB_INSTANCE_ID (available)"
    else
        echo "⚠️  RDS Database: $DB_INSTANCE_ID ($DB_STATUS)"
    fi
else
    echo "❌ RDS Database not found in terraform output"
fi

# Check Route 53 Hosted Zone
DOMAIN_NAME=$(terraform output -raw domain_name 2>/dev/null)
if [ ! -z "$DOMAIN_NAME" ]; then
    HOSTED_ZONE_ID=$(terraform output -raw route53_zone_id 2>/dev/null)
    if [ ! -z "$HOSTED_ZONE_ID" ]; then
        echo "✅ Route 53 Hosted Zone: $DOMAIN_NAME ($HOSTED_ZONE_ID)"
    else
        echo "❌ Route 53 Hosted Zone not found"
    fi
else
    echo "❌ Domain name not configured in terraform"
fi

# Check CloudFront Distribution
CF_DOMAIN=$(terraform output -raw cloudfront_distribution_domain_name 2>/dev/null)
if [ ! -z "$CF_DOMAIN" ]; then
    echo "✅ CloudFront Distribution: $CF_DOMAIN"
else
    echo "❌ CloudFront Distribution not found"
fi

# Check Load Balancer
ALB_DNS=$(terraform output -raw alb_dns_name 2>/dev/null)
if [ ! -z "$ALB_DNS" ]; then
    echo "✅ Application Load Balancer: $ALB_DNS"
    
    # Test ALB health
    if curl -s -o /dev/null -w "%{http_code}" "http://$ALB_DNS" | grep -q "200\|301\|302"; then
        echo "✅ ALB is responding to requests"
    else
        echo "⚠️  ALB may not be responding correctly"
    fi
else
    echo "❌ Application Load Balancer not found"
fi

echo ""
echo "📋 Summary:"
echo "----------"

# Count successful checks
CHECKS_PASSED=0
TOTAL_CHECKS=5

[ ! -z "$CLUSTER_NAME" ] && CHECKS_PASSED=$((CHECKS_PASSED + 1))
[ "$DB_STATUS" = "available" ] && CHECKS_PASSED=$((CHECKS_PASSED + 1))
[ ! -z "$HOSTED_ZONE_ID" ] && CHECKS_PASSED=$((CHECKS_PASSED + 1))
[ ! -z "$CF_DOMAIN" ] && CHECKS_PASSED=$((CHECKS_PASSED + 1))
[ ! -z "$ALB_DNS" ] && CHECKS_PASSED=$((CHECKS_PASSED + 1))

echo "✅ $CHECKS_PASSED/$TOTAL_CHECKS core components are ready"

if [ $CHECKS_PASSED -eq $TOTAL_CHECKS ]; then
    echo ""
    echo "🎉 Your AWS infrastructure is ready for domain connection!"
    echo "📝 Next steps:"
    echo "   1. Run: ./scripts/get-aws-domain-info.sh"
    echo "   2. Follow the DOMAIN_CONNECTION_CHECKLIST.md"
    echo "   3. Update your domain's name servers in Hostinger"
else
    echo ""
    echo "⚠️  Some components are not ready. Please check the issues above."
    echo "💡 You may need to run: terraform apply"
fi

cd - > /dev/null