# DirectFanZ AI Features - Environment Configuration Guide

This guide covers all environment variables and configuration required for deploying the DirectFanZ platform with AI features.

## Required Environment Variables

### Core Application
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/directfanz"
DIRECT_URL="postgresql://username:password@localhost:5432/directfanz"

# Authentication
JWT_SECRET="your-super-secure-jwt-secret-key"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"  # Change to production URL

# Application
NODE_ENV="production"  # or "development"
PORT="3000"
```

### Stripe Configuration
```bash
# Stripe API Keys
STRIPE_PUBLISHABLE_KEY="pk_live_..." # or pk_test_ for testing
STRIPE_SECRET_KEY="sk_live_..." # or sk_test_ for testing
STRIPE_WEBHOOK_SECRET="whsec_..."

# Stripe Connect (for artist payouts)
STRIPE_CLIENT_ID="ca_..."
```

### AI and Content Processing
```bash
# OpenAI (for AI features)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4" # or gpt-3.5-turbo for cost optimization

# Content Analysis (optional - for enhanced AI moderation)
GOOGLE_VISION_API_KEY="your-google-vision-api-key"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"

# Image Processing
SHARP_CACHE_SIZE="50" # MB
SHARP_CONCURRENCY="4" # Number of concurrent operations
```

### File Storage
```bash
# AWS S3 (recommended for production)
AWS_S3_BUCKET="directfanz-content"
AWS_S3_REGION="us-east-1"
AWS_CLOUDFRONT_DOMAIN="d123456789.cloudfront.net"

# Alternative: Local storage (development only)
UPLOAD_DIR="/uploads"
MAX_FILE_SIZE="100" # MB
```

### Email Configuration
```bash
# SMTP Settings (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
EMAIL_FROM="noreply@directfanz.com"
```

### Redis (for caching and rate limiting)
```bash
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD="" # Leave empty if no password
```

### Monitoring and Logging
```bash
# Application Monitoring
SENTRY_DSN="https://your-sentry-dsn"
LOG_LEVEL="info" # debug, info, warn, error

# Analytics
GOOGLE_ANALYTICS_ID="GA_MEASUREMENT_ID"
```

## Configuration Files

### 1. Create `.env` file
```bash
# Copy from .env.example
cp .env.example .env

# Edit with your values
nano .env
```

### 2. Create `.env.local` for Next.js (if using Next.js)
```bash
# Next.js specific environment variables
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

### 3. Docker Configuration (if using Docker)
Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: directfanz
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}

volumes:
  postgres_data:
```

## AI Features Configuration

### OpenAI Configuration
```bash
# Model selection based on needs and budget
OPENAI_MODEL="gpt-4"              # Best quality, higher cost
# OPENAI_MODEL="gpt-3.5-turbo"    # Good quality, lower cost

# AI Processing limits
AI_MAX_TOKENS="2000"
AI_TEMPERATURE="0.3"
AI_MAX_REQUESTS_PER_HOUR="100"
```

### Content Moderation Settings
```bash
# Moderation thresholds (0-1 scale)
MODERATION_NSFW_THRESHOLD="0.8"
MODERATION_VIOLENCE_THRESHOLD="0.8"
MODERATION_HATE_SPEECH_THRESHOLD="0.7"

# Auto-moderation actions
AUTO_MODERATE_HIGH_RISK="true"
AUTO_APPROVE_LOW_RISK="false"
REQUIRE_HUMAN_REVIEW_THRESHOLD="0.5"
```

### Revenue Optimization Settings
```bash
# Pricing optimization
PRICING_TEST_DURATION_DAYS="7"
MIN_PRICE_CHANGE_PERCENT="5"
MAX_PRICE_CHANGE_PERCENT="25"

