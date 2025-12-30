# Connecting Hostinger Domain to AWS Infrastructure

## Overview
This guide shows how to connect your Hostinger domain to your AWS infrastructure. Your AWS setup includes ECS, ALB, CloudFront, Route 53, and all the services needed for production.

## Prerequisites
- Domain registered with Hostinger
- AWS infrastructure deployed (ECS, ALB, CloudFront, Route 53)
- Access to Hostinger DNS management
- AWS CLI configured

## Step 1: Get Your AWS Infrastructure Details

First, let's get the details from your deployed AWS infrastructure:

```bash
# Navigate to your terraform directory
cd infrastructure/terraform

# Get the Route 53 name servers and other details
terraform output route53_name_servers
terraform output alb_dns_name
terraform output cloudfront_distribution_domain_name
```

This will show you the AWS name servers you need to configure in Hostinger.

## Step 2: Update Your Domain in AWS Infrastructure

Update your Terraform variables to use your actual domain:

```bash
# Edit infrastructure/terraform/terraform.tfvars or pass as variable
echo 'domain_name = "yourdomain.com"' >> terraform.tfvars

# Apply the changes
terraform plan -var="domain_name=yourdomain.com"
terraform apply -var="domain_name=yourdomain.com"
```

## Step 3: Get AWS Route 53 Name Servers

After deployment, get your Route 53 name servers:

```bash
# Get the name servers from terraform output
terraform output route53_name_servers

# Or check in AWS Console: Route 53 → Hosted Zones → Your Domain
```

You'll get something like:
```
ns-1234.awsdns-12.org
ns-5678.awsdns-56.co.uk  
ns-9012.awsdns-90.com
ns-3456.awsdns-34.net
```

## Step 4: Update Hostinger Name Servers

1. **Log into Hostinger**
2. **Go to Domains → Manage Domain**
3. **Find "Name Servers" or "DNS" section**
4. **Change from Hostinger's name servers to AWS Route 53 name servers**

Replace the existing name servers with your AWS ones:
```
ns-1234.awsdns-12.org
ns-5678.awsdns-56.co.uk  
ns-9012.awsdns-90.com
ns-3456.awsdns-34.net
```

**Important:** Use the exact name servers from your terraform output!

## Step 5: Update Environment Variables

Update your production environment variables to use your domain:

```bash
# Update these in your ECS task definition or parameter store
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Step 6: Deploy Updated Application

```bash
# Build and push new Docker image with updated env vars
docker build -t your-ecr-repo:latest .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker push your-ecr-repo:latest

# Update ECS service to use new image
aws ecs update-service --cluster your-cluster --service your-service --force-new-deployment
```

## Step 7: Verification

### Check DNS Propagation
```bash
# Check if DNS is pointing to AWS
dig yourdomain.com
dig www.yourdomain.com

# Check specific subdomains configured in Route 53
dig api.yourdomain.com
dig cdn.yourdomain.com
dig ws.yourdomain.com
```

### Test Application Endpoints
```bash
# Test main site
curl -I https://yourdomain.com

# Test API health check
curl -I https://yourdomain.com/api/health

# Test CDN
curl -I https://cdn.yourdomain.com

# Test WebSocket endpoint
curl -I https://ws.yourdomain.com
```

### Verify SSL Certificates
```bash
# Check SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Or use online tools like SSL Labs
# https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

## Benefits of AWS Setup
- Full control over DNS routing
- Health checks and failover
- Geographic routing for global users
- Integration with CloudFront CDN
- Advanced monitoring and alerting

## Timeline
- Name server propagation: 24-48 hours
- SSL certificate: Automatic via ACM
- Full functionality: Available after name server propagation

## Rollback Plan
If issues occur, you can quickly switch back to Hostinger name servers to restore the previous setup.