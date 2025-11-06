# DirectFanZ AI Platform - Complete Deployment Guide

This guide provides step-by-step instructions for deploying the DirectFanZ platform with AI features to production.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- Stripe account with API keys
- OpenAI API access
- Domain name and SSL certificate
- Cloud hosting platform (Vercel, Railway, AWS, etc.)

## Pre-Deployment Checklist

### ✅ 1. Environment Setup
- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Stripe webhooks configured
- [ ] OpenAI API access verified
- [ ] File storage (S3/CloudFront) configured

### ✅ 2. Security Checklist
- [ ] JWT secrets are strong (32+ characters)
- [ ] Database has proper access controls
- [ ] CORS is configured correctly
- [ ] Rate limiting is enabled
- [ ] HTTPS is enforced

### ✅ 3. Code Quality
- [ ] All tests passing
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Performance optimizations applied

## Step-by-Step Deployment

### Step 1: Database Setup

1. **Apply Database Migrations**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

2. **Verify Database Schema**
   ```bash
   npx prisma db pull
   ```

3. **Seed Initial Data (Optional)**
   ```bash
   npx prisma db seed
   ```

### Step 2: Build and Test

1. **Install Dependencies**
   ```bash
   npm ci --production
   ```

2. **Build the Application**
   ```bash
   npm run build
   ```

3. **Run Tests**
   ```bash
   npm test
   npm run test:integration
   ```

4. **Test AI Features**
   ```bash
   node tests/ai-integration.test.js
   ```

### Step 3: Environment Configuration

1. **Create Production Environment File**
   ```bash
   # Copy and modify for production
   cp .env.example .env.production
   ```

2. **Configure Required Variables**
   ```bash
   # Database
   DATABASE_URL="postgresql://user:pass@host:5432/directfanz"
   
   # Authentication
   JWT_SECRET="your-super-secure-64-character-jwt-secret-for-production"
   NEXTAUTH_SECRET="your-nextauth-production-secret"
   NEXTAUTH_URL="https://yourdomain.com"
   
   # Stripe
   STRIPE_SECRET_KEY="sk_live_your_live_stripe_secret_key"
   STRIPE_PUBLISHABLE_KEY="pk_live_your_live_publishable_key"
   STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
   
   # AI Features
   OPENAI_API_KEY="sk-your-openai-api-key"
   OPENAI_MODEL="gpt-4"
   
   # File Storage
   AWS_ACCESS_KEY_ID="your-aws-access-key"
   AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
   AWS_S3_BUCKET="directfanz-content-prod"
   AWS_CLOUDFRONT_DOMAIN="d123456789.cloudfront.net"
   
   # Application
   NODE_ENV="production"
   PORT="3000"
   ```

3. **Validate Environment**
   ```bash
   node scripts/validate-environment.js
   ```

### Step 4: Platform-Specific Deployment

Choose your deployment platform:

#### Option A: Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Configure Vercel Project**
   ```bash
   vercel init
   ```

3. **Set Environment Variables**
   ```bash
   # Add each environment variable
   vercel env add DATABASE_URL production
   vercel env add JWT_SECRET production
   # ... repeat for all variables
   ```

4. **Deploy**
   ```bash
   vercel --prod
   ```

#### Option B: Railway Deployment

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and Create Project**
   ```bash
   railway login
   railway init
   ```

3. **Set Environment Variables**
   ```bash
   railway variables set DATABASE_URL="your-database-url"
   railway variables set JWT_SECRET="your-jwt-secret"
   # ... repeat for all variables
   ```

4. **Deploy**
   ```bash
   railway up
   ```

#### Option C: AWS/DigitalOcean/Custom Server

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   
   # Install Nginx
   sudo apt install nginx
   ```

2. **Upload Application**
   ```bash
   # Clone or upload your built application
   git clone https://github.com/yourusername/directfanz-project.git
   cd directfanz-project
   npm install --production
   ```

3. **Configure PM2**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'directfanz',
       script: 'server.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       env_file: '.env.production'
     }]
   };
   ```

4. **Start Application**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

