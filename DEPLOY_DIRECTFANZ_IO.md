# Deploy directfanz.io to AWS - Step by Step Guide

## Current Status ✅
Your AWS infrastructure is deployed and ready! Here's what's already set up:

- **Route 53 Hosted Zone**: directfanz.io
- **Application Load Balancer**: directfanz-alb-v2-9638983.us-east-1.elb.amazonaws.com
- **ECS Cluster**: directfanz-cluster-v2 (running your application)
- **RDS Database**: PostgreSQL instance configured
- **ElastiCache Redis**: Session storage ready
- **S3 Buckets**: Content and static assets storage
- **ECR Repository**: Docker images ready to deploy

## What You Need to Do Now

### Step 1: Fix CAA Records in Hostinger (CRITICAL)

Your domain has CAA records that prevent AWS from issuing SSL certificates. You need to add AWS to the allowed list.

**In Hostinger DNS Management:**
1. Log into your Hostinger account
2. Go to **Domains → Manage Domain → DNS Zone**
3. **Add this CAA record:**
   ```
   Type: CAA
   Name: @ (or leave blank for root domain)
   Value: 0 issue "amazon.com"
   TTL: 3600
   ```

**Alternative:** If you can't add CAA records, delete ALL existing CAA records (less secure but will work).

### Step 2: Change Name Servers to AWS Route 53

**Your AWS Route 53 Name Servers:**
```
ns-128.awsdns-16.com
ns-1490.awsdns-58.org
ns-1928.awsdns-49.co.uk
ns-863.awsdns-43.net
```

**In Hostinger:**
1. Go to **Domains → Manage Domain**
2. Find **Name Servers** section
3. **BACKUP current name servers first** (for rollback if needed)
4. Change from Hostinger name servers to the AWS ones above
5. Save changes

### Step 3: Wait for DNS Propagation (24-48 hours)

You can check propagation status:
```bash
# Check if DNS is pointing to AWS
dig directfanz.io
dig www.directfanz.io

# Check globally
# Visit: https://www.whatsmydns.net/#A/directfanz.io
```

### Step 4: Enable SSL Certificates (After DNS propagation)

Once DNS is pointing to AWS and CAA records allow AWS, run:

```bash
cd infrastructure/terraform

# Uncomment SSL certificate resources
# Edit acm.tf and remove the /* */ comment blocks

# Apply changes
terraform plan -var="domain_name=directfanz.io"
terraform apply -var="domain_name=directfanz.io"
```

### Step 5: Enable HTTPS and CloudFront (After SSL is ready)

```bash
# Uncomment HTTPS listeners in alb.tf
# Uncomment CloudFront distribution in cloudfront.tf
terraform apply -var="domain_name=directfanz.io"
```

## Current URLs (HTTP only, temporary)

While waiting for SSL certificates:
- **Main Site**: http://directfanz-alb-v2-9638983.us-east-1.elb.amazonaws.com
- **API Health Check**: http://directfanz-alb-v2-9638983.us-east-1.elb.amazonaws.com/api/health

## Final URLs (After SSL setup)

Once everything is configured:
- **Main Site**: https://directfanz.io
- **WWW**: https://www.directfanz.io  
- **API**: https://api.directfanz.io
- **CDN**: https://cdn.directfanz.io

## Verification Commands

After each step, verify progress:

```bash
# Check DNS propagation
dig directfanz.io
nslookup directfanz.io 8.8.8.8

# Check SSL certificate (after Step 4)
curl -I https://directfanz.io
openssl s_client -connect directfanz.io:443

# Test application
curl -I https://directfanz.io/api/health
```

## Rollback Plan

If anything goes wrong:
1. **Emergency**: Change name servers back to Hostinger in their control panel
2. **Wait 15-30 minutes** for DNS to revert
3. Your site will be accessible again on the old setup
4. Fix issues and retry

## Need Help?

- **DNS Issues**: Check https://www.whatsmydns.net/#A/directfanz.io
- **SSL Issues**: Verify CAA records allow "amazon.com"
- **Application Issues**: Check ECS service health in AWS Console

## Timeline

- **CAA Record Update**: Immediate
- **Name Server Change**: Immediate  
- **DNS Propagation**: 24-48 hours
- **SSL Certificate**: Automatic after DNS propagation
- **Full HTTPS**: Available after SSL certificates

Your AWS infrastructure is ready - you just need to point your domain to it! 🚀