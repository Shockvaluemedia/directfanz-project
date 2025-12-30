# DirectFanz Production Deployment Checklist

## Pre-Deployment Requirements

- [ ] AWS CLI installed and configured
- [ ] Terraform installed (v1.0+)
- [ ] Docker installed and running
- [ ] Domain `directfanz.io` registered with Hostinger
- [ ] Production Stripe account set up
- [ ] SendGrid account for email notifications
- [ ] AWS account with appropriate permissions

## Quick Deployment (Automated)

Run the automated deployment script:

```bash
./deploy-production.sh
```

This script will:
1. ✅ Check prerequisites
2. ✅ Set up Terraform configuration
3. ✅ Deploy AWS infrastructure
4. ✅ Show DNS configuration instructions
5. ✅ Build and push Docker image
6. ✅ Set up environment variables
7. ✅ Deploy application to ECS
8. ✅ Guide through database migrations
9. ✅ Verify deployment

## Manual Steps Required

### 1. DNS Configuration (Critical)
- [ ] Log into Hostinger control panel
- [ ] Update name servers to Route 53 name servers (provided by script)
- [ ] Wait 24-48 hours for DNS propagation

### 2. Database Setup
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Seed initial data: `npm run db:seed`

### 3. SSL Certificate Verification
- [ ] Check certificate status in AWS Certificate Manager
- [ ] Verify HTTPS is working: `curl -I https://directfanz.io`

## Post-Deployment Verification

### Health Checks
- [ ] Main site: https://directfanz.io
- [ ] API endpoint: https://api.directfanz.io/api/health
- [ ] WebSocket: https://ws.directfanz.io/health
- [ ] CDN: https://cdn.directfanz.io

### Functionality Tests
- [ ] User registration and login
- [ ] Payment processing (Stripe)
- [ ] File uploads (S3)
- [ ] Real-time features (WebSocket)
- [ ] Email notifications

### Monitoring Setup
- [ ] CloudWatch dashboards active
- [ ] SNS alerts configured
- [ ] Cost monitoring enabled
- [ ] Performance metrics tracking

## Troubleshooting

### Common Issues
1. **DNS not resolving**: Wait for propagation, check Hostinger settings
2. **SSL pending**: Ensure DNS propagated before certificate validation
3. **ECS tasks failing**: Check CloudWatch logs and environment variables
4. **Database connection**: Verify security groups and credentials

### Quick Fixes
```bash
# Check ECS service status
aws ecs describe-services --cluster directfanz-cluster --services directfanz-web-app

# View ECS logs
aws logs tail /ecs/directfanz-web-app --follow

# Restart ECS service
aws ecs update-service --cluster directfanz-cluster --service directfanz-web-app --force-new-deployment
```

## Rollback Plan

If issues occur:
```bash
# Rollback ECS service
aws ecs update-service --cluster directfanz-cluster --service directfanz-web-app --task-definition PREVIOUS_ARN

# Rollback infrastructure (if needed)
cd infrastructure/terraform
terraform apply -target=SPECIFIC_RESOURCE
```

## Success Criteria

- [ ] All health checks passing
- [ ] DNS resolving correctly
- [ ] SSL certificates active
- [ ] Payment processing working
- [ ] File uploads working
- [ ] Real-time features working
- [ ] Monitoring and alerts active
- [ ] Performance within targets

## Estimated Timeline

- **Infrastructure deployment**: 30-45 minutes
- **Application deployment**: 15-30 minutes
- **DNS propagation**: 24-48 hours
- **Total active time**: 1-2 hours
- **Total time to live**: 24-48 hours

## Support Contacts

- AWS Support: For infrastructure issues
- Stripe Support: For payment processing
- SendGrid Support: For email delivery
- Hostinger Support: For DNS issues

---

**Ready to deploy?** Run `./deploy-production.sh` to start!