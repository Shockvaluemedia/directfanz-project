#!/bin/bash

# Create ECS task execution role
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}' --region us-east-1

# Attach AWS managed policy
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy --region us-east-1

# Force new deployment
aws ecs update-service --cluster directfanz-cluster --service directfanz-app --force-new-deployment --region us-east-1

echo "ECS role created and service redeployed"