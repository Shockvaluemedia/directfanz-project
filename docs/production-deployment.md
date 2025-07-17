# Production Deployment Guide

This document provides instructions for deploying the Direct-to-Fan Platform to production environments.

## Prerequisites

- Vercel account with appropriate permissions
- AWS account with S3 bucket configured
- Stripe account with Connect enabled
- SendGrid account for email notifications
- PostgreSQL database (Vercel Postgres or external provider)
- Redis instance (Upstash Redis or external provider)
- Sentry account for error tracking

## Environment Variables

The following environment variables must be configured in your Vercel project settings:

### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@host:5432/database` |

### Redis Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://username:password@host:port` |

### Authentication

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | Secret key for JWT tokens | `your-secure-secret-key` |
| `NEXTAUTH_URL` | Base URL of your application | `https://your-app.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (optional) | `your-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (optional) | `your-google-client-secret` |
| `FACEBOOK_CLIENT_ID` | Facebook OAuth client ID (optional) | `your-facebook-client-id` |
| `FACEBOOK_CLIENT_SECRET` | Facebook OAuth client secret (optional) | `your-facebook-client-secret` |

### Stripe Integration

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |

### AWS S3 Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key ID | `your-access-key-id` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | `your-secret-access-key` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | `your-bucket-name` |

### Email Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `SENDGRID_API_KEY` | SendGrid API key | `SG.your-api-key` |
| `FROM_EMAIL` | Email address for sending notifications | `noreply@your-app.com` |

### CDN Configuration (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `CDN_URL` | CDN base URL | `https://cdn.your-app.com` |
| `CDN_DOMAIN` | CDN domain for CORS configuration | `cdn.your-app.com` |

### Application Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Public URL of your application | `https://your-app.com` |
| `NEXT_PUBLIC_APP_VERSION` | Application version | `1.0.0` |

### Sentry Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for client-side error tracking | `https://...@sentry.io/...` |
| `SENTRY_ORG` | Sentry organization slug | `your-org` |
| `SENTRY_PROJECT` | Sentry project slug | `your-project` |
| `SENTRY_AUTH_TOKEN` | Sentry authentication token | `your-auth-token` |

## Deployment Steps

### 1. Database Setup

Before deploying, ensure your production database is properly set up:

```bash
# Apply migrations to production database
DATABASE_URL=your_production_db_url npx prisma migrate deploy

# Seed initial data if needed
DATABASE_URL=your_production_db_url npx prisma db seed
```

### 2. Vercel Deployment

You can deploy to Vercel using one of the following methods:

#### Using the Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Using GitHub Integration

1. Connect your GitHub repository to Vercel
2. Configure environment variables in the Vercel project settings
3. Deploy from the Vercel dashboard or automatically via GitHub actions

### 3. Post-Deployment Verification

After deployment, verify that your application is working correctly:

1. Check the health endpoint: `https://your-app.com/api/health`
2. Run performance tests: `APP_URL=https://your-app.com node scripts/performance-test.js`
3. Verify Stripe webhooks are properly configured
4. Test user authentication flows
5. Verify file uploads and content delivery

### 4. Monitoring Setup

Set up monitoring for your production environment:

1. Configure Sentry for error tracking
2. Set up Vercel Analytics for performance monitoring
3. Configure alerts for critical errors
4. Set up uptime monitoring with a service like UptimeRobot or Pingdom

## Automated Deployment

You can use the provided GitHub Actions workflow for automated CI/CD:

1. Add the required secrets to your GitHub repository:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `VERCEL_SCOPE`
   - Test credentials for running tests

2. Push to the main branch to trigger a production deployment

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify that the `DATABASE_URL` is correct
   - Check that the database is accessible from Vercel's network
   - Ensure the database user has the necessary permissions

2. **Redis Connection Errors**
   - Verify that the `REDIS_URL` is correct
   - Check Redis instance status and connectivity

3. **Stripe Webhook Failures**
   - Verify the webhook endpoint is correctly configured in Stripe
   - Check that the `STRIPE_WEBHOOK_SECRET` is correct
   - Ensure the webhook URL is publicly accessible

4. **S3 Upload Issues**
   - Verify AWS credentials and permissions
   - Check S3 bucket CORS configuration
   - Ensure the bucket policy allows the necessary operations

### Getting Help

If you encounter issues during deployment, check:

1. Application logs in the Vercel dashboard
2. Error reports in Sentry
3. Database and Redis connection logs
4. GitHub Actions workflow logs for CI/CD issues

## Maintenance

### Regular Maintenance Tasks

1. **Database Maintenance**
   - Regularly backup the database
   - Monitor database performance and optimize queries
   - Apply security updates

2. **Dependency Updates**
   - Regularly update npm packages for security fixes
   - Test thoroughly after updates

3. **Monitoring**
   - Review error logs and fix recurring issues
   - Monitor performance metrics and optimize as needed
   - Check system health regularly

### Scaling Considerations

As your user base grows, consider:

1. Upgrading database and Redis plans
2. Implementing more aggressive caching strategies
3. Optimizing API endpoints for performance
4. Using CDN for static assets and media delivery