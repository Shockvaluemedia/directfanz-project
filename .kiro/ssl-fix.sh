#!/bin/bash

# Get certificate ARN for directfanz.io
CERT_ARN=$(aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?contains(DomainName, `directfanz.io`)].CertificateArn' --output text | head -1)

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName, `directfanz`)].LoadBalancerArn' --output text)

# Get HTTPS listener ARN
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --region us-east-1 --query 'Listeners[?Port==`443`].ListenerArn' --output text)

# Update listener with correct certificate
aws elbv2 modify-listener --listener-arn $LISTENER_ARN --certificates CertificateArn=$CERT_ARN --region us-east-1

echo "SSL certificate updated. Wait 2-3 minutes for propagation."