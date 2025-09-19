# 🚀 Vercel Deployment Guide for Direct Fan Platform

## Overview

This guide walks you through deploying your Direct Fan Platform to Vercel with
proper environment variable configuration.

## Prerequisites

- GitHub repository with your code
- Vercel account (free tier available)
- All external services configured (Database, S3, Stripe, etc.)

## Step 1: Prepare Your Repository

### 1.1 Ensure Clean Build

```bash
# Test build locally first
npm run build

# If build fails, fix any TypeScript or build errors
npm run type-check
```

### 1.2 Environment Variables

Make sure you have:

- `.env.example` with all required variables documented
- Production values ready for all environment variables
- Secrets generated using the deployment script

## Step 2: Deploy to Vercel

### Method 1: GitHub Integration (Recommended)

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js framework

2. **Configure Build Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: Leave empty (auto-detected)
   - Install Command: `npm ci`

3. **Add Environment Variables** Click "Environment Variables" and add all
   variables from `.env.example`:

   **Required Variables:**

   ```
   DATABASE_URL = your_postgresql_connection_string
   NEXTAUTH_SECRET = your_generated_secret
   NEXTAUTH_URL = https://your-domain.vercel.app

   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
   STRIPE_SECRET_KEY = sk_live_...
   STRIPE_WEBHOOK_SECRET = whsec_...

   AWS_ACCESS_KEY_ID = AKIA...
   AWS_SECRET_ACCESS_KEY = your_secret_key
   AWS_S3_BUCKET_NAME = your-bucket-name
   AWS_REGION = us-east-1

   SENDGRID_API_KEY = SG.your_key
   SENDGRID_FROM_EMAIL = noreply@yourdomain.com

   REDIS_URL = redis://...
   SENTRY_DSN = https://...
   ENCRYPTION_KEY = your_hex_key
   JWT_SECRET = your_jwt_secret
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application
   - You'll get a deployment URL

### Method 2: Vercel CLI

1. **Install Vercel CLI**

   ```bash
   npm install -g vercel
   ```

2. **Login and Deploy**

   ```bash
   # Login to Vercel
   vercel login

   # Deploy (follow prompts)
   vercel --prod
   ```

3. **Set Environment Variables via CLI**

   ```bash
   # Add environment variables one by one
   vercel env add DATABASE_URL production
   vercel env add NEXTAUTH_SECRET production
   # ... continue for all variables

   # Or import from file
   vercel env pull .env.production
   ```

## Step 3: Configure Production Domain

### 3.1 Add Custom Domain

1. In Vercel dashboard, go to your project
2. Go to "Settings" → "Domains"
3. Click "Add Domain"
4. Enter your domain (e.g., `yourdomain.com`)

### 3.2 Configure DNS

Add these DNS records with your domain provider:

**For Apex Domain (yourdomain.com):**

```
Type: A
Name: @
Value: 76.76.19.61
```

**For www Subdomain:**

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 3.3 Update Environment Variables

After adding your domain, update:

```
NEXTAUTH_URL = https://yourdomain.com
```

## Step 4: Database Migrations

### 4.1 Run Migrations

After deployment, you need to run database migrations:

```bash
# Set your production DATABASE_URL locally
export DATABASE_URL="your_production_database_url"

# Run migrations
npx prisma migrate deploy

# Optional: Seed with initial data
npx prisma db seed
```

### 4.2 Alternative: Use Vercel CLI

```bash
# Connect to your deployment
vercel link

# Run migration command on Vercel
vercel exec -- npx prisma migrate deploy
```

## Step 5: Configure Webhooks

### 5.1 Update Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Update endpoint URL to: `https://yourdomain.com/api/webhooks/stripe`
3. Test webhook delivery

### 5.2 Test Payment Flow

1. Create test subscription
2. Verify webhook events are received
3. Check payment processing works end-to-end

## Step 6: SSL and Security Verification

