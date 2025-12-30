#!/bin/bash

# Script to get AWS infrastructure information for domain setup
# Run this after your AWS infrastructure is deployed

echo "🔍 Getting AWS Infrastructure Information for Domain Setup"
echo "========================================================="

# Check if we're in the right directory
if [ ! -d "infrastructure/terraform" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

cd infrastructure/terraform

# Check if terraform is initialized
if [ ! -d ".terraform" ]; then
    echo "⚠️  Terraform not initialized. Running terraform init..."
    terraform init
fi

echo ""
echo "📋 AWS Infrastructure Details:"
echo "------------------------------"

# Get Route 53 name servers
echo "🌐 Route 53 Name Servers (use these in Hostinger):"
terraform output -raw route53_name_servers 2>/dev/null || echo "❌ Route 53 name servers not found. Make sure infrastructure is deployed."

echo ""
echo "🔗 Load Balancer Details:"
terraform output -raw alb_dns_name 2>/dev/null || echo "❌ ALB DNS name not found"

echo ""
echo "☁️  CloudFront Distribution:"
terraform output -raw cloudfront_distribution_domain_name 2>/dev/null || echo "❌ CloudFront domain not found"

echo ""
echo "🔒 SSL Certificate Status:"
terraform output -raw ssl_certificate_status 2>/dev/null || echo "❌ SSL certificate status not found"

echo ""
echo "📊 Current Domain Configuration:"
terraform output -json dns_records 2>/dev/null | jq -r 'to_entries[] | "\(.key): \(.value)"' 2>/dev/null || echo "❌ DNS records not found"

echo ""
echo "🏥 Health Check Endpoints:"
echo "Main: https://$(terraform output -raw domain_name 2>/dev/null || echo 'your-domain.com')/api/health"
echo "API: https://api.$(terraform output -raw domain_name 2>/dev/null || echo 'your-domain.com')/api/health"

echo ""
echo "📝 Next Steps:"
echo "1. Copy the Route 53 name servers above"
echo "2. Log into Hostinger and update your domain's name servers"
echo "3. Wait 24-48 hours for DNS propagation"
echo "4. Test your domain with: curl -I https://your-domain.com"

echo ""
echo "🔧 Troubleshooting:"
echo "If outputs are missing, your infrastructure may not be deployed yet."
echo "Run: cd infrastructure/terraform && terraform apply"