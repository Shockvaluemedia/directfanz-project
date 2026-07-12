# DirectFanz

A platform that connects independent artists with their superfans through
subscription-based exclusive content access.

> **Production status:** DirectFanz is **not yet launch-ready.** A production
> trust sprint has stabilized the build, tests, CI, and several security holes,
> but launch blockers remain (see
> [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)). Do not treat any
> older doc that claims "PRODUCTION READY", "LIVE", or "COMPLETE" as accurate —
> `PRODUCTION_READINESS.md` and this README are the authoritative status.

## Features

- **Artist dashboard** — create subscription tiers, upload exclusive content, track earnings
- **Fan experience** — discover artists, subscribe, access gated content
- **Payments** — Stripe subscriptions and webhooks
- **Community** — comments, notifications, messaging

## Tech stack (the real one)

| Concern        | Technology                                             |
| -------------- | ------------------------------------------------------ |
| Framework      | Next.js 14 (App Router), React 18, TypeScript          |
| Styling        | Tailwind CSS                                            |
| Database       | PostgreSQL via Prisma ORM                              |
| Cache / limits | Redis (`ioredis`; Upstash on Vercel)                   |
| File storage   | **Vercel Blob** (`@vercel/blob`)                        |
| Payments       | Stripe                                                  |
| Email          | SendGrid (`@sendgrid/mail`)                             |
| Auth           | NextAuth.js (JWT sessions)                              |
| Hosting        | **Vercel** (this is the one supported deploy target)   |

> The repo also contains AWS/ECS/Docker/Terraform files from an earlier
> exploration. **They are legacy and not the supported path** — the application
> imports `@vercel/blob` (there is no AWS SDK dependency), `next.config.js`
> only whitelists `*.public.blob.vercel-storage.com`, and `vercel.json` +
> `.github/workflows/vercel-deploy.yml` are the real deploy config. Ignore the
> AWS/Docker docs until they are archived.

## Local development

Requires Node.js 20+, a PostgreSQL database, and (optionally) a Redis instance.

```bash
npm install                 # install dependencies
cp .env.example .env.local  # then fill in the values below
npm run db:generate         # generate the Prisma client
npm run db:push             # apply the schema to your dev database
npm run dev                 # start the dev server on http://localhost:3000
```

### Quality gates (run these before pushing)

```bash
npm run typecheck    # tsc --noEmit
npm run lint:check   # next lint (no autofix)
npm test             # jest unit + integration suites
npm audit            # dependency vulnerabilities
npm run build        # production build
```

CI (`.github/workflows/ci-cd.yml`) runs the same gates on `integration-testing`
and `main`.

## Environment variables

Copy `.env.example` and fill in real values. The essentials:

```env
# Core (required — the app will not run without these)
DATABASE_URL="postgresql://user:password@host:5432/directfanz"
NEXTAUTH_SECRET="<32+ char random string>"     # openssl rand -base64 32
NEXTAUTH_URL="https://your-domain.com"          # must be HTTPS in production
JWT_SECRET="<32+ char random string>"

# Payments (required for subscriptions)
STRIPE_SECRET_KEY="sk_..."
STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# File storage (Vercel Blob — auto-provisioned when you add Blob in Vercel)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# Cache / rate limiting (Upstash Redis on Vercel)
REDIS_URL="rediss://..."

# Email (required for notifications / password reset)
SENDGRID_API_KEY="SG...."
FROM_EMAIL="noreply@your-domain.com"

# App URL
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

See [`VERCEL_ENV_CHECKLIST.md`](./VERCEL_ENV_CHECKLIST.md) for the full list.

## Deployment (Vercel)

1. Import `Shockvaluemedia/directfanz-project` at <https://vercel.com/new>.
2. Add the environment variables above in the Vercel project settings
   (Production + Preview). **Never commit real secrets.**
3. Add the **Vercel Blob** and **Upstash Redis** integrations (these provide
   `BLOB_READ_WRITE_TOKEN` and `REDIS_URL`).
4. Configure the **Stripe webhook** to point at
   `https://your-domain.com/api/payments/webhooks` and copy the signing secret
   into `STRIPE_WEBHOOK_SECRET`.
5. Deploy. Pushes to `main` deploy production via
   `.github/workflows/vercel-deploy.yml`; PRs get preview deploys.

The build runs with placeholder env in CI and is build-safe (config validation
is deferred out of the build phase), so a missing production secret fails at
runtime rather than silently shipping. Configure all required variables before
directing traffic.

## Authoritative documentation

- [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) — **current status, blockers, and remaining risks (read this first)**
- [`NEXT_STEPS.md`](./NEXT_STEPS.md) — action plan and roadmap
- [`VERCEL_ENV_CHECKLIST.md`](./VERCEL_ENV_CHECKLIST.md) — environment variables

Older `DEPLOYMENT_*.md` / `AWS_*.md` / Docker guides are historical and may
contradict the above; they are pending archival.

## Contributing

1. Branch from `integration-testing`.
2. Make your changes and keep the quality gates green.
3. Open a pull request against `integration-testing`.

## License

Proprietary — all rights reserved (update as appropriate).
