#!/bin/bash

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[0].DNSName' --output text)

# Get hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones --query 'HostedZones[?Name==`directfanz.io.`].Id' --output text | cut -d'/' -f3)

# Update A record to point to ALB
aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "directfanz.io",
      "Type": "A",
      "AliasTarget": {
        "DNSName": "'$ALB_DNS'",
        "EvaluateTargetHealth": false,
        "HostedZoneId": "Z35SXDOTRQ7X7K"
      }
    }
  }]
}'

echo "DNS updated to point to AWS ALB: $ALB_DNS"