# DirectFanz - Production Deployment Quick Start

## Prerequisites

Before deploying to production, ensure you have:

1. **GitHub Repository**: Your code pushed to GitHub
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **External Services Ready**:
   - PostgreSQL database (Vercel Postgres, Supabase, or AWS RDS)
   - Redis (Upstash recommended for Vercel)
   - AWS S3 bucket for file storage
   - Stripe account (with live keys)
   - SendGrid account for emails
   - (Optional) Sentry account for error tracking

## Quick Start (5 Minutes)

### Option 1: Automated Setup (Recommended)

Run our interactive setup wizard:

```bash
npm run vercel:setup
```

This wizard will:
- Check/install Vercel CLI
- Login to Vercel
- Link your project
- Guide you through environment variable setup
- Run pre-deployment checks
- Deploy to production

### Option 2: Manual Setup

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

#### Step 2: Login to Vercel

```bash
vercel login
```

#### Step 3: Deploy

```bash
vercel --prod
```

Follow the prompts to:
- Link to existing project or create new one
- Select your GitHub repository
- Configure build settings (auto-detected for Next.js)

#### Step 4: Set Environment Variables

Go to your [Vercel Dashboard](https://vercel.com/dashboard):
1. Select your project
2. Go to Settings → Environment Variables
3. Add all required variables (see below)

#### Step 5: Redeploy

After setting environment variables:

```bash
vercel --prod
```

## Required Environment Variables

Copy these from `.env.production.vercel` and update with your actual values:

### Essential
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
NEXTAUTH_SECRET=your-super-secret-key-change-this
NEXTAUTH_URL=https://your-domain.vercel.app
```

### Stripe Payments
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### AWS S3 Storage
```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket
AWS_REGION=us-east-1
```

### Email
```bash
SENDGRID_API_KEY=SG.your-key
FROM_EMAIL=noreply@yourdomain.com
```

### Optional but Recommended
```bash
REDIS_URL=redis://default:pass@host:6379
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=directfanz
SENTRY_AUTH_TOKEN=your-token
```

## Post-Deployment Checklist

### 1. Database Migrations

```bash
# Pull production env vars locally
vercel env pull .env.production

# Run migrations
npx prisma migrate deploy
```

### 2. Update Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Update endpoint URL: `https://your-domain.vercel.app/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 3. Configure Custom Domain

1. In Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records:
   - Type: `A`, Name: `@`, Value: `76.76.19.61`
   - Type: `CNAME`, Name: `www`, Value: `cname.vercel-dns.com`
4. Update `NEXTAUTH_URL` to your custom domain
5. Redeploy

### 4. Test Critical Features

- [ ] User registration and login
- [ ] Payment processing (test with Stripe test mode first)
- [ ] File uploads to S3
- [ ] Email notifications
- [ ] Subscription management
- [ ] Content access control

### 5. Enable Monitoring

- [ ] Enable [Vercel Analytics](https://vercel.com/analytics)
- [ ] Configure [Sentry](https://sentry.io) error tracking
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure alert notifications

## Useful Commands

```bash
# Run pre-deployment checks
npm run vercel:check

# Deploy to production
npm run vercel:deploy

# Deploy preview (for testing)
npm run vercel:preview

# View deployments
vercel ls

# View deployment logs
vercel logs <deployment-url>

# Add environment variable
vercel env add <NAME> production

# Pull environment variables
npm run vercel:env

# View project settings
vercel inspect
```

## Troubleshooting

### Build Failures

1. Check build logs in Vercel dashboard
2. Test build locally: `npm run build`
3. Verify all environment variables are set
4. Check for TypeScript errors: `npm run type-check`

### Runtime Errors

1. Check Function Logs in Vercel dashboard
2. Verify database connection string
3. Ensure all environment variables are set correctly
4. Check external service configurations (S3, Stripe, etc.)

### Performance Issues

1. Enable Vercel Analytics to identify bottlenecks
2. Check database query performance
3. Optimize large API responses
4. Consider using Edge Functions for geo-performance

## Database Recommendations

### Vercel Postgres (Recommended)

- Seamless integration with Vercel
- Automatic connection pooling
- Easy setup via Vercel dashboard
- Built-in pgBouncer

```bash
# Add Vercel Postgres to your project
vercel integration add neon
```

### Supabase (Alternative)

- PostgreSQL with additional features
- Built-in auth and storage
- Real-time subscriptions
- Free tier available

### AWS RDS (For larger scale)

- Fully managed PostgreSQL
- Automatic backups
- Multi-AZ deployment
- Scalable

## Redis Recommendations

### Upstash (Recommended for Vercel)

- Serverless Redis
- Per-request pricing
- Global replication
- Seamless Vercel integration

```bash
# Add Upstash Redis to your project
vercel integration add upstash
```

## Security Checklist

- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Environment variables secured in Vercel
- [ ] Security headers configured (in vercel.json)
- [ ] Stripe webhook signature verification enabled
- [ ] Database connection uses SSL
- [ ] S3 bucket has proper CORS and access policies
- [ ] Rate limiting enabled for API routes
- [ ] Authentication properly configured
- [ ] Sentry for error monitoring

## Performance Optimization

### Vercel Edge Functions

Convert frequently accessed API routes to Edge Functions for better global performance:

```javascript
export const config = {
  runtime: 'edge',
};
```

### Image Optimization

Vercel automatically optimizes images. Ensure you're using Next.js Image component:

```jsx
import Image from 'next/image';

<Image src="/path/to/image.jpg" alt="Description" width={500} height={300} />
```

### Caching Strategy

- Static assets: Cached for 1 year (configured in vercel.json)
- API responses: Use `Cache-Control` headers
- Database queries: Use Redis for frequently accessed data

## Cost Optimization

### Vercel Pricing Tiers

- **Hobby**: Free (good for testing)
  - 100GB bandwidth
  - 100 hours serverless function execution
- **Pro**: $20/month
  - 1TB bandwidth
  - Unlimited serverless execution
  - Advanced analytics
- **Enterprise**: Custom pricing
  - Custom limits
  - SLA guarantees
  - Priority support

### Tips to Reduce Costs

1. Use Edge Functions for high-traffic routes
2. Implement proper caching strategies
3. Optimize database queries
4. Use image optimization
5. Set up database connection pooling
6. Monitor and optimize function execution time

## Next Steps

1. **Set up monitoring**: Configure alerts for errors and downtime
2. **Database backups**: Implement automated backup strategy
3. **Load testing**: Test your application under load
4. **Documentation**: Keep deployment docs updated
5. **CI/CD**: Set up automated testing and deployment
6. **Staging environment**: Create a staging environment for testing

## Support Resources

- **Documentation**: [docs/vercel-deployment.md](./docs/vercel-deployment.md)
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Stripe Docs**: https://stripe.com/docs
- **AWS S3 Guide**: [docs/aws-s3-setup.md](./docs/aws-s3-setup.md)

## Need Help?

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review [Vercel deployment logs](https://vercel.com/docs/concepts/deployments/logs)
3. Consult [detailed deployment guide](./docs/vercel-deployment.md)
4. Contact Vercel support (Pro and Enterprise plans)

---

**🎉 Congratulations on deploying to production!**

Your DirectFanz platform is now live and ready to connect artists with their superfans!