5. **Configure Nginx**
   ```nginx
   # /etc/nginx/sites-available/directfanz
   server {
       listen 80;
       server_name yourdomain.com;
       return 301 https://$server_name$request_uri;
   }
   
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /path/to/certificate.crt;
       ssl_certificate_key /path/to/private.key;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Enable Site**
   ```bash
   sudo ln -s /etc/nginx/sites-available/directfanz /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### Step 5: External Service Configuration

#### Stripe Webhook Setup

1. **Create Webhook Endpoint**
   - Go to Stripe Dashboard > Webhooks
   - Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
   - Select events: `payment_intent.succeeded`, `subscription.created`, etc.

2. **Configure Webhook Secret**
   ```bash
   # Add to environment variables
   STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
   ```

#### AWS S3 and CloudFront Setup

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://directfanz-content-prod
   ```

2. **Configure Bucket Policy**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::directfanz-content-prod/*"
       }
     ]
   }
   ```

3. **Create CloudFront Distribution**
   - Origin: S3 bucket
   - Cache behaviors: Configure for static content
   - SSL certificate: Use ACM certificate

#### Database Optimization

1. **Connection Pooling**
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=10"
   ```

2. **Database Indexes**
   ```sql
   -- Ensure critical indexes exist
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_artist_status ON content(artistId, status);
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_logs_status ON moderation_logs(status, createdAt);
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_agent_logs_type ON ai_agent_logs(agentType, createdAt);
   ```

### Step 6: Monitoring and Logging

#### Set up Error Tracking (Sentry)

1. **Install Sentry**
   ```bash
   npm install @sentry/node @sentry/profiling-node
   ```

2. **Configure Sentry**
   ```javascript
   // server.js
   const Sentry = require("@sentry/node");
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
   });
   ```

#### Set up Logging

1. **Configure Winston Logger**
   ```javascript
   // utils/logger.js
   const winston = require('winston');
   
   const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.json()
     ),
     transports: [
       new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
       new winston.transports.File({ filename: 'logs/combined.log' })
     ]
   });
   
   if (process.env.NODE_ENV !== 'production') {
     logger.add(new winston.transports.Console({
       format: winston.format.simple()
     }));
   }
   
   module.exports = logger;
   ```

#### Health Check Endpoint

```javascript
// api/health/route.js
export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check OpenAI API
    const openaiCheck = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        openai: openaiCheck.ok ? 'connected' : 'error',
        uptime: process.uptime()
      }
    };
    
    return Response.json(health);
  } catch (error) {
    return Response.json(
      { status: 'unhealthy', error: error.message },
      { status: 503 }
    );
  }
}
```

### Step 7: Performance Optimization

#### Enable Caching

1. **Redis Setup**
   ```javascript
   // utils/cache.js
   const Redis = require('redis');
   const client = Redis.createClient({
     url: process.env.REDIS_URL
   });
   
   const cache = {
     get: async (key) => {
       try {
         const value = await client.get(key);
         return JSON.parse(value);
       } catch (error) {
         console.error('Cache get error:', error);
         return null;
       }
     },
     
     set: async (key, value, ttl = 3600) => {
       try {
         await client.setEx(key, ttl, JSON.stringify(value));
       } catch (error) {
         console.error('Cache set error:', error);
       }
     }
   };
   
   module.exports = cache;
   ```

2. **Database Query Optimization**
   ```javascript
   // Add to your models
   const getUserWithCache = async (userId) => {
     const cacheKey = `user:${userId}`;
     let user = await cache.get(cacheKey);
     
     if (!user) {
       user = await prisma.users.findUnique({
         where: { id: userId },
         select: {
           id: true,
           email: true,
           displayName: true,
           role: true
         }
       });
       
       if (user) {
         await cache.set(cacheKey, user, 1800); // 30 minutes
       }
     }
     
     return user;
   };
   ```

#### Content Delivery Optimization

1. **Image Optimization**
   ```javascript
   // utils/imageOptimizer.js
   const sharp = require('sharp');
   
   const optimizeImage = async (buffer, options = {}) => {
     const {
       width = 1920,
       height = 1080,
       quality = 85,
       format = 'webp'
     } = options;
     
     return sharp(buffer)
       .resize(width, height, { fit: 'inside', withoutEnlargement: true })
       .toFormat(format, { quality })
       .toBuffer();
   };
   ```

### Step 8: Security Hardening

#### Rate Limiting

```javascript
// middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Different limits for different endpoints
const authLimit = createRateLimit(15 * 60 * 1000, 5, 'Too many auth attempts');
const apiLimit = createRateLimit(15 * 60 * 1000, 100, 'Too many API requests');
const uploadLimit = createRateLimit(60 * 60 * 1000, 10, 'Too many upload attempts');

