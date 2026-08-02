# 🚀 DirectFanz - AWS Amplify Deployment Guide

## Quick Setup (5 minutes)

### 1. Deploy via Amplify Console (Recommended)

1. **Go to AWS Amplify Console**: https://console.aws.amazon.com/amplify/
2. **Click "New app" → "Host web app"**
3. **Connect GitHub**: Select `Shockvaluemedia/directfanz-project`
4. **Branch**: Select `main`
5. **Build settings**: Amplify will auto-detect `amplify.yml`
6. **Click "Save and deploy"**

### 2. Configure Environment Variables

In Amplify Console → App Settings → Environment Variables, add:

```
DATABASE_URL=postgresql://postgres:password@your-rds-endpoint:5432/directfanz
NEXTAUTH_SECRET=your-secret-key-change-in-production
NEXTAUTH_URL=https://your-amplify-domain.amplifyapp.com
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket-name
SENDGRID_API_KEY=SG....
FROM_EMAIL=noreply@directfanz.io
REDIS_URL=redis://your-redis-endpoint:6379
```

### 3. Custom Domain Setup

1. **In Amplify Console → Domain management**
2. **Add domain**: `directfanz.io`
3. **Update DNS**: Point to Amplify's provided CNAME
4. **SSL**: Automatically provisioned

### 4. Update Webhook URLs

Update these services to use your new Amplify URL:
- **Stripe webhooks**: `https://your-app.amplifyapp.com/api/webhooks/stripe`
- **NextAuth callbacks**: Update in your OAuth providers

## Benefits of This Migration

✅ **No more Docker complexity**
✅ **Auto-scaling and CDN**
✅ **Zero-downtime deployments**
✅ **Built-in SSL certificates**
✅ **Preview deployments for PRs**
✅ **Cost: ~$15-50/month vs $100+ for ECS**

## Rollback Plan

If needed, your ECS setup is still intact. Just update DNS back to the load balancer.

---

**Next Steps**: Once deployed, test the app and update your domain DNS to point to Amplify.