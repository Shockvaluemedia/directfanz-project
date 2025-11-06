# 🔧 Fix Vercel Build Error - Missing Environment Variables

## Problem

Your Vercel build is failing with:
```
Error: STRIPE_SECRET_KEY is not set in environment variables
```

This happens because Next.js tries to build all API routes at deploy time, and the Stripe library requires the API key during initialization.

---

## ✅ Quick Fix (5 minutes)

### Step 1: Go to Your Vercel Project

1. Open your Vercel dashboard: https://vercel.com/dashboard
2. Click on your `directfanz` project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add These Required Variables

Copy and paste each variable below. **For now, use these test/placeholder values** to get the build working:

#### **Core Authentication** (Use real values from `.env.production.secrets`):

```bash
NEXTAUTH_SECRET=o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=
```

```bash
ENCRYPTION_KEY=126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668
```

```bash
JWT_SECRET=DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=
```

#### **Node Environment**:

```bash
NODE_ENV=production
```

```bash
NEXTAUTH_URL=https://your-deployment-url.vercel.app
```
*(Replace with your actual Vercel URL after first deploy, or use your custom domain)*

#### **Stripe Keys** (Use test keys for now - BUILD WILL SUCCEED WITH THESE):

```bash
STRIPE_SECRET_KEY=sk_test_51PlaceholderKeyForBuildOnly
```

```bash
STRIPE_PUBLISHABLE_KEY=pk_test_51PlaceholderKeyForBuildOnly
```

```bash
STRIPE_WEBHOOK_SECRET=whsec_placeholder
```

**Important**: These placeholder Stripe keys will allow the build to succeed. Payment features won't work until you add real Stripe test keys.

#### **Database URL** (We'll add this next):

For now, use a placeholder to pass the build:
```bash
DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
```

**You'll replace this with a real database in Step 4**

---

### Step 3: Redeploy

After adding all variables:

1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on the failed deployment
3. Click **Redeploy**
4. Or: Make a git commit and push (auto-triggers deployment)

**Build should succeed this time!** ✅

---

### Step 4: Add Real Database (Required for App to Work)

Your app will build but won't function without a database. **Do this immediately after build succeeds**:

#### Option A: Vercel Postgres (Easiest - Recommended)

1. In Vercel dashboard → **Storage** tab
2. Click **Create Database**
3. Select **Postgres**
4. Choose **Free tier** (Hobby plan) or paid tier
5. Click **Create**
6. Vercel automatically adds `DATABASE_URL` to your project
7. Go to **Deployments** → **Redeploy** to apply the new variable

**Time: ~2 minutes**

#### Option B: External Database (Supabase, AWS RDS, etc.)

1. Create a PostgreSQL database on your chosen provider
2. Get the connection string (format: `postgresql://user:pass@host:5432/dbname`)
3. Add it to Vercel Environment Variables as `DATABASE_URL`
4. Redeploy

---

## 📋 Minimum Variables Needed (Quick Reference)

To get a working build and basic functionality:

```bash
# Core (Required)
NEXTAUTH_SECRET=o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=
ENCRYPTION_KEY=126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668
JWT_SECRET=DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=
NODE_ENV=production
NEXTAUTH_URL=https://your-app.vercel.app

# Stripe (Placeholder for build)
STRIPE_SECRET_KEY=sk_test_51PlaceholderKeyForBuildOnly
STRIPE_PUBLISHABLE_KEY=pk_test_51PlaceholderKeyForBuildOnly
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# Database (Replace with real one immediately after build)
DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
```

---

## 🎯 After Build Succeeds - Next Steps

### 1. **Add Real Database** (Critical - Do First)
   - See Step 4 above
   - Without this, app will error on any database query

### 2. **Add Real Stripe Test Keys** (For payment features)
   - Get keys from: https://dashboard.stripe.com/test/apikeys
   - Replace the placeholder Stripe values
   - Redeploy

### 3. **Add Redis** (For caching/sessions)
   - Recommended: Upstash Redis (free tier)
   - Sign up: https://upstash.com
   - Create Redis database
   - Add `REDIS_URL` to Vercel
   - Redeploy

### 4. **Add Other Services** (As needed)
   - AWS S3 (file uploads)
   - SendGrid (emails)
   - See: `VERCEL_ENV_CHECKLIST.md` for full list

---

## 🚀 Quick Copy-Paste for Vercel UI

**Tip**: In Vercel's "Add Environment Variable" interface, you can paste variables in this format:

```
NEXTAUTH_SECRET=o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=
ENCRYPTION_KEY=126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668
JWT_SECRET=DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=
NODE_ENV=production
NEXTAUTH_URL=https://your-app.vercel.app
STRIPE_SECRET_KEY=sk_test_51PlaceholderKeyForBuildOnly
STRIPE_PUBLISHABLE_KEY=pk_test_51PlaceholderKeyForBuildOnly
STRIPE_WEBHOOK_SECRET=whsec_placeholder
DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
```

Then click "Add" - Vercel will parse them automatically!

---

## ✅ Verification

After redeploying with these variables:

1. **Build succeeds** ✅
2. **Deployment URL is live** ✅
3. **Homepage loads** ✅
4. **Login page works** (after adding real database) ✅
5. **Payment features work** (after adding real Stripe keys) ✅

---

## 💡 Why This Error Happened

Next.js API routes are compiled at build time. The Stripe library initializes when the module is imported, which happens during the build process. Without `STRIPE_SECRET_KEY` in the environment, the build fails.

**Solution**: Always provide placeholder/test values for external service API keys during the build phase.

---

## 📚 Related Guides

- **VERCEL_ENV_CHECKLIST.md** - Complete environment variables guide
- **DEPLOY_FROM_GITHUB.md** - Full GitHub deployment walkthrough
- **DEPLOYMENT_READY.md** - Master deployment guide

---

**Time to Fix**: ~5 minutes
**Time to Full Functionality**: ~15 minutes (with database setup)

Let's get your DirectFanz platform live! 🚀
