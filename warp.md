# 🌊 Warp Terminal Guide - DirectFanZ Project

**Updated**: September 2025 | **Version**: 2.0 Enterprise Edition

## 🚀 Quick Start Commands

### Development Server

```bash
# Start development server (Next.js only)
npm run dev:next

# Start with custom server (includes WebSocket & real-time features)
npm run dev

# Check server status
lsof -i :3001
lsof -i :3000

# Health check
npm run health:check
```

### Database Operations

```bash
# Generate Prisma client
npx prisma generate

# Apply database migrations
npx prisma migrate dev

# Seed database with test data
npm run db:seed

# Reset database (dev only)
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio
```

### Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug

# Load and performance testing
npm run test:load
npm run perf:test
npm run perf:test:quick

# System and integration tests
npm run test:system
npm run test:integration
npm run test:smoke

# Full verification suite
npm run verify:all
```

### 🔒 Security & Monitoring Commands

```bash
# Security operations
npm run security:check
npm run security:monitor
npm run validate:secrets

# Staging environment monitoring
npm run staging:health
npm run staging:monitor
npm run staging:security

# Performance monitoring
npm run perf:baseline
npm run perf:monitor
npm run perf:health
```

### 📋 Analytics & Features

```bash
# Analytics system (accessible via /dashboard/artist/analytics)
# - Revenue analytics with growth trends
# - Subscriber analytics and engagement metrics  
# - Content performance tracking
# - Real-time dashboard with filtering

# PWA features
# - Service worker for offline functionality
# - Push notifications support
# - Installation prompts

# Real-time features
# - WebSocket messaging system
# - Live streaming capabilities
# - Real-time notifications
```

## 🔧 Development Workflows

### Starting Fresh Development Session

```bash
# 1. Navigate to project
cd "/Users/demetriusbrooks/DirectFanZ Project"

# 2. Install dependencies (if needed)
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Run health check
npm run health:check

# 5. Start development server (choose one)
npm run dev:next      # Standard Next.js server
npm run dev           # Custom server with WebSocket & real-time features

# 6. Open in browser
open http://localhost:3001
open http://localhost:3000  # If using dev:next

# 7. Access key features
open http://localhost:3001/dashboard/artist/analytics  # Analytics dashboard
open http://localhost:3001/admin                       # Admin panel
open http://localhost:3001/messages                    # Real-time messaging
```

### 🏆 New Enterprise Features Access

```bash
# Analytics Dashboard
open http://localhost:3001/dashboard/artist/analytics
# - Revenue tracking with trends and sparklines
# - Subscriber growth analysis
# - Content performance metrics
# - Interactive charts and filtering

# Real-time Messaging
open http://localhost:3001/messages
# - WebSocket-powered real-time chat
# - Message threads and conversations
# - Online status indicators

# Live Streaming
open http://localhost:3001/studio
# - Stream setup and configuration
# - Stream control panel
# - Viewer interface with HLS support

# Advanced Search & Discovery
open http://localhost:3001/discover
# - AI-powered search with Algolia/Fuse.js
# - Advanced filtering and discovery
# - Content recommendations

# PWA Features
# - Offline functionality via service worker
# - Push notifications (when supported)
# - App installation prompts
```

### Database Management

```bash
# View current database schema
npx prisma db pull

# Create new migration
npx prisma migrate dev --name "your-migration-name"

# Apply migrations to production
npx prisma migrate deploy

# Inspect database
sqlite3 prisma/dev.db ".tables"
```

### 🚀 Multi-Environment Deployment

#### Staging Deployment
```bash
# Quick staging deployment
npm run staging:deploy
npm run staging:quick

# Monitor staging health
npm run staging:health
npm run staging:monitor

# Staging security validation
npm run staging:security
```

#### Production Deployment
```bash
# Pre-deployment checks
npm run verify:all
npm run security:check
npm run perf:validate

# Build application
npm run build

# Full production setup
npm run production:setup
npm run production:deploy

