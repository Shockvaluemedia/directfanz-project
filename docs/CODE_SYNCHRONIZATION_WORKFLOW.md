# DirectFanZ Code Synchronization Workflow

## 🎯 Overview
This document outlines the complete workflow to keep code synchronized across all environments (local, staging, production) for the DirectFanZ platform.

## 📋 Environment Structure

### Local Development
- **Branch**: `feature/*`, `bugfix/*`, `hotfix/*`
- **Database**: Local PostgreSQL
- **Redis**: Local Redis instance
- **URL**: http://localhost:3000
- **Config**: `.env.local`

### Staging Environment
- **Branch**: `staging`
- **Database**: Staging PostgreSQL (Railway/Neon)
- **Redis**: Staging Redis instance
- **URL**: https://staging.directfanz.io
- **Config**: `.env.staging`

### Production Environment
- **Branch**: `main`
- **Database**: Production PostgreSQL
- **Redis**: Production Redis instance
- **URL**: https://directfanz.io
- **Config**: Environment variables in deployment platform

## 🔄 Git Workflow (GitFlow)

### Branch Structure
```
main (production)
├── staging (staging environment)
├── develop (integration branch)
├── feature/new-feature
├── bugfix/fix-issue
└── hotfix/critical-fix
```

### Daily Workflow
1. **Start New Feature**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Work and Commit**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**
   - Target: `develop` branch
   - Include: description, screenshots, testing notes
   - Auto-runs: tests, linting, security checks

4. **Merge to Staging**
   ```bash
   git checkout staging
   git merge develop
   git push origin staging
   ```
   - Auto-deploys to staging environment
   - Runs full test suite

5. **Production Release**
   ```bash
   git checkout main
   git merge staging
   git tag v1.x.x
   git push origin main --tags
   ```
   - Auto-deploys to production
   - Runs smoke tests
   - Creates deployment notification

## 🚀 Automated Deployment Pipeline

### On Pull Request
- ✅ Run linting and type checking
- ✅ Run unit tests
- ✅ Run security audit
- ✅ Deploy preview environment
- ✅ Run E2E tests against preview

### On Merge to Staging
- ✅ Deploy to staging environment
- ✅ Run database migrations
- ✅ Update Redis cache
- ✅ Run integration tests
- ✅ Send Slack/Discord notification

### On Merge to Main
- ✅ Deploy to production (blue-green)
- ✅ Run database migrations
- ✅ Update Redis cache
- ✅ Run smoke tests
- ✅ Monitor health checks
- ✅ Send deployment notification
- ✅ Auto-rollback on failure

## 📊 Database & Cache Synchronization

### Database Migrations
```bash
# Local development
npm run db:migrate

# Staging (automated)
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Production (automated)
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

### Redis Cache Management
```bash
# Clear cache on deployment
npm run cache:clear

# Warm critical caches
npm run cache:warm
```

### Environment Data Sync
```bash
# Sync staging data to local (sanitized)
npm run db:sync:staging-to-local

# Backup production data
npm run db:backup:production
```

## 🔧 Daily Commands

### Developer Workflow
```bash
# Start work day
git checkout develop
git pull origin develop
npm install  # if package.json changed
npm run db:generate  # if schema changed

# Before committing
npm run lint:fix
npm run test
npm run type-check

# Commit and push
git add .
git commit -m "feat: your change description"
git push origin your-branch
```

### Environment Updates
```bash
# Update local environment
git pull origin develop
npm install
npm run db:migrate
npm run dev

# Check staging deployment
curl https://staging.directfanz.io/api/health

# Check production deployment  
curl https://directfanz.io/api/health
```

## 📱 Mobile App Synchronization

### React Native (DirectFanzMobile)
```bash
# Update mobile dependencies
cd DirectFanzMobile
npm install

# Build and test
npm run android  # or npm run ios
npm run test
```

## 🔍 Monitoring & Health Checks

### Automated Monitoring
- **Application health**: `/api/health`
- **Database health**: `/api/health/db`
- **Redis health**: `/api/health/redis`
- **Performance metrics**: `/api/metrics`

### Manual Checks
```bash
# Check all environments health
npm run health:check:all

# Monitor performance
npm run perf:monitor

# Check deployment status
npm run deploy:status
```

## 🚨 Emergency Procedures

### Hotfix Process
```bash
# Critical bug in production
git checkout main
git checkout -b hotfix/critical-issue
# Make fix
git commit -m "hotfix: fix critical issue"
git push origin hotfix/critical-issue
# Create PR to main (emergency approval)
```

### Rollback Process
```bash
# Automatic rollback (if health checks fail)
npm run deploy:rollback

# Manual rollback
git revert HEAD
git push origin main
```

### Recovery Process
```bash
# Restore from backup
npm run backup:restore:production

# Reset Redis cache
npm run cache:clear:all
npm run cache:warm:critical
```

## 📋 Pre-deployment Checklist

- [ ] All tests passing locally
- [ ] Database migrations tested
- [ ] Environment variables updated
- [ ] Redis cache strategy verified
- [ ] Mobile app compatibility checked
- [ ] Performance impact assessed
- [ ] Security audit completed
- [ ] Monitoring alerts configured

## 🔗 Useful Commands Reference

### Git Commands
```bash
# Quick status check
git status --porcelain

# Sync with remote
git fetch origin
git status

# Clean merge
git checkout develop
git pull origin develop
git checkout your-branch
git rebase develop
```

### Environment Commands
```bash
# Environment health
npm run health:check

# Database status
npm run db:status

# Performance check
npm run perf:baseline

# Security audit
npm run security:check
```

### Deployment Commands
```bash
# Deploy staging
npm run deploy:staging

# Deploy production
npm run deploy:production

# Check deployment
npm run deploy:verify
```

## 📞 Support & Resources

- **GitHub Repository**: https://github.com/Shockvaluemedia/directfanz-project
- **Staging Environment**: https://staging.directfanz.io
- **Production Environment**: https://directfanz.io
- **Monitoring Dashboard**: https://directfanz.io/admin/monitoring
- **Documentation**: `/docs` folder in repository

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Maintainer**: Development Team