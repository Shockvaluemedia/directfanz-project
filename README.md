# DirectFanz

A platform that connects independent artists with their superfans through
subscription-based exclusive content access.

## Deployment

DirectFanz web deploys on AWS architecture. Use [Deployment](docs/deployment.md) as the single source of truth for production, rollback, smoke checks, and required secrets.

## Features

- **Artist Dashboard**: Create subscription tiers, upload exclusive content,
  track earnings
- **Fan Experience**: Discover artists, flexible subscription pricing, access
  exclusive content
- **Secure Payments**: Stripe integration with daily payouts
- **Community Features**: Comments, notifications, and fan interactions

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Payments**: Stripe Connect
- **Storage**: AWS S3 (for production)
- **Authentication**: NextAuth.js

## Docker Setup

### Prerequisites

- Docker and Docker Compose installed on your system
- Git (to clone the repository)

### Quick Start

1. **Clone the repository** (if not already done):

   ```bash
   git clone https://github.com/your-username/directfanz-project-project.git
   cd directfanz-project-project
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` with your configuration values.

3. **Start the application with Docker**:

   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - Main app: http://localhost:3000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379
   - pgAdmin: http://localhost:5050 (admin@directfanz.io / admin)

### Docker Services

- **app**: Next.js application (port 3000)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)
- **pgadmin**: Database management interface (port 5050)

### Development Commands

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs app

# Access app container shell
docker-compose exec app sh

# Access database
docker-compose exec postgres psql -U postgres -d direct_fan_platform
```

### Database Setup

The database will be automatically initialized when you first run
`docker-compose up`. The schema will be created using Prisma migrations.

To run database operations:

```bash
# Generate Prisma client
docker-compose exec app npm run db:generate

# Push schema to database
docker-compose exec app npm run db:push

# Run migrations
docker-compose exec app npm run db:migrate

# Seed database
docker-compose exec app npm run db:seed
```

## Environment Variables

Key environment variables you need to configure in `.env.local`:

```env
# Database (automatically configured for Docker)
DATABASE_URL="postgresql://postgres:password@postgres:5432/directfanz"

# Redis (automatically configured for Docker)
REDIS_URL="redis://redis:6379"

# NextAuth.js
NEXTAUTH_SECRET="your-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Stripe (required for payments)
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# AWS S3 (required for file uploads)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_S3_BUCKET_NAME="your-bucket-name"

# SendGrid (required for emails)
SENDGRID_API_KEY="SG...."
FROM_EMAIL="noreply@directfanz.io"
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: If ports 3000, 5432, 6379, or 5050 are already in use,
   modify the ports in `docker-compose.yml`

2. **Database connection issues**: Ensure PostgreSQL service is running:

   ```bash
   docker-compose logs postgres
   ```

3. **Node modules issues**: If you encounter module-related errors, rebuild the
   container:

   ```bash
   docker-compose down
   docker-compose up --build
   ```

4. **Permission issues**: On Linux/Mac, you might need to adjust file
   permissions:
   ```bash
   sudo chown -R $USER:$USER .
   ```

### Logs and Debugging

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs app
docker-compose logs postgres
docker-compose logs redis

# Follow logs in real-time
docker-compose logs -f app
```

## Production Deployment

Use [Deployment](docs/deployment.md). Legacy Vercel, Amplify, Railway, Render, and older Docker production notes are archived under `docs/archive/deployment/` and are not active operating instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker
5. Submit a pull request

## License

[Your License Here]