# Production monitoring
npm run production:monitoring
npm run production:backup

# Test production deployment
./scripts/test-production.sh https://yourdomain.com
```

#### 🛑 Enterprise Security & Backup
```bash
# Comprehensive backup system
npm run backup:full          # Complete system backup
npm run backup:code          # Code and configuration
npm run backup:database      # Database backup
npm run backup:list          # List available backups
npm run backup:cleanup       # Clean old backups

# Security infrastructure
npm run security:monitor     # Real-time security monitoring
npm run validate:secrets     # Validate environment secrets
./scripts/setup-branch-protection.sh  # Git security
./scripts/setup-secrets-management.sh # Secrets management

# Incident response ready
# See INCIDENT_RESPONSE_PLAN.md for emergency procedures
# See STAGING_INCIDENT_RESPONSE.md for staging issues
```

## 📊 Monitoring & Debugging

### Server Health Checks

```bash
# Check running processes
ps aux | grep -E "(npm|node|next)" | grep -v grep

# Check port usage
lsof -i :3001
lsof -i :3000

# Kill processes on port
lsof -ti :3001 | xargs kill -9
```

### Log Monitoring

```bash
# Follow application logs (if using PM2)
pm2 logs

# Check system logs (macOS)
log show --predicate 'process == "node"' --last 1h

# Monitor network activity
netstat -an | grep 3001
```

### Performance Monitoring

```bash
# Memory usage
ps aux | grep node | awk '{print $2, $3, $4, $11}'

# Disk usage
du -sh node_modules/
du -sh .next/

# Database size
ls -lh prisma/dev.db
```

## 🧪 Testing & Quality Assurance

### Manual Testing Checklist

```bash
# 1. Test authentication
curl -s http://localhost:3001/api/auth/session

# 2. Test API endpoints
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/artists

# 3. Test database connection
npx prisma db pull

# 4. Test file uploads (if configured)
# Upload test file through UI

# 5. Test real-time features
# Open multiple browser tabs and test messaging
```

### Automated Testing

```bash
# Full test suite
npm run verify:all

# Specific test categories
npm run test:integration
npm run test:smoke
npm run test:system
```

## 🔒 Security Operations

### Security Checks

```bash
# Run security audit
npm audit

# Check for vulnerable dependencies
npm audit fix

# Custom security check
npm run security:check

# Validate environment variables
node -e "console.log(process.env.DATABASE_URL ? 'DB OK' : 'DB Missing')"
```

### Environment Management

```bash
# Copy environment template
cp .env.example .env.local

# Generate secure secrets
openssl rand -base64 32  # NEXTAUTH_SECRET
openssl rand -hex 32     # ENCRYPTION_KEY

# Validate environment
node -e "require('dotenv').config(); console.log('Environment loaded:', !!process.env.DATABASE_URL)"
```

## 📦 Package Management

### Dependency Management

```bash
# Install new dependency
npm install package-name

# Install dev dependency
npm install -D package-name

# Update dependencies
npm update

# Check outdated packages
npm outdated

# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Build Operations

```bash
# Clean build
rm -rf .next
npm run build

# Analyze bundle size
npm run build -- --analyze

# Check build output
ls -la .next/static/
```

## 🚀 Deployment & Production

### Pre-deployment Checklist

```bash
# 1. Run full test suite
npm run verify:all

# 2. Build successfully
npm run build

# 3. Check environment variables
cat .env.example

# 4. Validate database schema
npx prisma validate

# 5. Security check
npm run security:check
```

### Deployment Scripts

```bash
# Full automated deployment
./scripts/deploy-production.sh

# Individual deployment steps
./scripts/setup-railway-db.sh
# Configure S3 (manual)
# Deploy to Vercel (follow guide)
./scripts/migrate-production-db.sh
./scripts/test-production.sh
```

## 📁 Project Structure Quick Reference

### Key Directories

