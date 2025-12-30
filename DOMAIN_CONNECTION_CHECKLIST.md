# Domain Connection Checklist - Hostinger to AWS

## Pre-Connection Checklist

### ✅ AWS Infrastructure Status
- [ ] AWS infrastructure deployed via Terraform
- [ ] Route 53 hosted zone created
- [ ] SSL certificates provisioned (ACM)
- [ ] CloudFront distribution deployed
- [ ] Application Load Balancer configured
- [ ] ECS services running

### ✅ Domain Information
- [ ] Domain name: `_________________`
- [ ] Hostinger account access confirmed
- [ ] Current DNS settings documented (backup)

## Step-by-Step Connection Process

### Step 1: Get AWS Information
```bash
# Run this script to get all necessary AWS details
./scripts/get-aws-domain-info.sh
```

**Record these values:**
- Route 53 Name Servers: `_________________`
- ALB DNS Name: `_________________`
- CloudFront Domain: `_________________`

### Step 2: Update Terraform Configuration
- [ ] Update `domain_name` variable in terraform.tfvars
- [ ] Run `terraform plan` to verify changes
- [ ] Run `terraform apply` to update infrastructure
- [ ] Verify SSL certificate is requested for your domain

### Step 3: Configure Hostinger DNS
- [ ] Log into Hostinger control panel
- [ ] Navigate to Domain Management
- [ ] Locate DNS/Name Server settings
- [ ] **BACKUP current name servers** (for rollback)
- [ ] Replace with AWS Route 53 name servers
- [ ] Save changes

### Step 4: Update Application Configuration
- [ ] Update environment variables:
  - `NEXTAUTH_URL=https://yourdomain.com`
  - `NEXT_PUBLIC_APP_URL=https://yourdomain.com`
- [ ] Update any hardcoded URLs in code
- [ ] Rebuild and deploy application

### Step 5: Verification (Wait 2-24 hours for DNS propagation)

#### DNS Verification
```bash
# Check DNS propagation
dig yourdomain.com
dig www.yourdomain.com
nslookup yourdomain.com 8.8.8.8
```
- [ ] Root domain resolves to AWS
- [ ] WWW subdomain resolves to AWS
- [ ] DNS propagation complete globally

#### SSL Certificate Verification
```bash
# Check SSL certificate
curl -I https://yourdomain.com
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```
- [ ] SSL certificate valid and trusted
- [ ] Certificate matches your domain
- [ ] No certificate warnings

#### Application Verification
```bash
# Test main endpoints
curl -I https://yourdomain.com
curl -I https://yourdomain.com/api/health
curl -I https://api.yourdomain.com/api/health
```
- [ ] Main site loads (200 OK)
- [ ] API endpoints respond
- [ ] Authentication works
- [ ] File uploads work
- [ ] Database connections work

#### Subdomain Verification
Test all configured subdomains:
- [ ] `https://www.yourdomain.com` - Main site
- [ ] `https://api.yourdomain.com` - API endpoints
- [ ] `https://cdn.yourdomain.com` - CDN content
- [ ] `https://ws.yourdomain.com` - WebSocket connections
- [ ] `https://stream.yourdomain.com` - Streaming services
- [ ] `https://admin.yourdomain.com` - Admin panel

## Troubleshooting Guide

### Issue: DNS Not Propagating
**Symptoms:** Domain still points to old servers after 24 hours
**Solutions:**
- Verify name servers are correctly set in Hostinger
- Check DNS propagation: https://www.whatsmydns.net/
- Clear local DNS cache: `sudo dscacheutil -flushcache` (macOS)
- Try different DNS servers: `nslookup yourdomain.com 1.1.1.1`

### Issue: SSL Certificate Errors
**Symptoms:** "Certificate not trusted" or "Certificate mismatch"
**Solutions:**
- Wait for ACM certificate validation (can take up to 72 hours)
- Verify domain ownership in ACM console
- Check Route 53 has CNAME records for certificate validation
- Ensure CloudFront is using the correct certificate

### Issue: Application Not Loading
**Symptoms:** 502/503 errors or timeouts
**Solutions:**
- Check ECS service health in AWS console
- Verify target group health checks
- Check application logs in CloudWatch
- Ensure environment variables are updated
- Verify security group rules allow traffic

### Issue: API Endpoints Not Working
**Symptoms:** 404 errors on API calls
**Solutions:**
- Check ALB listener rules
- Verify target group routing
- Check application routing configuration
- Ensure CORS settings allow your domain

## Rollback Plan

If issues occur, you can quickly rollback:

### Emergency Rollback (5 minutes)
1. Log into Hostinger
2. Change name servers back to original Hostinger servers
3. Wait 15-30 minutes for DNS to propagate back
4. Your site should be accessible again

### Planned Rollback
1. Document all issues encountered
2. Revert name servers in Hostinger
3. Fix AWS infrastructure issues
4. Test on AWS subdomain before switching again
5. Retry domain connection when ready

## Post-Connection Tasks

### Immediate (First 24 hours)
- [ ] Monitor error rates in CloudWatch
- [ ] Test all critical user flows
- [ ] Verify email delivery works
- [ ] Check payment processing
- [ ] Monitor performance metrics

### First Week
- [ ] Set up monitoring alerts
- [ ] Configure backup procedures
- [ ] Test disaster recovery procedures
- [ ] Optimize performance based on real traffic
- [ ] Update documentation

### First Month
- [ ] Review cost optimization opportunities
- [ ] Analyze traffic patterns
- [ ] Plan scaling strategies
- [ ] Update security configurations
- [ ] Conduct security audit

## Success Criteria

Your domain connection is successful when:
- ✅ Domain resolves to AWS infrastructure globally
- ✅ SSL certificate is valid and trusted
- ✅ All application features work correctly
- ✅ Performance meets expectations
- ✅ No increase in error rates
- ✅ All subdomains function properly
- ✅ Monitoring and alerts are working

## Support Resources

### AWS Documentation
- [Route 53 DNS Management](https://docs.aws.amazon.com/route53/)
- [ACM Certificate Management](https://docs.aws.amazon.com/acm/)
- [CloudFront Distribution](https://docs.aws.amazon.com/cloudfront/)

### Tools
- DNS Propagation Checker: https://www.whatsmydns.net/
- SSL Certificate Checker: https://www.ssllabs.com/ssltest/
- Website Speed Test: https://pagespeed.web.dev/

### Emergency Contacts
- AWS Support: (if you have a support plan)
- Hostinger Support: For DNS-related issues
- Your development team: For application issues

---

**Remember:** DNS changes can take 24-48 hours to propagate globally. Be patient and don't panic if things don't work immediately after changing name servers.