### 6.1 SSL Certificate

- Vercel automatically provides SSL certificates
- Verify HTTPS works: `https://yourdomain.com`
- Check certificate validity in browser

### 6.2 Security Headers

Verify security headers are working:

```bash
curl -I https://yourdomain.com
```

Should include:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

## Step 7: Testing Production Deployment

### 7.1 Basic Functionality

- [ ] Homepage loads correctly
- [ ] User registration/login works
- [ ] Database connections working
- [ ] API endpoints responding

### 7.2 Payment Testing

- [ ] Stripe elements load
- [ ] Test payments work (use Stripe test mode first)
- [ ] Webhooks process correctly
- [ ] Subscription creation/cancellation

### 7.3 File Uploads

- [ ] S3 uploads work
- [ ] Files are publicly accessible
- [ ] CORS policy working correctly

### 7.4 Email Testing

- [ ] Registration emails sent
- [ ] Password reset works
- [ ] Notification emails delivered

## Step 8: Monitoring Setup

### 8.1 Vercel Analytics

- Enable Vercel Analytics in project settings
- Monitor performance and errors

### 8.2 Sentry Error Tracking

- Verify Sentry is receiving errors
- Set up alert notifications

### 8.3 Uptime Monitoring

Set up external monitoring:

- UptimeRobot (free tier)
- Pingdom
- StatusCake

## Step 9: Performance Optimization

### 9.1 Enable Vercel Features

- **Edge Functions**: For geographical performance
- **Image Optimization**: Automatic WebP conversion
- **Analytics**: Performance insights

### 9.2 Caching Strategy

- Static assets cached automatically
- API responses cached via headers
- Database query optimization

## Troubleshooting Common Issues

### Build Failures

```bash
# Check build logs in Vercel dashboard
# Common issues:
# - Missing environment variables
# - TypeScript errors
# - Dependency conflicts

# Debug locally:
npm run build
npm run type-check
```

### Runtime Errors

```bash
# Check Function Logs in Vercel dashboard
# Common issues:
# - Database connection failures
# - Missing environment variables
# - API timeout issues
```

### Performance Issues

```bash
# Use Vercel Analytics to identify:
# - Slow API routes
# - Large bundle sizes
# - Database query bottlenecks
```

## Environment Variables Checklist

Make sure all these are configured in Vercel:

**Essential:**

- [ ] `DATABASE_URL`
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXTAUTH_URL`

**Payments:**

- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`

**File Storage:**

- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_S3_BUCKET_NAME`
- [ ] `AWS_REGION`

**Email:**

- [ ] `SENDGRID_API_KEY`
- [ ] `SENDGRID_FROM_EMAIL`

**Security:**

- [ ] `ENCRYPTION_KEY`
- [ ] `JWT_SECRET`

**Optional:**

- [ ] `REDIS_URL`
- [ ] `SENTRY_DSN`
- [ ] `NEXT_PUBLIC_GA_ID`

## Deployment Commands Reference

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel

# Check deployment status
vercel ls

# View deployment logs
vercel logs <deployment-url>

# Set environment variable
vercel env add <NAME> <VALUE> production

# Pull environment variables
vercel env pull .env.production

# Link local project to Vercel project
vercel link

# Remove deployment
vercel remove <deployment-name>
```

## Next Steps After Deployment

1. **Domain Setup**: Configure custom domain and SSL
2. **Monitoring**: Set up error tracking and uptime monitoring
3. **Backup Strategy**: Implement database backup procedures
4. **Performance Testing**: Run load tests to ensure scalability
5. **User Acceptance Testing**: Have beta users test the platform
6. **Launch Preparation**: Prepare marketing and support documentation

---

**🎉 Congratulations! Your Direct Fan Platform is now live in production!**

For ongoing maintenance:

- Monitor Vercel deployment logs
- Keep dependencies updated
- Regular database backups
- Performance monitoring
- User feedback collection
