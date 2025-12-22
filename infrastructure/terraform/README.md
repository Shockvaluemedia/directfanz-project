# DirectFanz AWS Infrastructure

This directory contains Terraform configurations for deploying the DirectFanz platform on AWS.

## Architecture Overview

The infrastructure includes:

- **VPC**: Multi-tier network with public, private, and database subnets
- **ECS Fargate**: Container orchestration for web app and WebSocket services
- **RDS PostgreSQL**: Multi-AZ database with read replicas
- **ElastiCache Redis**: Cluster mode for caching and sessions
- **Application Load Balancer**: Traffic distribution with SSL termination
- **S3**: Content storage with intelligent tiering
- **CloudFront**: Global CDN for content delivery
- **Route 53**: DNS management with health checks
- **CloudTrail**: Audit logging for compliance
- **CloudWatch**: Monitoring, logging, and alerting
- **KMS**: Encryption key management
- **IAM**: Least-privilege access control
- **VPC Endpoints**: Private connectivity to AWS services

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **Domain name** registered and ready for DNS management
4. **S3 bucket** for Terraform state storage (update backend configuration)

## Quick Start

1. **Clone and navigate to the infrastructure directory:**
   ```bash
   cd infrastructure/terraform
   ```

2. **Copy and customize variables:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your specific values
   ```

3. **Update backend configuration in main.tf:**
   ```hcl
   backend "s3" {
     bucket = "your-terraform-state-bucket"
     key    = "prod/terraform.tfstate"
     region = "us-east-1"
     
     dynamodb_table = "your-terraform-state-lock"
     encrypt        = true
   }
   ```

4. **Initialize Terraform:**
   ```bash
   terraform init
   ```

5. **Plan the deployment:**
   ```bash
   terraform plan
   ```

6. **Apply the configuration:**
   ```bash
   terraform apply
   ```

## File Structure

- `main.tf` - Core infrastructure (VPC, RDS, ElastiCache, S3)
- `security-groups.tf` - Security group configurations
- `iam-enhanced.tf` - IAM roles and policies
- `kms-encryption.tf` - KMS keys for encryption
- `cloudtrail-audit.tf` - CloudTrail audit logging
- `vpc-endpoints.tf` - VPC endpoints for AWS services
- `load-balancer.tf` - Application Load Balancer configuration
- `route53-dns.tf` - DNS management with Route 53
- `sns-notifications.tf` - SNS topics and CloudWatch dashboard
- `codepipeline-s3.tf` - S3 bucket for CI/CD artifacts
- `variables.tf` - Input variables
- `outputs.tf` - Output values

## Important Configuration Notes

### Domain Setup
- Update `domain_name` in terraform.tfvars
- Ensure you have access to update DNS records for certificate validation
- Route 53 will become the authoritative DNS for your domain

### Database Configuration
- Default configuration uses `db.r6g.large` for production
- Adjust `db_instance_class` based on your performance needs
- Multi-AZ is enabled for high availability

### Redis Configuration
- Cluster mode is enabled with 3 shards by default
- Encryption at rest and in transit is enabled
- Auth token is automatically generated

### Security
- All data is encrypted at rest using KMS
- VPC endpoints reduce internet traffic
- Security groups follow least-privilege principles
- CloudTrail logs all API calls

### Monitoring
- CloudWatch dashboard is automatically created
- SNS topics are set up for alerts
- Health checks monitor application availability

## Post-Deployment Steps

1. **Update DNS**: Point your domain's nameservers to Route 53
2. **Configure SNS**: Add email subscriptions to SNS topics for alerts
3. **Verify SSL**: Ensure SSL certificate is validated and active
4. **Test connectivity**: Verify all services are accessible

## Outputs

After successful deployment, Terraform will output:

- VPC and subnet IDs
- Database and Redis endpoints
- Load balancer DNS name
- Route 53 zone information
- KMS key IDs
- Security group IDs

## Cleanup

To destroy the infrastructure:

```bash
terraform destroy
```

**Warning**: This will permanently delete all resources. Ensure you have backups of any important data.

## Support

For issues or questions:
1. Check AWS CloudWatch logs for application errors
2. Review CloudTrail logs for API call issues
3. Verify security group and IAM permissions
4. Check Route 53 health checks for connectivity issues

## Security Considerations

- All S3 buckets have public access blocked
- Database and Redis are in private subnets
- VPC endpoints reduce internet exposure
- KMS encryption is used throughout
- CloudTrail provides audit logging
- Security groups implement least-privilege access