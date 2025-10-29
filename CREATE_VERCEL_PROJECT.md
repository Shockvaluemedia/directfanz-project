# Create New Vercel Project: "directfanz"

## Quick Setup (Automated)

Run this script in your terminal:

```bash
./create-vercel-project.sh
```

This will:
1. Install/verify Vercel CLI
2. Login to Vercel
3. Create new project "directfanz"
4. Deploy initial version

## Manual Setup (Step by Step)

If you prefer manual control:

### Step 1: Login to Vercel

```bash
vercel login
```

### Step 2: Deploy and Create Project

```bash
vercel --name directfanz
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account/team
- **Link to existing project?** → No
- **What's your project's name?** → `directfanz`
- **In which directory?** → `./`
- **Want to override settings?** → No (uses auto-detection)

### Step 3: Configure Domain

Add your directfanz.io domain:

```bash
# Add apex domain
vercel domains add directfanz.io --project directfanz

# Add www subdomain
vercel domains add www.directfanz.io --project directfanz
```

Or in Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select "directfanz" project
3. Settings → Domains
4. Add `directfanz.io` and `www.directfanz.io`

### Step 4: Configure DNS

Update your DNS records at your domain registrar:

**For directfanz.io (apex):**
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

### Step 5: Set Environment Variables

#### Option 1: Automated (Recommended)

```bash
./setup-vercel-env.sh
```

#### Option 2: Manual via CLI

```bash
# Generated secrets (from .env.production.secrets)
echo "o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=" | vercel env add NEXTAUTH_SECRET production
echo "126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668" | vercel env add ENCRYPTION_KEY production
echo "DFbIHLqrPz9+7mTo3QUng2a6rSsHVLKKsHiF01RL9Uk=" | vercel env add JWT_SECRET production

# Add your actual values
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_URL production  # https://www.directfanz.io
vercel env add STRIPE_SECRET_KEY production
# ... continue for all variables
```

#### Option 3: Manual via Dashboard

Go to: https://vercel.com/your-account/directfanz/settings/environment-variables

**Required Variables:**

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Production URL | `https://www.directfanz.io` |
| `NEXTAUTH_SECRET` | From .env.production.secrets | `o5up8Woxtj0Iu0j3yBy+...` |
| `ENCRYPTION_KEY` | From .env.production.secrets | `126e7caccce86ff1af33a31b...` |
| `JWT_SECRET` | From .env.production.secrets | `DFbIHLqrPz9+7mTo3QUng2a6...` |
| `STRIPE_SECRET_KEY` | Stripe live key | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook | `whsec_...` |
| `AWS_ACCESS_KEY_ID` | AWS IAM | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM | `...` |
| `AWS_S3_BUCKET_NAME` | S3 bucket | `directfanz-production` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `SENDGRID_API_KEY` | SendGrid API | `SG.....` |
| `FROM_EMAIL` | Sender email | `noreply@directfanz.io` |

**Optional but Recommended:**

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Upstash Redis for caching |
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking |
| `SENTRY_AUTH_TOKEN` | Sentry integration |

### Step 6: Deploy to Production

```bash
vercel --prod
```

This will:
- Build your Next.js app
- Deploy to production
- Make it live at your domain

## Verify Deployment

### Check Deployment Status

```bash
# View all deployments
vercel ls

# View logs
vercel logs

# Open in browser
vercel open
```

### Test Your Site

```bash
# Health check
curl https://www.directfanz.io/api/health

# Or visit in browser
open https://www.directfanz.io
```

### Check DNS Propagation

```bash
# Check if DNS is working
dig directfanz.io
dig www.directfanz.io

# Or use online tool
open https://dnschecker.org
```

## Post-Deployment Tasks

### 1. Update Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add/update endpoint: `https://www.directfanz.io/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 2. Run Database Migrations

```bash
# Pull production env vars
vercel env pull .env.production.local

# Run migrations
npx prisma migrate deploy
```

### 3. Enable Vercel Analytics

1. Go to project dashboard
2. Analytics tab
3. Enable Vercel Analytics

### 4. Configure Git Integration

1. Project Settings → Git
2. Production Branch: `main`
3. Enable automatic deployments

## Troubleshooting

### Build Fails

```bash
# Test build locally
npm run build

# Check for errors
npm run vercel:check
```

### Domain Not Working

- Check DNS records are correct
- Wait for DNS propagation (up to 48 hours)
- Verify domain is added in Vercel dashboard
- Check domain verification status

### Environment Variables Missing

```bash
# List all env vars
vercel env ls

# Pull env vars to check
vercel env pull
```

### Deployment Stuck

- Check build logs in Vercel dashboard
- Verify Node.js version compatibility
- Check for TypeScript errors

## Project Structure

```
directfanz/
├── Vercel Project Name: "directfanz"
├── Production URL: https://www.directfanz.io
├── Preview Deployments: Auto-created for PRs
└── Environment: Production
```

## Useful Commands

```bash
# Create project (if not done)
vercel --name directfanz

# Deploy preview
vercel

# Deploy production
vercel --prod

# Add domain
vercel domains add directfanz.io

# List domains
vercel domains ls

# Add env var
vercel env add VAR_NAME production

# Remove env var
vercel env rm VAR_NAME production

# View project info
vercel inspect

# Open dashboard
vercel open
```

## Next Steps

After successful deployment:

1. ✅ Test all critical features
2. ✅ Verify authentication works
3. ✅ Test payment processing
4. ✅ Check file uploads to S3
5. ✅ Verify email delivery
6. ✅ Set up monitoring alerts
7. ✅ Create custom error pages
8. ✅ Configure CDN caching
9. ✅ Enable DDoS protection
10. ✅ Set up automated backups

---

**🎉 Your DirectFanz platform is ready to go live!**

For support:
- Vercel Docs: https://vercel.com/docs
- DirectFanz Docs: See PRODUCTION_QUICKSTART.md
- Vercel Support: https://vercel.com/support
