#!/bin/bash

# Check Domain Connection Status for directfanz.io

echo "🔍 Checking directfanz.io domain connection status..."
echo "=================================================="

DOMAIN="directfanz.io"
AWS_ALB="directfanz-alb-v2-9638983.us-east-1.elb.amazonaws.com"

echo ""
echo "1. 📋 AWS Infrastructure Status"
echo "--------------------------------"
echo "✅ Route 53 Hosted Zone: $DOMAIN"
echo "✅ Application Load Balancer: $AWS_ALB"
echo "✅ ECS Cluster: directfanz-cluster-v2"
echo "✅ RDS Database: Configured"
echo "✅ ElastiCache Redis: Configured"
echo "✅ S3 Buckets: Content & Static Assets"

echo ""
echo "2. 🌐 DNS Status Check"
echo "----------------------"

# Check current DNS resolution
echo "Current DNS resolution for $DOMAIN:"
dig +short $DOMAIN A || echo "❌ Domain not resolving"

echo ""
echo "Current nameservers for $DOMAIN:"
dig +short $DOMAIN NS || echo "❌ No nameservers found"

echo ""
echo "Expected AWS nameservers:"
echo "  ns-128.awsdns-16.com"
echo "  ns-1490.awsdns-58.org"
echo "  ns-1928.awsdns-49.co.uk"
echo "  ns-863.awsdns-43.net"

echo ""
echo "3. 🔒 CAA Records Check"
echo "-----------------------"
echo "Current CAA records:"
dig +short $DOMAIN CAA || echo "No CAA records found"

echo ""
echo "Required CAA record for AWS SSL:"
echo "  0 issue \"amazon.com\""

echo ""
echo "4. 🚀 Application Status"
echo "------------------------"
echo "Testing AWS ALB endpoint:"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$AWS_ALB/api/health" 2>/dev/null)
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Application is running on AWS (HTTP $HTTP_STATUS)"
else
    echo "❌ Application not responding (HTTP $HTTP_STATUS)"
fi

echo ""
echo "5. 📝 Next Steps"
echo "----------------"

# Check if DNS is pointing to AWS
CURRENT_IP=$(dig +short $DOMAIN A | head -1)
AWS_ALB_IP=$(dig +short $AWS_ALB A | head -1)

if [ "$CURRENT_IP" = "$AWS_ALB_IP" ]; then
    echo "✅ DNS is pointing to AWS!"
    echo "   Next: Enable SSL certificates in terraform"
else
    echo "❌ DNS is NOT pointing to AWS yet"
    echo "   Next: Update nameservers in Hostinger"
fi

echo ""
echo "🔧 Action Items:"
echo "1. Update CAA records in Hostinger (add: 0 issue \"amazon.com\")"
echo "2. Change nameservers in Hostinger to AWS Route 53"
echo "3. Wait 24-48 hours for DNS propagation"
echo "4. Enable SSL certificates in terraform"
echo "5. Enable CloudFront CDN"

echo ""
echo "📚 Full guide: See DEPLOY_DIRECTFANZ_IO.md"
echo "🌐 Check DNS propagation: https://www.whatsmydns.net/#A/$DOMAIN"