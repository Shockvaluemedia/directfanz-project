# Nahvee Even - Direct Fan Platform

A comprehensive direct fan platform built with Next.js, Prisma, and modern web technologies.

## 🚀 Quick Start

### Development Server
```bash
# Start development server with custom Node.js server
npm run dev

# Start Next.js development server only
npm run dev:next
```

### Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Create and run migrations
npm run db:migrate

# Seed database with test data
npm run db:seed

# Open Prisma Studio (database browser)
npx prisma studio
```

## 👥 Test Accounts

### Artists
```
Email: indie.artist@example.com
Password: password123
Status: Stripe onboarded, 3 tiers, 2 content pieces

Email: electronic.producer@example.com  
Password: password123
Status: Not onboarded, 1 tier, no content
```

### Fans
```
Email: music.lover@example.com
Password: password123
Subscription: Basic Support ($10/month)

Email: superfan@example.com
Password: password123  
Subscription: Premium Fan ($25/month)
```

## 🧪 Testing

### Unit & Integration Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### End-to-End Tests
```bash
# Run Playwright tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug

# Show test report
npm run test:e2e:report
```

### System Tests
```bash
# Run integration tests
npm run test:integration

# Run load tests
npm run test:load

# Run system tests
npm run test:system

# Run smoke tests
npm run test:smoke

# Run security checks
npm run security:check

# Run all verification tests
npm run verify:all
```

## 🏗️ Build & Deployment

### Build Commands
```bash
# Build for production
npm run build

# Start production server
npm run start

# Start Next.js production server
npm run start:next
```

### Deployment Options
```bash
# Setup deployment infrastructure
npm run deploy:setup

# Deploy to Vercel
npm run deploy:vercel

# Deploy to AWS
npm run deploy:aws

# Deploy with Docker
npm run deploy:docker

# Rollback Docker deployment
npm run deploy:rollback
```

### Infrastructure Management
```bash
# Initialize Terraform
npm run infrastructure:init

# Plan infrastructure changes
npm run infrastructure:plan

# Apply infrastructure changes
npm run infrastructure:apply

# Destroy infrastructure
npm run infrastructure:destroy
```

## 📊 Monitoring & Analytics

### Setup Monitoring
```bash
# Setup monitoring stack
npm run monitoring:setup

# Start monitoring services
npm run monitoring:start

# Stop monitoring services
npm run monitoring:stop

# View monitoring logs
npm run monitoring:logs
```

## 💾 Backup & Recovery

### Backup Operations
```bash
# Backup database
npm run backup:db

# Backup files
npm run backup:files

# Full system backup
npm run backup:full

# Restore from backup
npm run backup:restore

# Run automated backup
npm run backup:automated

# Cleanup old backups
npm run backup:cleanup
```

## 🚀 Production Workflows

### Complete Production Setup
```bash
# Setup everything for production
npm run production:setup

# Deploy to production
npm run production:deploy

# Start production monitoring
npm run production:monitoring

# Backup production data
npm run production:backup
```

## 📂 Project Structure

```
├── src/
│   ├── app/                 # Next.js 13+ App Router
│   │   ├── api/             # API routes
│   │   ├── (auth)/          # Authentication pages
│   │   ├── (dashboard)/     # Dashboard pages
│   │   └── globals.css      # Global styles
│   ├── components/          # React components
│   ├── lib/                 # Utility libraries
│   └── hooks/               # Custom React hooks
├── prisma/                  # Database schema & migrations
├── scripts/                 # Build & deployment scripts
├── e2e/                     # End-to-end tests
├── monitoring/              # Monitoring configurations
└── infrastructure/          # Infrastructure as Code
```

## 🔧 Development Tools

### Code Quality
```bash
# Run ESLint
npm run lint

# Format code
npx prettier --write .

# Type checking
npx tsc --noEmit
```

### Database Tools
```bash
# Reset database (caution!)
npx prisma migrate reset

# Format Prisma schema
npx prisma format

# Pull database schema
npx prisma db pull

# View database
npx prisma studio --port 5555
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `GET /api/auth/session` - Get current session
- `POST /api/auth/change-password` - Change password

### User Management  
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Content Management
- `GET /api/content` - List content with filters
- `POST /api/content/upload` - Upload content with metadata
- `PUT /api/content?id={id}` - Update content metadata
- `DELETE /api/content?id={id}` - Delete content

### Subscriptions & Tiers
- `GET /api/artist/tiers` - Get artist tiers
- `POST /api/artist/tiers` - Create new tier
- `GET /api/fan/subscriptions` - Get fan subscriptions

### Real-time Features
- `GET /api/ws` - WebSocket/SSE connection
- `POST /api/ws` - Send real-time messages

## 🔐 Environment Variables

### Required for Development
```bash
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

### Required for Production
```bash
DATABASE_URL="postgresql://..."
STRIPE_SECRET_KEY="sk_live_..."
AWS_ACCESS_KEY_ID="..."
SENDGRID_API_KEY="SG...."
```

## 🐳 Docker Commands

### Development
```bash
# Build development image
docker build -f Dockerfile -t nahvee-even:dev .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### Production
```bash
# Build production image
docker build -f Dockerfile.production -t nahvee-even:prod .

# Run production stack
docker-compose -f docker-compose.production.yml up -d

# Run monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d
```

## 🔍 Debugging

### Common Issues
```bash
# Clear Next.js cache
rm -rf .next

# Clear node modules and reinstall
rm -rf node_modules package-lock.json && npm install

# Reset database
npm run db:seed

# Check database connection
npx prisma db execute --stdin <<< "SELECT 1;"
```

### Logs & Monitoring
```bash
# View application logs
tail -f logs/application.log

# View database logs
npx prisma studio

# Monitor performance
npm run monitoring:start
```

## 📚 Useful Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Stripe API](https://stripe.com/docs/api)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Make changes and test: `npm run verify:all`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Create Pull Request

## 📞 Support

For issues or questions:
- Check existing documentation
- Run `npm run verify:all` to diagnose issues
- Review logs in monitoring dashboard
- Create issue with reproduction steps

---
**Built with ❤️ for artists and their fans**