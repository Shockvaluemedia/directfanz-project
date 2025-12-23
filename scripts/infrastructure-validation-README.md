# Infrastructure Validation Checkpoint

This directory contains scripts for validating AWS infrastructure deployment as part of the DirectFanz platform AWS conversion project.

## Overview

The infrastructure validation checkpoint (Task 6 in the AWS conversion plan) ensures that all AWS infrastructure components are deployed correctly and functioning as expected before proceeding to the next phase of the migration.

## Scripts

### 1. Master Checkpoint Script
- **File**: `run-infrastructure-checkpoint.js`
- **Purpose**: Orchestrates all validation tests
- **Usage**: `npm run infrastructure:checkpoint`

### 2. Infrastructure Validation
- **File**: `infrastructure-validation.js`
- **Purpose**: Validates AWS infrastructure components
- **Usage**: `npm run infrastructure:validate`

### 3. Network Connectivity Test
- **File**: `network-connectivity-test.js`
- **Purpose**: Tests network connectivity and security groups
- **Usage**: `npm run infrastructure:test-network`

### 4. Services Functionality Test
- **File**: `aws-services-functionality-test.js`
- **Purpose**: Tests basic functionality of AWS services
- **Usage**: `npm run infrastructure:test-services`

## Prerequisites

### 1. AWS Configuration
Ensure AWS CLI is configured with appropriate credentials:
```bash
aws configure
# or
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

### 2. Environment Variables
Set the following environment variables:
```bash
export AWS_REGION=us-east-1              # Required
export PROJECT_NAME=direct-fan-platform  # Optional (default: direct-fan-platform)
export ENVIRONMENT=prod                   # Optional (default: prod)
```

### 3. Dependencies
Install required Node.js dependencies:
```bash
npm install aws-sdk
```

## Running the Checkpoint

### Quick Start
Run the complete infrastructure validation checkpoint:
```bash
npm run infrastructure:checkpoint
```

### Individual Tests
Run specific validation tests:
```bash
# Infrastructure component validation
npm run infrastructure:validate

# Network connectivity testing
npm run infrastructure:test-network

# AWS services functionality testing
npm run infrastructure:test-services
```

## What Gets Validated

### Infrastructure Components
- ✅ VPC and networking (subnets, NAT gateways, internet gateway)
- ✅ Security groups and rules
- ✅ RDS PostgreSQL database (Multi-AZ, encryption, backups)
- ✅ ElastiCache Redis cluster (encryption, auth tokens)
- ✅ S3 storage buckets (versioning, encryption, public access)
- ✅ ECS Fargate services and clusters
- ✅ Application Load Balancer and target groups
- ✅ CloudWatch monitoring and log groups
- ✅ IAM roles and policies
- ✅ Systems Manager parameters

### Network Connectivity
- ✅ VPC connectivity and routing
- ✅ Database port accessibility (5432)
- ✅ Redis port accessibility (6379)
- ✅ Internet connectivity to AWS services
- ✅ Security group rule validation

### Service Functionality
- ✅ S3 upload/download operations
- ✅ RDS database status and configuration
- ✅ ElastiCache Redis cluster health
- ✅ ECS service health and task status
- ✅ CloudWatch metrics and logging
- ✅ SSM parameter operations

## Output and Reporting

### Console Output
All scripts provide real-time console output with:
- ✅ Success indicators
- ⚠️ Warning messages
- ❌ Error messages
- 📋 Informational messages

### Detailed Reports
The master checkpoint script generates detailed JSON reports saved to:
```
logs/infrastructure-checkpoint-{timestamp}.json
```

### Exit Codes
- `0`: All validations passed
- `1`: One or more validations failed

## Troubleshooting

### Common Issues

#### AWS Credentials Not Configured
```
Error: AWS credentials not configured or AWS CLI not available
Solution: Run 'aws configure' or set AWS environment variables
```

#### VPC Not Found
```
Error: VPC not found
Solution: Ensure Terraform infrastructure has been deployed
```

#### Security Group Issues
```
Error: Port not reachable - security group or network ACL issues
Solution: Check security group rules and network ACLs
```

#### Service Not Available
```
Error: Service not available (status: creating)
Solution: Wait for services to finish provisioning
```

### Debug Mode
For detailed debugging, run individual scripts directly:
```bash
node scripts/infrastructure-validation.js
node scripts/network-connectivity-test.js
node scripts/aws-services-functionality-test.js
```

## Integration with CI/CD

### GitHub Actions
Add to your workflow:
```yaml
- name: Infrastructure Validation Checkpoint
  run: npm run infrastructure:checkpoint
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: us-east-1
```

### Local Development
Add to your deployment scripts:
```bash
#!/bin/bash
set -e

echo "Deploying infrastructure..."
terraform apply -auto-approve

echo "Running infrastructure validation checkpoint..."
npm run infrastructure:checkpoint

echo "Infrastructure validation passed! Proceeding to next phase..."
```

## Customization

### Adding New Validations
To add new validation checks:

1. Add validation method to appropriate script
2. Add method to the `runAllValidations()` function
3. Update documentation

### Modifying Thresholds
Adjust validation thresholds by modifying constants in the scripts:
- Connection timeouts
- Health check requirements
- Performance thresholds

## Support

For issues with infrastructure validation:
1. Check the detailed logs in the `logs/` directory
2. Verify AWS credentials and permissions
3. Ensure all Terraform resources are deployed
4. Check AWS service status in the console

## Related Documentation

- [AWS Conversion Design Document](../.kiro/specs/aws-conversion/design.md)
- [AWS Conversion Requirements](../.kiro/specs/aws-conversion/requirements.md)
- [AWS Conversion Tasks](../.kiro/specs/aws-conversion/tasks.md)
- [Terraform Infrastructure](../infrastructure/terraform/README.md)