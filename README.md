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
| Cache / limits | Redis (`ioredis`; e.g. Upstash)                        |
| Object storage | Configured object storage — S3 / Blob (`@vercel/blob` is wired) |
| Payments       | Stripe                                                  |
| Email          | SendGrid (`@sendgrid/mail`)                             |
| Auth           | NextAuth.js (JWT sessions)                              |
| Build gate     | CI — `.github/workflows/ci-cd.yml`                      |
| Hosting        | Not settled in this repo — see the deployment note below |

> The repo carries deployment config for **both** an AWS/ECS/Docker/Terraform
> stack and a Vercel setup, left over from earlier iterations. Neither is
> confirmed as the current deploy target here, so treat both as history until a
> target is chosen; do not read either as "the supported path". The one enforced
> build gate is CI (`.github/workflows/ci-cd.yml`). Application code currently
> wires `@vercel/blob` for object storage and `next.config.js` whitelists
> `*.public.blob.vercel-storage.com`; swap these for your chosen object store
> (S3 / Blob) at deploy time.

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

# Object storage (S3 / Blob / configured object storage)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# Cache / rate limiting (Redis; e.g. Upstash)
REDIS_URL="rediss://..."

# Email (required for notifications / password reset)
SENDGRID_API_KEY="SG...."
FROM_EMAIL="noreply@your-domain.com"

# App URL
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

See [`VERCEL_ENV_CHECKLIST.md`](./VERCEL_ENV_CHECKLIST.md) for the full list.

## Deployment

The deployment target is **not settled in this repo** — it carries config for
both a Vercel setup (`vercel.json`, `.github/workflows/vercel-deploy.yml`) and an
AWS/ECS/Docker/Terraform setup from earlier iterations. Pick and confirm one
before launch; don't treat either as the supported path yet. What *is*
authoritative here is the build gate: CI (`.github/workflows/ci-cd.yml`) runs
typecheck, lint, tests, the critical `npm audit` gate, and the production build
on every push/PR to `integration-testing` and `main`.

Whatever target you choose, before directing traffic:

1. Set every required environment variable (see above) in the host's secret
   store — never commit real secrets.
2. Provision **object storage** (S3 or Blob) and set `BLOB_READ_WRITE_TOKEN`
   (or the equivalent S3 config).
3. Provision **Redis** (e.g. Upstash) → `REDIS_URL` for rate limiting / cache.
4. Configure the **Stripe webhook** to point at
   `https://your-domain.com/api/payments/webhooks` and set `STRIPE_WEBHOOK_SECRET`.

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
