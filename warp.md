# 🌊 Warp Terminal Guide - Direct Fan Platform

## 🚀 Quick Start Commands

### Development Server

```bash
# Start development server
npm run dev:next

# Start with custom server (includes WebSocket)
npm run dev

# Check server status
lsof -i :3001
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

# Run load testing
npm run test:load

# Security check
npm run security:check
```

## 🔧 Development Workflows

### Starting Fresh Development Session

```bash
# 1. Navigate to project
cd "/Users/demetriusbrooks/Nahvee Even"

# 2. Install dependencies (if needed)
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Start development server
npm run dev:next

# 5. Open in browser
open http://localhost:3001
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

### Production Deployment

```bash
# Build application
npm run build

# Deploy using automated script
./scripts/deploy-production.sh

# Set up Railway database
./scripts/setup-railway-db.sh

# Test production deployment
./scripts/test-production.sh https://yourdomain.com
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
├── components/          # React components
├── lib/                 # Utility functions
├── types/              # TypeScript definitions
└── styles/             # CSS and styling

prisma/
├── schema.prisma       # Database schema
├── migrations/         # Database migrations
└── seed.ts            # Database seeding

scripts/
├── deploy-production.sh    # Deployment automation
├── test-production.sh     # Production testing
└── setup-railway-db.sh   # Database setup

docs/
├── aws-s3-setup.md       # S3 configuration guide
└── vercel-deployment.md  # Vercel deployment guide
```

### Important Files

```bash
# Configuration
.env                    # Environment variables
.env.example           # Environment template
package.json           # Dependencies and scripts
next.config.js         # Next.js configuration
tailwind.config.js     # Tailwind CSS config

# Database
prisma/dev.db          # SQLite database (dev)
prisma/schema.prisma   # Database schema

# Documentation
README.md              # Project README
DEPLOYMENT_SUMMARY.md  # Deployment guide
PRODUCTION_CHECKLIST.md # Production checklist
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

- **Local App**: http://localhost:3001
- **Prisma Studio**: http://localhost:5555 (run `npx prisma studio`)
- **API Health**: http://localhost:3001/api/health
- **Documentation**: Open `docs/` folder
- **Deployment Scripts**: `scripts/` folder

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

**💡 Pro Tip**: Save this file and reference it whenever you're working on the
Direct Fan Platform in Warp terminal!