# A/B testing
AB_TEST_SPLIT_RATIO="0.5"
MIN_SAMPLE_SIZE="100"
```

## Production Deployment Checklist

### 1. Security Configuration
- [ ] Generate strong JWT secrets (32+ characters)
- [ ] Use environment-specific Stripe keys
- [ ] Enable HTTPS in production
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable SQL injection protection

### 2. Database Configuration
- [ ] Use connection pooling
- [ ] Set up database backups
- [ ] Configure read replicas (if needed)
- [ ] Optimize database indexes
- [ ] Set up monitoring

### 3. File Storage
- [ ] Configure CDN (CloudFront)
- [ ] Set up proper S3 bucket policies
- [ ] Enable file versioning
- [ ] Configure automatic cleanup

### 4. Monitoring Setup
- [ ] Configure error tracking (Sentry)
- [ ] Set up performance monitoring
- [ ] Configure log aggregation
- [ ] Set up health checks
- [ ] Configure alerts

### 5. AI Services
- [ ] Validate OpenAI API access
- [ ] Test content moderation pipeline
- [ ] Configure AI rate limits
- [ ] Set up fallback mechanisms

## Environment Validation Script

Create `scripts/validate-environment.js`:
```javascript
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'OPENAI_API_KEY',
];

const optionalEnvVars = [
  'REDIS_URL',
  'AWS_ACCESS_KEY_ID',
  'SENTRY_DSN',
];

function validateEnvironment() {
  const missing = [];
  const warnings = [];

  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  optionalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`  - ${varName}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Missing optional environment variables:');
    warnings.forEach(varName => console.warn(`  - ${varName}`));
  }

  console.log('✅ Environment validation passed');
}

if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment };
```

Run validation:
```bash
node scripts/validate-environment.js
```

## Platform-Specific Deployment

### Vercel
1. Add environment variables in Vercel dashboard
2. Configure build settings:
   ```json
   {
     "buildCommand": "npm run build",
     "devCommand": "npm run dev",
     "installCommand": "npm install"
   }
   ```

### Railway
1. Add environment variables in Railway dashboard
2. Configure `railway.json`:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "numReplicas": 1,
       "sleepApplication": false
     }
   }
   ```

### AWS/DigitalOcean
1. Use environment files or parameter store
2. Configure load balancer health checks
3. Set up auto-scaling groups
4. Configure database connections

## Testing Environment Setup

For testing, create `.env.test`:
```bash
DATABASE_URL="postgresql://test:test@localhost:5432/directfanz_test"
JWT_SECRET="test-secret-key"
STRIPE_SECRET_KEY="sk_test_..."
OPENAI_API_KEY="mock-openai-key"
NODE_ENV="test"
```

## Performance Optimization

### Database Connection Pooling
```bash
# Prisma connection pooling
DATABASE_POOL_SIZE="10"
DATABASE_CONNECTION_TIMEOUT="5000"
DATABASE_POOL_TIMEOUT="10000"
```

### Caching Configuration
```bash
# Redis caching
CACHE_TTL_SECONDS="3600"
CACHE_MAX_MEMORY="256mb"
CACHE_EVICTION_POLICY="allkeys-lru"
```

### File Processing
```bash
# Image processing optimization
IMAGE_QUALITY="85"
IMAGE_MAX_WIDTH="2048"
IMAGE_MAX_HEIGHT="2048"
THUMBNAIL_SIZE="300"

# Video processing
VIDEO_MAX_BITRATE="5000k"
VIDEO_MAX_DURATION_SECONDS="300"
```

## Troubleshooting Common Issues

### Database Connection Issues
```bash
# Check connection
npx prisma db pull

# Reset if needed
npx prisma migrate reset
npx prisma db push
```

### Stripe Webhook Issues
```bash
# Test webhook locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### AI API Issues
```bash
# Test OpenAI connection
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

## Security Best Practices

1. **Never commit secrets to version control**
2. **Use different keys for different environments**
3. **Rotate secrets regularly**
4. **Monitor for leaked credentials**
5. **Use least-privilege access principles**
6. **Enable audit logging**

For additional support, consult the deployment documentation or contact the development team.