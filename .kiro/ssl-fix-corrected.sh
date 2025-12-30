#!/bin/bash

# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[0].TargetGroupArn' --output text)

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[0].CertificateArn' --output text)

# Create HTTPS listener with default action
aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn="$CERT_ARN" \
  --ssl-policy ELBSecurityPolicy-TLS-1-2-2017-01 \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN" \
  --region us-east-1

echo "HTTPS listener created with certificate"