#!/bin/bash

# Create log group
aws logs create-log-group --log-group-name /ecs/directfanz-app --region us-east-1

# Force new deployment
aws ecs update-service --cluster directfanz-cluster --service directfanz-app --force-new-deployment --region us-east-1

echo "Log group created, forcing new deployment"