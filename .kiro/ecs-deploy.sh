#!/bin/bash

# Create ECS cluster
aws ecs create-cluster --cluster-name directfanz-cluster --region us-east-1

# Create task definition
aws ecs register-task-definition \
  --family directfanz-app \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 256 \
  --memory 512 \
  --execution-role-arn arn:aws:iam::545582548240:role/ecsTaskExecutionRole \
  --container-definitions '[{
    "name": "directfanz-app",
    "image": "nginx:latest",
    "portMappings": [{"containerPort": 80, "protocol": "tcp"}],
    "essential": true,
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/directfanz-app",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]' \
  --region us-east-1

# Get subnet and security group
SUBNET=$(aws ec2 describe-subnets --region us-east-1 --query 'Subnets[0].SubnetId' --output text)
SG=$(aws ec2 describe-security-groups --region us-east-1 --query 'SecurityGroups[0].GroupId' --output text)

# Create service
aws ecs create-service \
  --cluster directfanz-cluster \
  --service-name directfanz-app \
  --task-definition directfanz-app \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --region us-east-1

echo "ECS service created"