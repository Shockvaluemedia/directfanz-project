# Environment Variables Checklist for Vercel

## ✅ READY - Already Generated (Copy from `.env.production.secrets`)

These are already generated and ready to use:

```bash
NEXTAUTH_SECRET=o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=
ENCRYPTION_KEY=126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668
JWT_SECRET=DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=
NODE_ENV=production
```

## ⚠️ NEED TO ADD - Your Production Services

You need to provide these from your external services:

### 1. Database (PostgreSQL)

You currently have localhost. You need a production database.

**Options:**
- **Vercel Postgres** (easiest): https://vercel.com/docs/storage/vercel-postgres
- **Supabase** (free tier): https://supabase.com
- **Neon** (serverless): https://neon.tech
- **AWS RDS** (enterprise)

```bash
DATABASE_URL=postgresql://user:password@host:5432/directfanz_production
```

**Current (localhost):** `postgresql://postgres:Godswork12!$@localhost:5432/directfanz`
**Need:** Production database URL

### 2. Redis (Optional but Recommended)

**Options:**
- **Upstash** (recommended for Vercel): https://upstash.com
- **Redis Cloud**: https://redis.com/cloud

```bash
REDIS_URL=rediss://default:password@host:6379
```

**Current (localhost):** `redis://localhost:6379`
**Need:** Production Redis URL (or skip for now)

### 3. Stripe (Required for Payments)

Get from: https://dashboard.stripe.com/apikeys

```bash
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_...)
STRIPE_WEBHOOK_SECRET=whsec_... (create webhook after deployment)
```

**Status:** ❌ Need to add

### 4. AWS S3 (Required for File Uploads)

Get from: AWS IAM Console

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=directfanz-production
AWS_REGION=us-east-1
```

**Status:** ❌ Need to add

### 5. SendGrid (Required for Emails)

Get from: https://app.sendgrid.com/settings/api_keys

```bash
SENDGRID_API_KEY=SG....
FROM_EMAIL=noreply@directfanz.io
```

**Status:** ❌ Need to add

### 6. URLs

```bash
NEXTAUTH_URL=https://www.directfanz.io
NEXT_PUBLIC_APP_URL=https://www.directfanz.io
```

**Status:** ✅ Ready (just copy these)

### 7. Sentry (Optional - Error Tracking)

Get from: https://sentry.io

```bash
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=your-org
SENTRY_PROJECT=directfanz
```

**Status:** ⚪ Optional (skip for now, add later)

## Quick Setup Plan

### Minimum to Deploy (Start Here)

1. ✅ **Copy from `.env.production.secrets`**:
   - NEXTAUTH_SECRET
   - ENCRYPTION_KEY
   - JWT_SECRET

2. ✅ **Add URLs**:
   - NEXTAUTH_URL=https://www.directfanz.io
   - NODE_ENV=production

3. ⚠️ **Database** (pick one):
   - Option A: Use Vercel Postgres (easiest)
   - Option B: Use Supabase free tier
   - Option C: Use your existing production database

### To Enable Full Features

4. **Stripe** (for payments)
5. **AWS S3** (for file uploads)
6. **SendGrid** (for emails)
7. **Redis** (optional, for caching)

## Copy-Paste Template for Vercel

### Minimum Deployment (Test First)

```bash
# Generated Secrets (from .env.production.secrets)
NEXTAUTH_SECRET=o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=
ENCRYPTION_KEY=126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668
JWT_SECRET=DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=

# URLs
NEXTAUTH_URL=https://www.directfanz.io
NODE_ENV=production

# Database (REQUIRED - add your production database)
DATABASE_URL=postgresql://your_user:your_password@your_host:5432/directfanz
```

### Full Production (All Features)

Add the minimum above, plus:

```bash
# Stripe (for payments)
STRIPE_SECRET_KEY=sk_live_your_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# AWS S3 (for uploads)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=directfanz-production
AWS_REGION=us-east-1

# SendGrid (for emails)
SENDGRID_API_KEY=SG....
FROM_EMAIL=noreply@directfanz.io

# Redis (optional)
REDIS_URL=rediss://default:password@host:6379
```

## Quick Start Options

### Option 1: Deploy with Minimum (Test Mode)

**Pros:** Deploy quickly, test the app
**Cons:** No payments, uploads, or emails yet

Add only:
- Generated secrets (from .env.production.secrets)
- URLs
- DATABASE_URL (use Vercel Postgres for easy setup)

### Option 2: Full Production Setup

**Pros:** All features work immediately
**Cons:** Need to set up all external services first

Add all variables above before deploying.

## Recommended Approach

1. **First deployment** - Use Option 1 (minimum)
   - Tests your app works on Vercel
   - Get your live URL
   - Verify build succeeds

2. **Add features incrementally**:
   - Add Stripe → Test payments
   - Add AWS S3 → Test uploads
   - Add SendGrid → Test emails

3. **Redeploy** after each addition:
   - Settings → Redeploy latest deployment

## Where to Add in Vercel

When importing from GitHub:

1. Click "Environment Variables" dropdown
2. Add each variable:
   - **Key**: Variable name (e.g., `NEXTAUTH_SECRET`)
   - **Value**: The actual value
   - **Environment**: Select "Production"
3. Click "Add"
4. Repeat for all variables

Or after deployment:
1. Project Settings → Environment Variables
2. Add new variable
3. Redeploy

## Do You Have These Services?

Check if you already have accounts:

- [ ] Stripe account? (https://dashboard.stripe.com)
- [ ] AWS account with S3? (https://console.aws.amazon.com)
- [ ] SendGrid account? (https://sendgrid.com)
- [ ] Production database?
- [ ] Redis instance?

If not, you can:
- Deploy with minimum first (just database)
- Add services as you need them
- Test each feature incrementally

## Need Help Setting Up Services?

I can help you:
- Set up Vercel Postgres (easiest for database)
- Configure Stripe test mode (for testing payments)
- Set up Upstash Redis (free tier)
- Create AWS S3 bucket
- Configure SendGrid

Just let me know which services you need help with!

---

**Summary:**
- ✅ 3 secrets ready to copy
- ⚠️ Need production database URL
- ⚠️ Need Stripe/AWS/SendGrid credentials (for full features)
- ✅ Can deploy with minimum and add features later
