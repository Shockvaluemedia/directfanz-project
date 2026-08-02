# DirectFanz Production Setup Checklist

## 🎯 Complete Production Setup Guide

This checklist will guide you through setting up your production database, configuring environment variables, and deploying DirectFanz.

### ✅ Prerequisites Completed
- [x] AWS infrastructure deployed via Terraform
- [x] RDS PostgreSQL instance created
- [x] ElastiCache Redis cluster created
- [x] S3 buckets configured
- [x] ECS cluster ready

---

## 📋 Step-by-Step Setup

### 1. 🗄️ Set Up Production Database

**Run the database setup script:**
```bash
./scripts/setup-production-database.sh
```

This script will:
- ✅ Connect to your RDS PostgreSQL instance
- ✅ Retrieve database credentials from AWS Secrets Manager
- ✅ Update `.env.production` with the correct DATABASE_URL
- ✅ Run Prisma migrations
- ✅ Test database connectivity

**Expected Output:**
```
[SUCCESS] Found RDS instance: directfanz-production-postgres.xyz.us-east-1.rds.amazonaws.com
[SUCCESS] Database connection successful
[SUCCESS] Database migrations completed
[SUCCESS] 🎉 Production database setup complete!
```

---

### 2. 🔧 Configure Environment Variables

**Edit `.env.production` with your actual values:**

```bash
# Open the production environment file
nano .env.production
```

**Required Updates:**

1. **Authentication & Security:**
   ```env
   NEXTAUTH_SECRET="your-unique-32-character-secret-key"
   NEXTAUTH_URL="https://directfanz.io"
   NEXT_PUBLIC_APP_URL="https://directfanz.io"
   ```

2. **AWS Services:**
   ```env
   AWS_ACCESS_KEY_ID="your-production-access-key"
   AWS_SECRET_ACCESS_KEY="your-production-secret-key"
   AWS_S3_BUCKET_NAME="directfanz-production-content"
   ```

3. **Stripe Live Keys:**
   ```env
   STRIPE_PUBLISHABLE_KEY="pk_live_..."
   STRIPE_SECRET_KEY="sk_live_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

4. **Email Service:**
   ```env
   SENDGRID_API_KEY="SG.your-sendgrid-api-key"
   FROM_EMAIL="noreply@directfanz.io"
   ```

---

### 3. ✅ Validate Configuration

**Run the environment validation script:**
```bash
./scripts/validate-production-env.sh
```

This will check:
- ✅ All required environment variables are set
- ✅ URLs have correct format
- ✅ Stripe keys are live keys (not test)
- ✅ Database URL format is valid

**Expected Output:**
```
🎉 All required environment variables are properly configured!
Your DirectFanz production environment is ready for deployment.
```

---

### 4. 🚀 Deploy to Production

**Option A: Deploy via ECS (Current Setup)**
```bash
./scripts/build-and-deploy-production.sh
```

**Option B: Deploy via Vercel**
```bash
# Set environment variables in Vercel
vercel env add DATABASE_URL production
vercel env add STRIPE_SECRET_KEY production
# ... add all other variables

# Deploy
vercel --prod
```

---

## 🔍 Verification Steps

### Database Connection Test
```bash
# Test database connectivity
npm run db:status

# Verify migrations
npm run db:migrate:status
```

### Application Health Check
```bash
# Test API endpoints
curl https://directfanz.io/api/health

# Test authentication
curl https://directfanz.io/api/auth/session
```

### Payment Integration Test
```bash
# Test Stripe webhook
curl -X POST https://directfanz.io/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_intent.succeeded"}'
```

---

## 🛠️ Troubleshooting

### Database Connection Issues
```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier directfanz-production-postgres

# Test direct connection
psql -h your-rds-endpoint -U postgres -d directfanz
```

### Environment Variable Issues
```bash
# Re-run validation
./scripts/validate-production-env.sh

# Check specific variable
echo $DATABASE_URL
```

### Deployment Issues
```bash
# Check ECS service status
aws ecs describe-services --cluster directfanz-production --services directfanz-app-new

# View application logs
aws logs tail /ecs/directfanz-production --follow
```

---

## 📊 Post-Deployment Monitoring

### Set Up Monitoring
1. **CloudWatch Dashboards** - Monitor RDS, ECS, and application metrics
2. **Sentry Error Tracking** - Configure error monitoring
3. **Stripe Dashboard** - Monitor payment processing
4. **Database Performance** - Monitor query performance and connections

### Health Checks
- Application: `https://directfanz.io/api/health`
- Database: Monitor RDS CloudWatch metrics
- Redis: Monitor ElastiCache metrics
- S3: Monitor bucket access and storage

---

## 🎉 Success Criteria

Your production setup is complete when:

- ✅ Database connection is working
- ✅ All environment variables validated
- ✅ Application deployed and accessible
- ✅ Stripe payments processing
- ✅ File uploads working to S3
- ✅ Email notifications sending
- ✅ Monitoring and logging active

---

## 📞 Support

If you encounter issues:

1. **Check logs:** `aws logs tail /ecs/directfanz-production --follow`
2. **Validate environment:** `./scripts/validate-production-env.sh`
3. **Test database:** `./scripts/setup-production-database.sh`
4. **Review infrastructure:** Check Terraform outputs

**Next Steps:** Once setup is complete, proceed to [DEPLOYMENT_READY.md](./DEPLOYMENT_READY.md) for go-live procedures.