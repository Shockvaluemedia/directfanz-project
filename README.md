# DirectFanz

A platform that connects independent artists with their superfans through
subscription-based exclusive content access.

## Features

- **Artist Dashboard**: Create subscription tiers, upload exclusive content,
  track earnings
- **Fan Experience**: Discover artists, flexible subscription pricing, access
  exclusive content
- **Secure Payments**: Stripe Connect integration with daily payouts
- **Live Streaming**: Real-time streams with chat, polls, and tips
- **Community Features**: Comments, notifications, messaging, and fan interactions
- **Campaigns & Challenges**: Gamification with leaderboards, submissions, rewards
- **Admin Panel**: User management, content moderation, analytics
- **GDPR Compliance**: Data export, deletion requests, consent tracking

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js API routes + custom server (Socket.IO)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis (ioredis)
- **Payments**: Stripe Connect
- **Storage**: AWS S3 (with optional CloudFront CDN)
- **Authentication**: NextAuth.js
- **Real-time**: Pusher + Socket.IO
- **Deployment**: Docker → AWS ECS (Fargate)

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for Postgres + Redis)

### 1. Clone & install

```bash
git clone https://github.com/Shockvaluemedia/directfanz-project.git
cd directfanz-project
npm ci
```

### 2. Start databases

```bash
docker compose up -d postgres redis
```

### 3. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your keys
```

### 4. Set up database

```bash
npx prisma generate
npx prisma db push
# Optional: seed demo data
npm run db:seed
```

### 5. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## Docker (Full Stack)

```bash
docker compose up --build
```

Services:
- **app**: Next.js application — http://localhost:3000
- **postgres**: PostgreSQL — localhost:5432
- **redis**: Redis — localhost:6379

## Production Deployment (AWS)

The project is configured for AWS ECS (Fargate) deployment.

### Required AWS Resources

| Service | Purpose |
|---------|---------|
| ECS Fargate | Application hosting |
| RDS PostgreSQL | Database |
| ElastiCache Redis | Cache & sessions |
| S3 | Media file storage |
| CloudFront | CDN (optional) |
| ALB | Load balancer & TLS termination |
| ECR | Docker image registry |
| Parameter Store | Secrets management |

### Deploy Steps

1. **Build & push Docker image**:
   ```bash
   docker build -t directfanz .
   # Tag and push to ECR
   ```

2. **Set environment variables** in AWS Parameter Store or ECS task definition.

3. **Run database migrations**:
   ```bash
   npx prisma migrate deploy
   ```

4. **Deploy ECS service** using the provided task definition.

### Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NEXTAUTH_SECRET` | Auth session secret |
| `NEXTAUTH_URL` | Public app URL |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `AWS_S3_BUCKET_NAME` | S3 bucket for media |
| `AWS_REGION` | AWS region |
| `AWS_CLOUDFRONT_DOMAIN` | CloudFront domain (optional) |

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Lint & auto-fix
npm run typecheck    # TypeScript check
npm run test         # Run unit & integration tests
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to DB
npm run db:migrate   # Run migrations
npm run db:seed      # Seed demo data
```

## Project Structure

```
src/
├── app/           # Next.js App Router (pages + API routes)
├── components/    # React components
├── lib/           # Shared utilities, Prisma client, S3, auth
├── hooks/         # React hooks
├── contexts/      # React contexts
├── middleware/     # Rate limiting middleware
├── types/         # TypeScript types
└── styles/        # Global CSS
prisma/            # Prisma schema & migrations
scripts/           # Utility, debug, test, deploy, and DB scripts
e2e/               # Playwright end-to-end tests
tests/             # Jest integration tests
docker/            # Docker-related configs
monitoring/        # Monitoring & alerting configs
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint && npm run typecheck && npm test`
5. Submit a pull request

## License

Proprietary — All rights reserved.