```
src/
├── app/                 # Next.js App Router pages
│   ├── dashboard/artist/analytics/  # Analytics dashboard
│   ├── api/             # API routes with enhanced endpoints
│   ├── admin/           # Admin panel
│   └── messages/        # Real-time messaging
├── components/          # React components
│   ├── analytics/       # Analytics charts and widgets
│   ├── messaging/       # Chat and messaging components
│   ├── streaming/       # Live streaming components
│   ├── pwa/             # PWA components
│   ├── search/          # Advanced search components
│   └── upload/          # File upload components
├── lib/                 # Utility functions
│   ├── socket-server.ts # WebSocket server
│   └── file-upload.ts   # File handling utilities
├── contexts/            # React contexts for state management
├── hooks/               # Custom React hooks
├── types/              # TypeScript definitions
└── styles/             # CSS and styling

prisma/
├── schema.prisma       # Enhanced database schema
├── migrations/         # Database migrations with performance indexes
└── seed.ts            # Database seeding

scripts/
├── monitoring/         # Health monitoring and alerts
│   └── staging-health.js # Staging environment monitoring
├── deploy-production.sh    # Production deployment
├── deploy-staging.js       # Staging deployment
├── backup-system.sh        # Comprehensive backup system
├── security-monitoring.js  # Security monitoring
├── setup-secrets-management.sh # Secrets management
└── setup-branch-protection.sh # Git security

docs/
├── STAGING_INCIDENT_RESPONSE.md # Staging emergency procedures
├── aws-s3-setup.md       # S3 configuration guide
└── vercel-deployment.md  # Vercel deployment guide

.github/
├── workflows/           # CI/CD workflows
│   ├── security.yml     # Security scanning
│   ├── staging-security.yml # Staging security monitoring
│   └── production-deploy.yml # Production deployment
└── dependabot.yml       # Automated dependency updates

monitoring/
└── staging/             # Staging monitoring configuration
    └── health-checks.json # Health check definitions
```

### Important Files

```bash
# Configuration
.env                    # Environment variables
.env.staging           # Staging environment configuration
.env.example           # Environment template
package.json           # Dependencies and scripts (80+ npm scripts)
next.config.js         # Next.js configuration with PWA support
tailwind.config.ts     # Tailwind CSS config
vercel.json            # Vercel deployment configuration

# Database
prisma/dev.db          # SQLite database (dev)
prisma/schema.prisma   # Enhanced database schema

# Security & Operations
INCIDENT_RESPONSE_PLAN.md       # Main incident response procedures
STAGING_INCIDENT_RESPONSE.md    # Staging-specific procedures
AGENT_COORDINATION_PLAN.md      # Multi-agent development coordination
PROJECT_PROTECTION_SUMMARY.md  # Security protections overview
SECRETS_ROTATION_SCHEDULE.md    # Secret rotation schedule

# Documentation
README.md                       # Project README
ANALYTICS_FEATURES.md          # Analytics system documentation
DEPLOYMENT.md                  # Deployment guide
STAGING_COORDINATION_SUMMARY.md # Agent coordination summary
```

## 🎯 Common Tasks

### Add New Feature

```bash
# 1. Create component
mkdir src/components/new-feature
touch src/components/new-feature/index.tsx

# 2. Add API route
touch src/app/api/new-endpoint/route.ts

# 3. Update database schema (if needed)
# Edit prisma/schema.prisma
npx prisma migrate dev --name "add-new-feature"

# 4. Add tests
touch src/components/new-feature/__tests__/index.test.tsx

# 5. Test changes
npm run test
npm run dev:next
```

### Debug Production Issues

```bash
# 1. Check deployment logs
vercel logs <deployment-url>

# 2. Test production endpoints
./scripts/test-production.sh https://yourdomain.com

# 3. Check database connection
# Set production DATABASE_URL
npx prisma db pull

# 4. Validate environment
# Check all required env vars are set in Vercel dashboard
```

## 🎨 Customization

### Update Branding

