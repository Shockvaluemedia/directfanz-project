#!/bin/bash

echo "=== Immediate SSL Fix ==="

# Force update ALB listener with correct SSL policy
ALB_ARN=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[0].LoadBalancerArn' --output text)
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query 'Listeners[?Port==`443`].ListenerArn' --output text)

# Update SSL policy to fix cipher mismatch
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --ssl-policy ELBSecurityPolicy-TLS-1-2-2017-01

echo "SSL policy updated. Testing in 30 seconds..."
sleep 30
curl -I https://directfanz.io