# Quick DirectFanz Deployment to Vercel

## Why Vercel Instead of AWS?

The AWS Terraform configuration has duplicate resource conflicts that need extensive cleanup. Vercel offers a faster path to production with:

- ✅ Automatic SSL certificates
- ✅ Global CDN
- ✅ Easy domain connection
- ✅ Built-in monitoring
- ✅ Zero infrastructure management

## Step 1: Prepare Environment Variables

First, update your email in the terraform.tfvars to your actual email:

```bash
# Edit this file and replace "your-email@example.com" with your real email
nano infrastructure/terraform/terraform.tfvars
```

## Step 2: Deploy to Vercel

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy the project
vercel --prod
```

During deployment, Vercel will ask for environment variables. You'll need:

### Required Environment Variables:

```env
# Database (use a managed service like Supabase or Railway)
DATABASE_URL="postgresql://user:pass@host:5432/directfanz"

# Redis (use Upstash Redis)
REDIS_URL="redis://user:pass@host:port"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://your-vercel-domain.vercel.app"

# Stripe
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# SendGrid
SENDGRID_API_KEY="SG...."
FROM_EMAIL="noreply@directfanz.io"

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID="your-key"
AWS_SECRET_ACCESS_KEY="your-secret"
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="directfanz-uploads"
```

## Step 3: Connect Your Domain

1. In Vercel dashboard, go to your project
2. Go to Settings → Domains
3. Add `directfanz.io` and `www.directfanz.io`
4. Vercel will provide DNS records
5. Update your Hostinger DNS settings with these records

## Step 4: Set Up External Services

### Database (Supabase - Recommended)
```bash
# Go to https://supabase.com
# Create new project
# Copy connection string to DATABASE_URL
```

### Redis (Upstash - Recommended)
```bash
# Go to https://upstash.com
# Create Redis database
# Copy connection string to REDIS_URL
```

### File Storage (AWS S3)
```bash
# Create S3 bucket in AWS console
# Create IAM user with S3 permissions
# Add credentials to environment variables
```

## Step 5: Run Database Migrations

```bash
# After deployment, run migrations
npx prisma migrate deploy
npx prisma db seed
```

## Step 6: Test Your Deployment

Visit your domain and test:
- ✅ User registration/login
- ✅ File uploads
- ✅ Payment processing
- ✅ Real-time features

## Estimated Timeline

- **Vercel deployment**: 10-15 minutes
- **Domain connection**: 5-10 minutes  
- **External services setup**: 20-30 minutes
- **DNS propagation**: 1-24 hours
- **Total active time**: 45-60 minutes

## Benefits of This Approach

1. **Much faster** than AWS infrastructure setup
2. **Automatic scaling** and performance optimization
3. **Built-in monitoring** and analytics
4. **Easy rollbacks** and deployments
5. **Cost-effective** for most traffic levels

## Next Steps After Deployment

1. Monitor performance in Vercel dashboard
2. Set up custom monitoring (optional)
3. Configure backup strategies
4. Plan for scaling if needed

---

**Ready to deploy?** Run `vercel --prod` to get started!