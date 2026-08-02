# Deploy DirectFanz from GitHub to Vercel

## GitHub Integration Setup (Recommended Method)

This is the easiest way to deploy - no CLI needed! Vercel will automatically deploy from your GitHub repository.

## Step-by-Step Guide

### 1. Go to Vercel Dashboard

Visit: https://vercel.com/new

Or click "Add New..." → "Project" in your Vercel dashboard

### 2. Import Your GitHub Repository

1. Click **"Import Git Repository"**
2. If not connected yet, click **"Connect GitHub Account"**
3. Authorize Vercel to access your repositories
4. Search for: `Shockvaluemedia/directfanz-project`
5. Click **"Import"** on your repository

### 3. Configure Project Settings

Vercel will auto-detect Next.js. Verify these settings:

#### Project Name
```
directfanz
```

#### Framework Preset
```
Next.js (auto-detected)
```

#### Root Directory
```
./
```

#### Build & Development Settings
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm ci` (auto-detected)
- **Development Command**: `npm run dev` (auto-detected)

> ✅ These are already configured in your `vercel.json` - don't change them

### 4. Environment Variables

Click **"Environment Variables"** and add these:

#### Essential Variables (Add Now)

```bash
# Authentication
NEXTAUTH_SECRET=o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=
NEXTAUTH_URL=https://www.directfanz.io
ENCRYPTION_KEY=126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668
JWT_SECRET=DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=

# Node Environment
NODE_ENV=production
```

#### Add Your Service Credentials

You'll need to add these with your actual values:

```bash
# Database (required)
DATABASE_URL=postgresql://user:password@host:5432/directfanz

# Stripe (required)
STRIPE_SECRET_KEY=sk_live_your_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# AWS S3 (required)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET_NAME=directfanz-production
AWS_REGION=us-east-1

# Email (required)
SENDGRID_API_KEY=SG.your_key
FROM_EMAIL=noreply@directfanz.io

# Optional but recommended
REDIS_URL=redis://your-redis-url
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
```

**Important:**
- Set these for **Production** environment
- Click "Add" for each variable
- You can add more later via Settings → Environment Variables

### 5. Deploy!

Click **"Deploy"**

Vercel will:
1. ✅ Clone your repository
2. ✅ Install dependencies (`npm ci`)
3. ✅ Run build (`npm run build`)
4. ✅ Deploy to production
5. ✅ Give you a live URL

⏱️ First deployment takes 2-3 minutes

### 6. Watch the Build

You'll see real-time logs:
- Installing dependencies...
- Building application...
- Deploying...
- ✅ Deployment successful!

### 7. Get Your URL

After deployment, you'll get:
- **Production URL**: `https://directfanz.vercel.app`
- **Deployment URL**: `https://directfanz-xyz123.vercel.app`

### 8. Add Your Custom Domain

1. Go to your project → **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter: `directfanz.io`
4. Click **"Add"**
5. Repeat for: `www.directfanz.io`

#### Configure DNS Records

Update your domain's DNS settings:

**For directfanz.io (apex domain):**
```
Type: A
Name: @
Value: 76.76.19.61
```

**For www.directfanz.io:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

Vercel will automatically provision SSL certificates! 🎉

### 9. Update Environment Variables

After adding your domain, update:

1. Go to Settings → Environment Variables
2. Edit `NEXTAUTH_URL` to: `https://www.directfanz.io`
3. Click **"Save"**
4. **Important**: Redeploy for changes to take effect

### 10. Enable Automatic Deployments

Already configured! Now:

- ✅ **Push to main branch** = Auto-deploy to production
- ✅ **Open a PR** = Auto-create preview deployment
- ✅ **Commit to any branch** = Preview deployment

## Post-Deployment Checklist

### ✅ Update Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://www.directfanz.io/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.*`
   - `invoice.payment_*`

### ✅ Run Database Migrations

You have two options:

**Option 1: Via Vercel CLI** (if you have it installed)
```bash
vercel env pull .env.production.local
npx prisma migrate deploy
```

**Option 2: Via your database client**
```bash
# Connect to your production database
DATABASE_URL="your_production_url" npx prisma migrate deploy
```

### ✅ Test Your Deployment

1. Visit `https://www.directfanz.io`
2. Test user registration
3. Test login
4. Test content upload
5. Test payment flow (test mode first!)

### ✅ Monitor Deployment

- **View logs**: Project → Deployments → Select deployment → "View Function Logs"
- **Analytics**: Enable in project settings
- **Alerts**: Configure in project settings

## Git Workflow (Automatic Deployments)

Now that it's connected, your workflow is:

### For Production:
```bash
git add .
git commit -m "Your changes"
git push origin main
```
→ Automatic production deployment!

### For Testing:
```bash
git checkout -b feature/new-feature
# make changes
git push origin feature/new-feature
```
→ Automatic preview deployment! Vercel comments on your PR with the preview URL.

## Branch Configuration

### Set Production Branch

1. Project Settings → Git
2. Production Branch: `main`
3. Automatically deploy: ✅ Enabled

### Preview Deployments

Vercel automatically creates preview deployments for:
- ✅ Pull Requests
- ✅ All branches (optional)

## Troubleshooting

### Build Fails

**Check build logs:**
1. Go to project → Deployments
2. Click on failed deployment
3. View build logs

**Common issues:**
- Missing environment variables
- TypeScript errors
- Dependency issues

**Fix:**
```bash
# Test locally first
npm run build
npm run vercel:check
```

### Environment Variables Not Working

1. Ensure they're set for "Production" environment
2. After adding/changing, **redeploy**
3. Check spelling and formatting

### Domain Not Working

1. Wait for DNS propagation (up to 48 hours)
2. Check DNS records are correct
3. Verify domain is added in Vercel
4. Check domain verification status

### Deployment Stuck

- Cancel and retry deployment
- Check if GitHub connection is active
- Verify repository permissions

## Benefits of GitHub Integration

✅ **Automatic deployments** - Push code = auto-deploy
✅ **Preview deployments** - Test PRs before merging
✅ **No CLI needed** - Everything via dashboard/GitHub
✅ **Rollback easy** - Redeploy any previous version
✅ **Team collaboration** - Multiple developers can deploy
✅ **Git history** = deployment history

## Project URLs

After setup, you'll have:

- **Production**: https://www.directfanz.io
- **Vercel Default**: https://directfanz.vercel.app
- **Deployments**: https://directfanz-[hash].vercel.app
- **Dashboard**: https://vercel.com/your-account/directfanz

## Quick Reference

```bash
# View project info
vercel inspect https://directfanz.vercel.app

# View logs (optional CLI)
vercel logs https://directfanz.vercel.app

# Force redeploy (via dashboard or CLI)
vercel redeploy https://directfanz-xyz123.vercel.app --prod
```

## Security Notes

✅ Environment variables are encrypted
✅ Secrets never exposed in logs
✅ SSL certificates auto-renewed
✅ DDoS protection included
✅ Automatic security headers (configured in vercel.json)

---

## 🎉 You're Done!

Your DirectFanz platform is now:
- ✅ Connected to GitHub
- ✅ Automatically deployed on push
- ✅ Live at directfanz.io
- ✅ Ready for production!

**Next time you want to deploy:**
Just push to GitHub. That's it! 🚀

---

**Need help?**
- Vercel Docs: https://vercel.com/docs
- GitHub Integration: https://vercel.com/docs/git
- Support: https://vercel.com/support
