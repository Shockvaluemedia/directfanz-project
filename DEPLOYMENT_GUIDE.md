# DirectFanz Tier 1 Features - Deployment Guide

This guide provides step-by-step instructions for deploying all 5 Tier 1 priority features to production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Stripe Configuration](#stripe-configuration)
5. [Email Service Setup](#email-service-setup)
6. [Cron Jobs](#cron-jobs)
7. [Deployment Steps](#deployment-steps)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Rollback Plan](#rollback-plan)

---

## Prerequisites

Before deploying, ensure you have:

- [x] Node.js 18+ installed
- [x] Database access (SQLite/PostgreSQL)
- [x] Stripe account (production keys)
- [x] Email service provider account (optional but recommended)
- [x] Server with continuous uptime (for cron jobs)
- [x] SSL certificate configured
- [x] Git repository access

---

## Environment Setup

### 1. Install Dependencies

```bash
# Install new dependencies
npm install cron

# Verify all dependencies
npm install

# Build the project
npm run build
```

### 2. Environment Variables

Create or update `.env.production`:

```env
# Existing variables (keep these)
DATABASE_URL="your_database_url"
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Stripe (PRODUCTION KEYS - very important!)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # NEW - get from Stripe Dashboard

# Email Service (optional but recommended)
SENDGRID_API_KEY="SG...."  # or your email provider
EMAIL_FROM="noreply@your-domain.com"

# Node Environment
NODE_ENV="production"
PORT="3000"
```

**⚠️ CRITICAL:** Double-check that you're using Stripe **live** keys, not test keys!

---

## Database Migration

### 1. Review Schema Changes

The following models have been added:
- `onboarding_progress` - Artist onboarding tracking
- `scheduled_publish` - Content scheduling
- `user_interactions` - User behavior tracking for recommendations
- `artist_similarity` - Pre-computed similarity scores

Existing models modified:
- `tiers` - Added trial fields (`allowFreeTrial`, `trialDays`, etc.)
- `subscriptions` - Added trial tracking (`isTrialing`, `trialStartDate`, etc.)
- `content` - Added scheduling fields (`scheduledFor`, `isScheduled`, etc.)
- `users` - Added relation fields

### 2. Run Migration

```bash
# Generate Prisma client with new schema
npx prisma generate

# Create migration
npx prisma migrate deploy

# Verify migration
npx prisma migrate status
```

### 3. Backup Database (IMPORTANT!)

Before running migration in production:

```bash
# For PostgreSQL
pg_dump your_database > backup_before_tier1_$(date +%Y%m%d).sql

# For SQLite
cp prisma/dev.db prisma/dev.db.backup_$(date +%Y%m%d)
```

---

## Stripe Configuration

### 1. Webhook Endpoint Setup

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `customer.subscription.trial_will_end`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `account.updated`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add to `.env.production` as `STRIPE_WEBHOOK_SECRET`

### 2. Test Webhook

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Test webhook (development)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test event
stripe trigger customer.subscription.trial_will_end
```

### 3. Verify Connect Setup

Ensure your Stripe account has:
- [x] Connect enabled
- [x] Express accounts allowed
- [x] Platform fee (application_fee_percent) enabled

---

## Email Service Setup

### Option 1: SendGrid (Recommended)

```bash
npm install @sendgrid/mail
```

Update `src/lib/email/email-service.ts`:

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await sgMail.send({
      to: options.to,
      from: process.env.EMAIL_FROM!,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send email', { error });
    return false;
  }
}
```

### Option 2: Resend

```bash
npm install resend
```

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send email', { error });
    return false;
  }
}
```

### Option 3: AWS SES

```bash
npm install @aws-sdk/client-ses
```

---

## Cron Jobs

The server automatically starts two cron jobs:

### 1. Scheduled Content Publishing
- **Schedule:** Every 5 minutes
- **Function:** `publishScheduledContent()`
- **File:** `src/lib/cron/publish-scheduled-content.ts`

**What it does:**
- Finds content with `scheduledFor` <= now
- Updates status to PUBLISHED
- Sends notifications to subscribers
- Handles errors with retry logic (up to 3 attempts)

### 2. Artist Similarity Calculation
- **Schedule:** Daily at 2:00 AM UTC
- **Function:** `calculateArtistSimilarities()`
- **File:** `src/lib/cron/calculate-artist-similarity.ts`

**What it does:**
- Calculates similarity scores between all artists
- Stores top 20 similar artists per artist
- Improves discovery recommendations
- Can be manually triggered via admin API

### Verify Cron Jobs Are Running

Check server logs for:
```
⏰ Scheduled content publish job initialized
🔍 Artist similarity calculation job initialized
```

### Manual Trigger (Admin Only)

```bash
curl -X POST https://your-domain.com/api/admin/calculate-similarities \
  -H "Authorization: Bearer <admin-token>"
```

---

## Deployment Steps

### Step 1: Pre-Deployment Checklist

- [ ] Database backup completed
- [ ] Environment variables set
- [ ] Stripe webhook configured
- [ ] Email service configured (optional)
- [ ] Dependencies installed
- [ ] Build successful (`npm run build`)

### Step 2: Deploy to Staging (Recommended)

```bash
# Deploy to staging environment
git push staging main

# Run migrations
ssh staging-server "cd /app && npx prisma migrate deploy"

# Restart server
ssh staging-server "pm2 restart directfanz"

# Verify
curl https://staging.your-domain.com/api/health
```

### Step 3: Test on Staging

1. **Test Artist Onboarding:**
   - Create test artist account
   - Complete all 5 steps
   - Verify progress tracking

2. **Test Stripe Integration:**
   - Connect Stripe account (use test mode)
   - Verify webhook events received
   - Check database updates

3. **Test Free Trial:**
   - Create tier with trial enabled
   - Subscribe as fan
   - Verify trial status

4. **Test Content Scheduling:**
   - Schedule content for 10 minutes from now
   - Wait and verify auto-publish
   - Check notifications sent

5. **Test Discovery Feed:**
   - View recommended artists
   - Check trending calculations
   - Verify similar artists

### Step 4: Deploy to Production

```bash
# Tag release
git tag -a v1.0.0-tier1 -m "Tier 1 Features Release"
git push origin v1.0.0-tier1

# Deploy to production
git push production main

# Run migrations
ssh production-server "cd /app && npx prisma migrate deploy"

# Restart server with zero-downtime
ssh production-server "pm2 reload directfanz"
```

### Step 5: Verify Deployment

```bash
# Check server status
pm2 status

# Check logs
pm2 logs directfanz --lines 100

# Verify cron jobs started
grep "initialized" /var/log/directfanz/app.log
```

---

## Post-Deployment Verification

### Immediate Checks (First 30 minutes)

1. **Server Health:**
   ```bash
   curl https://your-domain.com/api/health
   ```

2. **Webhook Endpoint:**
   ```bash
   # In Stripe Dashboard, send test webhook
   # Verify 200 response and no errors in logs
   ```

3. **Database Connectivity:**
   ```bash
   # Check that queries are working
   curl https://your-domain.com/api/discovery/trending
   ```

4. **Cron Jobs:**
   ```bash
   # Wait 5 minutes, check for scheduled publish logs
   grep "Starting scheduled content publish" logs/app.log
   ```

### First 24 Hours

1. **Monitor Error Rates:**
   - Check for spike in 500 errors
   - Review error logs
   - Monitor Stripe webhook failures

2. **Verify Webhooks:**
   - Check Stripe Dashboard for webhook delivery success rate
   - Should be >95% successful

3. **Check Email Delivery:**
   - Verify trial reminder emails sent
   - Check email service delivery rates
   - Review bounce/spam rates

4. **Artist Onboarding:**
   - Monitor completion rates
   - Check for drop-off points
   - Verify Stripe connections working

### First Week

1. **Feature Adoption:**
   - Count new tiers with trials enabled
   - Count scheduled content created
   - Measure discovery page views

2. **Conversion Metrics:**
   - Track trial → paid conversion rate
   - Measure onboarding completion rate
   - Monitor subscription growth

3. **Performance:**
   - Check API response times
   - Monitor database query performance
   - Verify cron jobs completing on time

---

## Monitoring & Maintenance

### Key Metrics to Track

**Onboarding:**
- Onboarding completion rate (target: 75%)
- Time to complete onboarding (target: < 24 hours)
- Stripe connection success rate (target: > 90%)

**Trials:**
- Trial start rate (target: 50% of new subscriptions)
- Trial → paid conversion (target: 40%)
- Trial cancellation rate

**Content Scheduling:**
- Scheduled content created per day
- Auto-publish success rate (target: > 99%)
- Failed publishes requiring retry

**Discovery:**
- Discovery page views
- Recommendation click-through rate
- Similar artist engagement

### Monitoring Tools

**Application Logs:**
```bash
# Real-time logs
pm2 logs directfanz

# Search for errors
grep "ERROR" logs/app.log | tail -50

# Check webhook events
grep "Stripe webhook" logs/app.log
```

**Database Monitoring:**
```sql
-- Check trial conversions
SELECT COUNT(*) FROM subscriptions
WHERE convertedFromTrial = true
AND createdAt > NOW() - INTERVAL '7 days';

-- Check scheduled content
SELECT COUNT(*) FROM scheduled_publish
WHERE published = false
AND scheduledFor < NOW();

-- Check failed publishes
SELECT * FROM scheduled_publish
WHERE failedAt IS NOT NULL
ORDER BY failedAt DESC LIMIT 10;
```

**Stripe Dashboard:**
- Monitor webhook delivery
- Check dispute/refund rates
- Review Connect account activity

### Alerts to Set Up

1. **Critical:**
   - Server down (>5 min)
   - Database connection failed
   - Webhook delivery < 90% success
   - Cron job not running

2. **Warning:**
   - API response time > 2s
   - Failed scheduled publishes
   - Email delivery failures
   - High error rate

3. **Info:**
   - Trial conversion milestone
   - Similarity calculation completed
   - New feature adoption metrics

---

## Common Issues & Solutions

### Issue: Webhook Signature Verification Failed

**Symptoms:**
```
Webhook signature verification failed
```

**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` is correct
2. Check webhook endpoint URL matches exactly
3. Ensure no proxy/CDN modifying requests
4. Use raw body for signature verification

### Issue: Scheduled Content Not Publishing

**Symptoms:**
- Content remains scheduled past publish time
- No errors in logs

**Solution:**
1. Check cron job is running: `pm2 list`
2. Verify system time is correct: `date`
3. Check database connectivity
4. Manually trigger: restart server

### Issue: Emails Not Sending

**Symptoms:**
- No emails received
- No errors in logs (it logs "would be sent")

**Solution:**
1. Email service not integrated (see Email Setup section)
2. Verify API keys in environment
3. Check email service dashboard for bounces
4. Verify sender domain authenticated

### Issue: Similarity Calculation Failing

**Symptoms:**
```
Failed to run artist similarity calculation
```

**Solution:**
1. Check database has sufficient artists
2. Verify memory limits sufficient
3. Manually trigger to see full error
4. Check database indexes exist

### Issue: Import Path Errors After Deployment

**Symptoms:**
```
Cannot find module '@/lib/...'
```

**Solution:**
1. Verify `tsconfig.json` paths configuration
2. Rebuild: `npm run build`
3. Check Next.js version compatibility

---

## Rollback Plan

If critical issues occur, follow this rollback procedure:

### Quick Rollback (< 5 minutes)

```bash
# 1. Rollback code
git revert HEAD
git push production main

# 2. Restart server
pm2 restart directfanz

# 3. Verify
curl https://your-domain.com/api/health
```

### Full Rollback (if database migrated)

```bash
# 1. Stop server
pm2 stop directfanz

# 2. Restore database backup
psql your_database < backup_before_tier1_YYYYMMDD.sql

# 3. Rollback code
git checkout <previous-version-tag>
git push production main --force

# 4. Restart server
pm2 start directfanz

# 5. Verify
curl https://your-domain.com/api/health
```

### Partial Rollback (disable features)

If only some features are problematic:

1. **Disable Cron Jobs:**
   ```typescript
   // Comment out in server.ts
   // startScheduledPublishJob();
   // startArtistSimilarityJob();
   ```

2. **Disable Webhooks:**
   - Pause endpoint in Stripe Dashboard

3. **Disable Discovery:**
   - Return empty arrays from discovery APIs temporarily

---

## Performance Optimization

### Database Indexes

Verify these indexes exist:

```sql
CREATE INDEX IF NOT EXISTS idx_scheduled_publish_pending
  ON scheduled_publish(scheduledFor, published)
  WHERE published = false;

CREATE INDEX IF NOT EXISTS idx_user_interactions_analysis
  ON user_interactions(userId, createdAt);

CREATE INDEX IF NOT EXISTS idx_artist_similarity_score
  ON artist_similarity(artistId, similarityScore);
```

### Caching

Consider adding Redis for:
- Discovery feed results (5 min TTL)
- Trending artists (10 min TTL)
- Similarity scores (1 hour TTL)

### CDN

Serve static assets and API responses through CDN:
- Artist avatars
- Content thumbnails
- Discovery feed (short cache)

---

## Security Checklist

- [ ] Stripe webhook signature verification enabled
- [ ] HTTPS enforced for all endpoints
- [ ] API rate limiting configured
- [ ] Database credentials rotated
- [ ] Environment variables secured (not in code)
- [ ] CORS properly configured
- [ ] SQL injection prevention (using Prisma)
- [ ] XSS prevention (input sanitization)
- [ ] Authentication middleware on all protected routes

---

## Support Contacts

**Critical Issues (24/7):**
- On-call engineer: [contact]
- Stripe support: https://support.stripe.com

**Non-Critical Issues:**
- Development team: [contact]
- Product manager: [contact]

**External Services:**
- Stripe Dashboard: https://dashboard.stripe.com
- Email Service: [your provider]
- Hosting Provider: [your provider]

---

## Success Criteria

Deployment is considered successful when:

- [ ] All health checks passing
- [ ] Zero critical errors in logs
- [ ] Webhook delivery > 95%
- [ ] Cron jobs running on schedule
- [ ] Artist onboarding completing successfully
- [ ] Trial subscriptions creating properly
- [ ] Content scheduling working
- [ ] Discovery feed loading
- [ ] Email notifications sending

---

## Next Steps After Deployment

1. **Monitor for 48 hours** - Watch metrics closely
2. **Gather user feedback** - Reach out to beta users
3. **Document learnings** - Note any issues or surprises
4. **Plan Tier 2 features** - Continue platform improvements
5. **Marketing launch** - Announce new features to users

---

**Last Updated:** 2024-01-24
**Version:** 1.0
**Deployment Owner:** [Your Name]
