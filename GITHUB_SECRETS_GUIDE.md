# GitHub Secrets → Vercel Deployment Guide

## Current Situation

You have 3 secrets committed in `.env.production.secrets`:
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY`
- `JWT_SECRET`

**However**, Vercel cannot automatically read these from your GitHub repository. You need to either:
1. **Option A**: Set up GitHub Actions to deploy to Vercel (using GitHub Secrets)
2. **Option B**: Manually add secrets to Vercel dashboard (one-time setup)

---

## ✅ RECOMMENDED: Option A - GitHub Actions Deployment

This approach keeps GitHub as your source of truth for secrets, and uses GitHub Actions to deploy to Vercel.

### Step 1: Add Secrets to GitHub

1. Go to your GitHub repository: https://github.com/Shockvaluemedia/directfanz-project
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets **one by one**:

#### From `.env.production.secrets` (already in your repo):
```
Name: NEXTAUTH_SECRET
Value: o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=
```

```
Name: ENCRYPTION_KEY
Value: 126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668
```

```
Name: JWT_SECRET
Value: DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=
```

#### Required for deployment:
```
Name: NODE_ENV
Value: production
```

```
Name: NEXTAUTH_URL
Value: https://your-vercel-deployment.vercel.app
```
*(Update after first deploy)*

```
Name: DATABASE_URL
Value: postgresql://user:pass@host:5432/dbname
```
*(Get from Vercel Postgres or your database provider)*

#### Stripe (these you need to add):
```
Name: STRIPE_SECRET_KEY
Value: sk_test_your_stripe_test_key
```

```
Name: STRIPE_PUBLISHABLE_KEY
Value: pk_test_your_stripe_test_key
```

```
Name: STRIPE_WEBHOOK_SECRET
Value: whsec_your_webhook_secret
```

#### Vercel Token (for GitHub Actions to deploy):
```
Name: VERCEL_TOKEN
Value: <get from https://vercel.com/account/tokens>
```

```
Name: VERCEL_ORG_ID
Value: <get from Vercel project settings>
```

```
Name: VERCEL_PROJECT_ID
Value: <get from Vercel project settings>
```

---

### Step 2: Get Vercel IDs

1. Go to https://vercel.com/account/tokens
2. Click **Create Token**
3. Name it: `GitHub Actions`
4. Copy the token → Add as `VERCEL_TOKEN` GitHub Secret

5. Go to your Vercel project settings
6. Copy **Project ID** → Add as `VERCEL_PROJECT_ID` GitHub Secret
7. Copy **Team/Org ID** → Add as `VERCEL_ORG_ID` GitHub Secret

---

### Step 3: Update GitHub Actions Workflow

The workflow at `.github/workflows/deploy.yml` will be updated to actually deploy to Vercel using these secrets.

---

## 🔄 Option B - Manual Vercel Setup (Faster, But Not Automated)

If you want to deploy NOW and set up automation later:

### Add Secrets to Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Click your `directfanz` project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

#### Copy-paste this into Vercel:

```bash
# From .env.production.secrets
NEXTAUTH_SECRET=o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=
ENCRYPTION_KEY=126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668
JWT_SECRET=DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=

# Basic config
NODE_ENV=production
NEXTAUTH_URL=https://your-deployment.vercel.app

# Stripe (use test keys for now)
STRIPE_SECRET_KEY=sk_test_placeholder_for_build
STRIPE_PUBLISHABLE_KEY=pk_test_placeholder_for_build
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# Database (temporary)
DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
```

5. Go to **Deployments** → **Redeploy**
6. Build should succeed! ✅

Then add real database and Stripe keys:
- Create Vercel Postgres database
- Replace Stripe placeholders with real test keys
- Redeploy

---

## 📊 Comparison

| Feature | Option A (GitHub Actions) | Option B (Manual) |
|---------|-------------------------|-------------------|
| **Setup Time** | 30 minutes | 5 minutes |
| **Auto-deploy on push** | ✅ Yes | ✅ Yes (Vercel integration) |
| **Secrets in GitHub** | ✅ Yes | ⚠️ No (duplicated in Vercel) |
| **Full CI/CD** | ✅ Yes | ❌ No |
| **Recommendation** | Best for long-term | Best for NOW |

---

## 🎯 Recommended Path

### TODAY (5 minutes):
1. Use **Option B** - Add secrets to Vercel manually
2. Get your site live and working
3. Test everything

### THIS WEEK (30 minutes):
1. Set up **Option A** - GitHub Actions deployment
2. Migrate to fully automated CI/CD pipeline
3. GitHub becomes single source of truth for secrets

---

## ⚠️ Important Notes

### About Secrets in Git

Your `.env.production.secrets` is **committed to git**. This is unusual because:
- ✅ **Pro**: Easy to share between environments
- ❌ **Con**: Anyone with repo access can see secrets
- ⚠️ **Security Risk**: If repo becomes public, secrets are exposed

**Recommendation**: After setting up GitHub Secrets or Vercel env vars:
1. Remove `.env.production.secrets` from git:
   ```bash
   git rm .env.production.secrets
   git commit -m "Remove committed secrets (now in GitHub Secrets)"
   ```
2. Keep secrets only in GitHub Secrets and Vercel

### About Stripe Keys

For Stripe specifically:
- **Test keys**: Safe to share in private repos
- **Live keys**: NEVER commit to git
- Always use `sk_live_*` and `pk_live_*` only in production secrets managers

---

## 🚀 Next Steps

Choose your path:

**Want to deploy RIGHT NOW?**
→ Use **Option B** (Manual setup - 5 minutes)
→ See: `VERCEL_BUILD_FIX.md` for step-by-step

**Want proper CI/CD setup?**
→ Use **Option A** (GitHub Actions - 30 minutes)
→ I'll create the updated GitHub Actions workflow for you

**Which would you like me to help you with?**
