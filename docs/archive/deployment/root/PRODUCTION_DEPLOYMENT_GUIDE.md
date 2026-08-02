# DirectFanz Production Deployment Guide

## Prerequisites

Before starting, ensure you have:
- AWS CLI configured with appropriate permissions
- Terraform installed (v1.0+)
- Docker installed
- Domain `directfanz.io` registered with Hostinger
- Production environment variables ready

## Phase 1: AWS Infrastructure Setup

### Step 1: Configure Terraform Variables

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your production values:

```hcl
# Required Configuration
project_name = "directfanz"
environment  = "prod"
aws_region   = "us-east-1"
domain_name  = "directfanz.io"

# Alert Configuration
alert_email = "your-email@example.com"

# Database Configuration
db_instance_class = "db.r6g.large"
db_allocated_storage = 100
db_name = "directfanz"
db_username = "postgres"

# Redis Configuration
redis_node_type = "cache.r6g.large"
redis_num_cache_nodes = 3
```

### Step 2: Initialize and Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Deploy infrastructure
terraform apply
```

**Important**: Save the Terraform outputs, especially:
- Route 53 name servers
- Load balancer DNS name
- Database connection details

### Step 3: Extract Route 53 Name Servers

```bash
# Get name servers from Terraform output
terraform output route53_name_servers
```

## Phase 2: Domain Configuration

### Step 4: Update Hostinger DNS Settings

1. Log into your Hostinger control panel
2. Navigate to DNS/Name Servers section
3. Change name servers to the Route 53 name servers from Step 3:
   ```
   ns-xxx.awsdns-xx.com
   ns-xxx.awsdns-xx.co.uk
   ns-xxx.awsdns-xx.net
   ns-xxx.awsdns-xx.org
   ```
4. Save changes

### Step 5: Verify DNS Propagation

```bash
# Check DNS propagation (may take 24-48 hours)
dig directfanz.io NS
dig www.directfanz.io A
dig api.directfanz.io A

# Use online tools for global propagation check
# https://www.whatsmydns.net/
```

## Phase 3: Application Deployment

### Step 6: Set Up Production Environment Variables

Create `.env.production`:

```env
# Database
DATABASE_URL="postgresql://postgres:PASSWORD@RDS_ENDPOINT:5432/directfanz"

# Redis
REDIS_URL="redis://REDIS_ENDPOINT:6379"

# NextAuth.js
NEXTAUTH_SECRET="your-production-secret-key"
NEXTAUTH_URL="https://directfanz.io"

# Stripe Production Keys
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# AWS S3
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="directfanz-content-prod"

# Email
SENDGRID_API_KEY="SG...."
FROM_EMAIL="noreply@directfanz.io"

# App Configuration
NEXT_PUBLIC_APP_URL="https://directfanz.io"
```

### Step 7: Build and Push Docker Images

```bash
# Build production image
docker build -t directfanz-app:latest .

# Tag for ECR
docker tag directfanz-app:latest YOUR_ECR_URI:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_URI
docker push YOUR_ECR_URI:latest
```

### Step 8: Deploy ECS Services

```bash
# Update ECS service with new image
aws ecs update-service \
  --cluster directfanz-cluster \
  --service directfanz-web-app \
  --force-new-deployment
```

## Phase 4: SSL Certificate Setup

### Step 9: Request SSL Certificate

The Terraform configuration automatically requests a wildcard SSL certificate for `*.directfanz.io`. Verify it's issued:

```bash
# Check certificate status
aws acm list-certificates --region us-east-1
```

### Step 10: Update Load Balancer

The load balancer should automatically use the SSL certificate. Verify HTTPS is working:

```bash
curl -I https://directfanz.io
curl -I https://api.directfanz.io
```

## Phase 5: Database Setup

### Step 11: Run Database Migrations

```bash
# Connect to ECS task or run locally with production DATABASE_URL
npm run db:migrate
npm run db:seed
```

## Phase 6: Verification and Testing

### Step 12: Health Checks

```bash
# Test all endpoints
curl https://directfanz.io/api/health
curl https://api.directfanz.io/api/health
curl https://ws.directfanz.io/health
```

### Step 13: Functional Testing

1. **User Registration**: Test signup flow
2. **Authentication**: Test login/logout
3. **Payment Processing**: Test Stripe integration
4. **File Uploads**: Test S3 integration
5. **Real-time Features**: Test WebSocket connections

## Phase 7: Monitoring Setup

### Step 14: Configure Monitoring

```bash
# Check CloudWatch dashboards
aws cloudwatch list-dashboards

# Verify SNS topics for alerts
aws sns list-topics
```

### Step 15: Set Up Alerts

Update alert email in Terraform variables and redeploy:

```hcl
alert_email = "admin@directfanz.io"
```

## Phase 8: Performance Optimization

### Step 16: CDN Configuration

Verify CloudFront distribution is working:

```bash
curl -I https://cdn.directfanz.io
```

### Step 17: Cache Warming

The infrastructure includes automatic cache warming. Monitor cache hit rates in CloudWatch.

## Troubleshooting

### Common Issues

1. **DNS Not Resolving**
   - Wait 24-48 hours for full propagation
   - Check name servers are correctly set in Hostinger

2. **SSL Certificate Pending**
   - Ensure DNS is propagated before certificate validation
   - Check Route 53 validation records

3. **ECS Tasks Failing**
   - Check CloudWatch logs
   - Verify environment variables
   - Check database connectivity

4. **Database Connection Issues**
   - Verify security groups allow connections
   - Check database endpoint and credentials

### Rollback Procedure

If issues occur:

```bash
# Rollback ECS service
aws ecs update-service \
  --cluster directfanz-cluster \
  --service directfanz-web-app \
  --task-definition PREVIOUS_TASK_DEFINITION_ARN

# Rollback infrastructure (if needed)
terraform apply -target=SPECIFIC_RESOURCE
```

## Post-Deployment Checklist

- [ ] DNS resolving correctly
- [ ] SSL certificates active
- [ ] All health checks passing
- [ ] Database migrations completed
- [ ] Monitoring and alerts configured
- [ ] CDN cache hit rates optimal
- [ ] Payment processing working
- [ ] File uploads working
- [ ] WebSocket connections stable
- [ ] Performance metrics within targets

## Maintenance

### Regular Tasks

1. **Weekly**: Review CloudWatch metrics and costs
2. **Monthly**: Update dependencies and security patches
3. **Quarterly**: Review and optimize infrastructure costs

### Backup Verification

```bash
# Check RDS automated backups
aws rds describe-db-snapshots --db-instance-identifier directfanz-db

# Check S3 cross-region replication
aws s3api get-bucket-replication --bucket directfanz-content-prod
```

## Support

For issues during deployment:
1. Check CloudWatch logs first
2. Review Terraform state for infrastructure issues
3. Use AWS Support for service-specific problems

---

**Estimated Deployment Time**: 2-4 hours (excluding DNS propagation)
**DNS Propagation Time**: 24-48 hours