module.exports = { authLimit, apiLimit, uploadLimit };
```

#### Security Headers

```javascript
// middleware/security.js
const helmet = require('helmet');

const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://api.stripe.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

module.exports = securityMiddleware;
```

### Step 9: Testing in Production

#### Smoke Tests

```bash
#!/bin/bash
# scripts/production-test.sh

echo "Running production smoke tests..."

# Test health endpoint
curl -f https://yourdomain.com/api/health || exit 1

# Test AI endpoints
curl -f -H "Authorization: Bearer $TEST_TOKEN" \
     https://yourdomain.com/api/ai || exit 1

# Test Stripe webhook
curl -f -X POST https://yourdomain.com/api/webhooks/stripe \
     -H "stripe-signature: $STRIPE_TEST_SIG" \
     -d '{"type":"payment_intent.succeeded"}' || exit 1

echo "✅ All smoke tests passed!"
```

#### Load Testing

```javascript
// tests/load-test.js
const autocannon = require('autocannon');

const loadTest = autocannon({
  url: 'https://yourdomain.com',
  connections: 10,
  pipelining: 1,
  duration: 10
}, (err, result) => {
  console.log('Load test results:', result);
});
```

### Step 10: Go-Live Checklist

#### Pre-Launch
- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] SSL certificate installed
- [ ] DNS records configured
- [ ] CDN configured
- [ ] Monitoring setup
- [ ] Backup procedures in place
- [ ] Load testing completed

#### Launch
- [ ] Deploy to production
- [ ] Run smoke tests
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify AI features working
- [ ] Test payment processing

#### Post-Launch
- [ ] Monitor logs for errors
- [ ] Check database performance
- [ ] Monitor AI API usage
- [ ] Verify backups running
- [ ] Update documentation
- [ ] Notify stakeholders

## Troubleshooting Common Issues

### Database Connection Issues
```bash
# Check connection
npx prisma db pull

# Fix permission issues
sudo -u postgres createuser --interactive
sudo -u postgres createdb directfanz
```

### Stripe Webhook Failures
```bash
# Test webhook locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Verify signature
echo "Webhook signature: $STRIPE_SIGNATURE"
```

### OpenAI API Errors
```bash
# Test API access
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

### High Memory Usage
```bash
# Monitor memory
htop

# Restart application
pm2 restart directfanz

# Check for memory leaks
node --inspect server.js
```

## Rollback Procedure

If issues arise after deployment:

1. **Immediate Rollback**
   ```bash
   # Revert to previous deployment
   vercel rollback # or platform-specific command
   ```

2. **Database Rollback**
   ```bash
   # If database changes were made
   npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma
   ```

3. **Verify Rollback**
   ```bash
   # Run smoke tests
   bash scripts/production-test.sh
   ```

## Maintenance

### Regular Tasks
- [ ] Update dependencies monthly
- [ ] Rotate secrets quarterly
- [ ] Review logs weekly
- [ ] Performance monitoring daily
- [ ] Database optimization monthly

### Scaling Considerations
- Monitor response times
- Database read replicas
- CDN usage optimization
- AI API rate limiting
- Horizontal scaling preparation

## Support and Documentation

- **Error Tracking**: Check Sentry dashboard
- **Logs**: `/var/log/directfanz/` or cloud logging service
- **Metrics**: Monitor database, API usage, and system resources
- **Updates**: Follow semantic versioning for deployments

For additional support or questions about deployment, consult the development team or create an issue in the project repository.