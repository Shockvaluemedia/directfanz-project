# Deploy DirectFanz to directfanz.io

This guide will help you deploy the DirectFanz application to your domain **directfanz.io**.

---

## Current Situation

- **Domain**: directfanz.io (registered with Hostinger)
- **Issue**: Visiting directfanz.io shows Hostinger's default page
- **Reason**: The DirectFanz app is not deployed/connected yet

---

## Deployment Options

### Option 1: Deploy to Vercel (Recommended - Easiest)

Vercel is the easiest option since this is a Next.js app and Vercel created Next.js.

#### Step 1: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
cd /home/user/directfanz-project
vercel

# Follow prompts:
# - Link to existing project or create new? [Create new]
# - Project name: directfanz
# - Which directory? [./]
# - Override settings? [N]
```

#### Step 2: Add Custom Domain in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your project → Settings → Domains
3. Add domain: `directfanz.io`
4. Vercel will show you DNS records needed

#### Step 3: Update DNS at Hostinger

1. Login to [Hostinger](https://www.hostinger.com)
2. Go to: Domains → directfanz.io → DNS / Name Servers
3. Add the DNS records Vercel provided:

**For apex domain (directfanz.io):**
```
Type: A
Name: @
Value: 76.76.21.21
```

**For www subdomain:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

4. Wait 5-60 minutes for DNS propagation

#### Step 4: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```env
# Database
DATABASE_URL=postgresql://username:password@host:5432/directfanz

# NextAuth.js
NEXTAUTH_SECRET=your-production-secret-64-characters-long
NEXTAUTH_URL=https://directfanz.io

# Stripe (LIVE keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=directfanz-production

# Email
SENDGRID_API_KEY=SG.your_sendgrid_api_key
FROM_EMAIL=noreply@directfanz.io

# Redis (Use Upstash for Vercel)
REDIS_URL=rediss://default:password@host:port

NODE_ENV=production
```

#### Step 5: Setup Database

You'll need a PostgreSQL database. Options:

**Vercel Postgres** (Easiest):
```bash
# In Vercel Dashboard
# Storage → Create Database → Postgres
# Copy DATABASE_URL to environment variables
```

**Neon** (Free tier available):
1. Go to [neon.tech](https://neon.tech)
2. Create project
3. Copy connection string
4. Add to Vercel environment variables

**Run Migrations:**
```bash
# After database is connected
vercel env pull .env.production.local
npx prisma migrate deploy
```

#### Step 6: Verify Deployment

```bash
# Visit your site
curl https://directfanz.io

# Check health endpoint
curl https://directfanz.io/api/health
```

---

### Option 2: Deploy to AWS/Custom Server

If you prefer more control or already have AWS infrastructure:

#### Prerequisites
- EC2 instance or ECS cluster
- Load balancer with SSL certificate
- PostgreSQL database (RDS)
- Redis instance (ElastiCache)
- S3 bucket for uploads

#### Deployment Steps

1. **Build the application:**
```bash
npm run build
```

2. **Set up server with PM2:**
```bash
# On your server
npm install -g pm2
pm2 start npm --name "directfanz" -- start
pm2 save
pm2 startup
```

3. **Configure Nginx reverse proxy:**
```nginx
server {
    listen 80;
    server_name directfanz.io www.directfanz.io;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name directfanz.io www.directfanz.io;

    ssl_certificate /etc/letsencrypt/live/directfanz.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/directfanz.io/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. **Update DNS at Hostinger:**
```
Type: A
Name: @
Value: [Your EC2/Server IP]

Type: A
Name: www
Value: [Your EC2/Server IP]
```

---

### Option 3: Deploy with Docker

If using Docker (recommended for production):

```bash
# Build image
docker build -t directfanz:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  --env-file .env.production \
  --name directfanz \
  directfanz:latest
```

Then configure reverse proxy and DNS as in Option 2.

---

## Post-Deployment Checklist

After deployment, verify:

- [ ] https://directfanz.io loads the DirectFanz homepage (not Hostinger page)
- [ ] Sign in page works at https://directfanz.io/auth/signin
- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] Stripe webhooks configured with production URL
- [ ] SSL certificate active (https://)
- [ ] Email service configured
- [ ] Health check passing: https://directfanz.io/api/health

---

## Configure Stripe Webhooks

After deployment, update Stripe webhooks to use your production domain:

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://directfanz.io/api/webhooks/stripe`
3. Select events (as documented in DEPLOYMENT_GUIDE.md)
4. Copy webhook signing secret
5. Add to environment variables as `STRIPE_WEBHOOK_SECRET`

---

## Troubleshooting

### "Still seeing Hostinger page"
- **Cause**: DNS hasn't propagated yet or pointing to wrong server
- **Fix**: Check DNS with `nslookup directfanz.io` or `dig directfanz.io`
- **Wait**: DNS can take up to 48 hours (usually 5-60 minutes)

### "Page loads but shows errors"
- **Cause**: Environment variables not configured
- **Fix**: Check all required env vars are set in hosting platform

### "Database connection error"
- **Cause**: DATABASE_URL not set or database not accessible
- **Fix**: Verify database connection string and firewall rules

### "SSL/HTTPS issues"
- **Vercel**: Automatically handles SSL
- **Custom server**: Use Let's Encrypt: `certbot --nginx -d directfanz.io`

---

## Quick Start (Fastest Path)

**For the quickest deployment:**

1. **Deploy to Vercel** (5 minutes):
   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```

2. **Add domain in Vercel Dashboard** (2 minutes)

3. **Update DNS at Hostinger** (2 minutes + propagation wait)

4. **Setup Vercel Postgres** (3 minutes):
   - In Vercel Dashboard → Storage → Create Database

5. **Add environment variables** (5 minutes)

6. **Run migrations**:
   ```bash
   vercel env pull
   npx prisma migrate deploy
   ```

**Total active time: ~20 minutes** (+ DNS propagation wait)

---

## Support

If you encounter issues:
- Check Vercel deployment logs
- Verify DNS with `dig directfanz.io`
- Test API endpoints: `curl https://directfanz.io/api/health`

---

**Remember**: The Hostinger page you're seeing is just because directfanz.io isn't pointing to your deployed app yet. Once you complete deployment and update DNS, you'll see the actual DirectFanz application!
