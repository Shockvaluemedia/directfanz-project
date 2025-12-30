#!/bin/bash

# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[0].TargetGroupArn' --output text)

# Update ECS service to use load balancer
aws ecs update-service \
  --cluster directfanz-cluster \
  --service directfanz-app \
  --load-balancers targetGroupArn="$TG_ARN",containerName=directfanz-app,containerPort=80 \
  --region us-east-1

echo "ECS service connected to load balancer"