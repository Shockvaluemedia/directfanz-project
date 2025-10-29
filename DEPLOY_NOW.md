# 🚀 Deploy DirectFanz to Vercel - Quick Guide

## Current Status

✅ **Domain**: directfanz.io
✅ **Vercel CLI installed**: v48.6.7
✅ **Environment secrets ready**: `.env.production.secrets`
✅ **Code pushed**: All latest changes on branch

## Deploy Now (3 Simple Steps)

### Option 1: Automated Script (Easiest)

Run this in your terminal:

```bash
./deploy-to-vercel.sh
```

This script will:
1. Login to Vercel
2. Upload environment variables
3. Deploy to production

### Option 2: Manual Commands

If you prefer manual control:

```bash
# Step 1: Login to Vercel
vercel login

# Step 2: Deploy to production
vercel --prod
```

## Environment Variables

Your secrets are already in `.env.production.secrets`:
- ✅ `NEXTAUTH_SECRET` - Generated
- ✅ `ENCRYPTION_KEY` - Generated
- ✅ `JWT_SECRET` - Generated

**You still need to add these in Vercel Dashboard:**

1. Go to your Vercel project settings → Environment Variables

2. Add these variables (get values from your local .env or services):

### Required
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXTAUTH_URL` - Will be `https://www.directfanz.io` (your production domain)
- `STRIPE_SECRET_KEY` - From Stripe dashboard
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - From Stripe dashboard
- `STRIPE_WEBHOOK_SECRET` - From Stripe webhooks
- `AWS_ACCESS_KEY_ID` - From AWS IAM
- `AWS_SECRET_ACCESS_KEY` - From AWS IAM
- `AWS_S3_BUCKET_NAME` - Your S3 bucket name
- `AWS_REGION` - e.g., `us-east-1`
- `SENDGRID_API_KEY` - From SendGrid
- `FROM_EMAIL` - Your sending email

### Optional but Recommended
- `REDIS_URL` - Upstash Redis connection string
- `NEXT_PUBLIC_SENTRY_DSN` - For error tracking
- `SENTRY_AUTH_TOKEN` - For Sentry integration

## After Deployment

### 1. Update Your Production URL

Once deployed, get your URL from Vercel dashboard and update:

```bash
# In Vercel dashboard, add/update:
NEXTAUTH_URL=https://your-deployment-url.vercel.app
```

### 2. Update Stripe Webhook

Go to Stripe Dashboard → Webhooks and add:
```
https://your-deployment-url.vercel.app/api/webhooks/stripe
```

### 3. Test Your Deployment

```bash
# Check health endpoint
curl https://your-deployment-url.vercel.app/api/health

# Test authentication
# Visit: https://your-deployment-url.vercel.app
```

## Troubleshooting

### Build Fails

```bash
# Run local build test first
npm run build

# Check for errors
npm run vercel:check
```

### Environment Variables Missing

- Go to Vercel Dashboard → Settings → Environment Variables
- Add any missing variables
- Redeploy: `vercel --prod`

### Function Timeout (Hobby Plan)

Your `vercel.json` is configured for Hobby plan (10s max).
If you need longer timeouts, upgrade to Pro ($20/month).

## Current Vercel Configuration

From your `vercel.json`:
- ✅ Framework: Next.js (auto-detected)
- ✅ Build: `npm run build`
- ✅ Function timeout: 10 seconds (Hobby plan)
- ✅ Security headers: Configured
- ✅ Redirects: www redirect configured

## Quick Commands Reference

```bash
# View deployments
vercel ls

# View logs
vercel logs

# Deploy preview (for testing)
vercel

# Deploy to production
vercel --prod

# Pull environment variables locally
vercel env pull

# Open dashboard
vercel open
```

## Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Your Project Dashboard**: Check Vercel dashboard for your DirectFanz project
- **Deployment Logs**: Check in Vercel dashboard under "Deployments"

---

**Ready to deploy? Run `./deploy-to-vercel.sh` now!** 🚀
