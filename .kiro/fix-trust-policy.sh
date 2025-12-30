#!/bin/bash

# Update trust policy for ECS task execution role
aws iam update-assume-role-policy --role-name ecsTaskExecutionRole --policy-document '{
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

# Force new deployment
aws ecs update-service --cluster directfanz-cluster --service directfanz-app --force-new-deployment --region us-east-1

echo "Trust policy fixed, redeploying"