```bash
# 1. Update colors in Tailwind config
# Edit tailwind.config.js

# 2. Replace logo files
# Update public/logo.* files

# 3. Update metadata
# Edit src/app/layout.tsx

# 4. Rebuild
npm run build
```

---

## 🔗 Quick Links

### Development URLs
- **Main App**: http://localhost:3001
- **Alternative**: http://localhost:3000 (Next.js dev server)
- **API Health**: http://localhost:3001/api/health
- **Prisma Studio**: http://localhost:5555 (run `npx prisma studio`)

### 🏆 Enterprise Features
- **Analytics Dashboard**: http://localhost:3001/dashboard/artist/analytics
- **Admin Panel**: http://localhost:3001/admin
- **Real-time Messaging**: http://localhost:3001/messages  
- **Live Streaming Studio**: http://localhost:3001/studio
- **Advanced Search**: http://localhost:3001/discover
- **Content Upload**: http://localhost:3001/upload-simple

### 📋 Resources
- **Documentation**: Open `docs/` folder
- **Security Docs**: `INCIDENT_RESPONSE_PLAN.md`
- **Analytics Guide**: `ANALYTICS_FEATURES.md`
- **Staging Guide**: `STAGING_COORDINATION_SUMMARY.md`
- **Scripts**: `scripts/` folder (50+ automation scripts)

### 🔍 Staging & Production
- **Staging URL**: https://directfanz-project-staging.vercel.app
- **Production URL**: https://directfanz-project.vercel.app
- **GitHub Actions**: https://github.com/Shockvaluemedia/directfanz-project/actions
- **Monitoring**: `monitoring/staging/health-report.json`

## 📞 Support Commands

```bash
# Get help with any npm script
npm run <script-name> --help

# View available scripts
npm run

# Get Prisma help
npx prisma --help

# Get Next.js help
npx next --help
```

---

## 🏆 Enterprise Edition Features Summary

### 📊 Analytics & Business Intelligence
- **Revenue Analytics**: Growth trends, sparklines, revenue breakdown by source
- **Subscriber Analytics**: Growth tracking, churn analysis, engagement metrics
- **Content Performance**: Views, engagement, content type analysis
- **Interactive Dashboards**: Real-time filtering, date ranges, export capabilities

### 🚀 Real-time & Streaming
- **WebSocket Messaging**: Real-time chat with conversation threads
- **Live Streaming**: HLS streaming with control panels and viewer interface
- **Real-time Notifications**: Instant updates and status indicators
- **Socket.io Integration**: Full real-time communication stack

### 🔍 Advanced Features
- **PWA Support**: Service workers, offline functionality, installation prompts
- **Advanced Search**: AI-powered search with Algolia/Fuse.js integration
- **File Upload System**: Enhanced upload with progress tracking
- **Multi-tier Architecture**: Scalable component structure

### 🛑 Enterprise Security & Operations
- **Multi-environment Support**: Development, staging, production workflows
- **Comprehensive Security**: Rate limiting, input validation, security headers
- **Automated Monitoring**: Health checks, performance monitoring, alerting
- **Backup & Recovery**: Automated backups with encryption and retention policies
- **Incident Response**: Complete incident management with staging-specific procedures
- **Multi-agent Coordination**: Structured development with multiple AI agents

### 📊 Performance & Reliability
- **Performance Monitoring**: Real-time metrics and performance baselines
- **Load Testing**: Comprehensive performance testing suite
- **Database Optimization**: Performance indexes and query optimization
- **CDN Integration**: Optimized content delivery

---

**💡 DirectFanZ Project Enterprise Edition**: This is now a full-featured, enterprise-grade content creator platform with advanced analytics, real-time features, comprehensive security, and professional deployment workflows.

**🔧 Development Teams**: Multi-agent development coordination with security infrastructure and staging environment support.

**🔖 Save this guide** and reference it whenever you're working on the DirectFanZ Project in Warp terminal!
