# DirectFanz - Next Steps Action Plan

**Last Updated**: February 23, 2026
**Platform**: Vercel (fully migrated from AWS)

## Current Status: Production Ready

The DirectFanz platform is **live at directfanz.io** and fully deployed on **Vercel**. All AWS dependencies have been removed. A comprehensive implementation pass has been completed.

### What Was Implemented (Feb 2026)

- **55/55 test suites passing** — 683 tests, 1 skipped (was 28 failures)
- **TypeScript strict mode** — `ignoreBuildErrors: false`, `ignoreDuringBuilds: false`
- **PWA re-enabled** — `next-pwa` with offline support
- **Brand rename complete** — `NahveeEven` → `DirectFanz` across all source files and mobile app
- **Debug routes removed** — 60+ root-level debug scripts, AWS legacy configs, test pages deleted
- **GDPR compliance complete** — data export, deletion with grace period, consent history
- **E2E test coverage added** — Playwright tests for payment flows and live streaming
- **Mobile app enhanced** — Share functionality, SubscriptionsScreen, storage key rename
- **Source TODOs completed** — VOD storage, follow status, stream stats, media duration detection, analytics notifications

### Platform Summary

- **130+ API endpoints** across authentication, content, payments, streaming, messaging, campaigns, and admin
- **25+ database models** covering users, content, subscriptions, streaming, gamification, and compliance
- **55 test suites, 683 tests passing**
- **4 CI/CD workflows** via GitHub Actions (CI/CD, Vercel deploy, security, content uploader)
- **React Native mobile app** in `/DirectFanzMobile/` — auth, navigation, subscriptions, content sharing

---

## HIGH PRIORITY — Required Before Full Production Use

### 1. Set Up Upstash Redis

Redis is required for session management, rate limiting, and caching.

1. Create a database at https://console.upstash.com
2. Select the region closest to your Vercel deployment (e.g. `us-east-1`)
3. Copy the **REST URL** and **REST Token** (for `@upstash/redis`) or the **Redis URL** (for `ioredis`)
4. In Vercel dashboard → Settings → Environment Variables, add:
   ```
   REDIS_URL=rediss://default:<password>@<endpoint>:<port>
   ```
5. Redeploy

**Verify**: Hit `/api/health` — the response should show `redis: "ok"`.

### 2. Set Up Vercel Blob Storage

Required for avatar uploads, content media, and VOD recordings.

1. In Vercel dashboard → Storage → Create Store → Blob
2. Connect to your project
3. `BLOB_READ_WRITE_TOKEN` is added to your environment automatically
4. Redeploy

**Verify**: Upload an avatar in Settings — it should persist with a `public.blob.vercel-storage.com` URL.

### 3. Configure Stripe Webhooks

Stripe webhooks must be pointed at your production URL.

1. In Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://directfanz.io/api/payments/webhooks`
3. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
4. Copy the signing secret and set in Vercel:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

**Verify**: Use `stripe trigger checkout.session.completed` (Stripe CLI) and check logs.

### 4. Configure SendGrid

Required for password reset, welcome emails, and subscription notifications.

1. Create an account at https://sendgrid.com
2. Create an API key (Settings → API Keys → Create API Key → Full Access)
3. Verify sender domain for `directfanz.io`
4. Set in Vercel:
   ```
   SENDGRID_API_KEY=SG.your_api_key_here
   SENDGRID_FROM_EMAIL=noreply@directfanz.io
   ```

**Verify**: Trigger a password reset and confirm the email arrives.

### 5. Set Up Sentry Error Tracking

1. Create a project at https://sentry.io (Next.js project type)
2. Copy the DSN
3. Set in Vercel:
   ```
   SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
   SENTRY_AUTH_TOKEN=your_auth_token
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=your-project-slug
   ```
4. Redeploy — Sentry will automatically capture errors and upload source maps

**Verify**: Visit `/api/health` or trigger a test error; it should appear in your Sentry project.

---

## MEDIUM PRIORITY — Recommended Improvements

### 6. Verify Production Routes

Confirm all public-facing routes resolve correctly:
- `/` — home page
- `/login`, `/register` — auth pages
- `/livestream` — live streams listing
- `/dashboard/artist/*` — artist dashboard
- `/dashboard/fan/*` — fan dashboard

### 7. Run Database Migrations in Production

If you haven't applied migrations recently:
```bash
npx prisma migrate deploy
```

The `follows` model and `users.status` field require a migration if not already applied.

### 8. Push Notifications for Mobile App (Future)

The DirectFanzMobile app does not yet have push notifications. To add:
- Integrate **Expo Notifications** (`expo-notifications`)
- Store push tokens in `users.pushToken` field
- Trigger from existing email notification points in `src/lib/email.ts`

### 9. Pusher Real-Time Events (Configured, Not Active)

Pusher integration is in place (`src/lib/pusher.ts`, `src/lib/pusher-client.ts`). To activate:
1. Create an app at https://pusher.com/channels
2. Set in Vercel:
   ```
   PUSHER_APP_ID=your_app_id
   PUSHER_KEY=your_key
   PUSHER_SECRET=your_secret
   PUSHER_CLUSTER=us2
   NEXT_PUBLIC_PUSHER_KEY=your_key
   NEXT_PUBLIC_PUSHER_CLUSTER=us2
   ```
3. Redeploy — stream start/stop and viewer count events will go live automatically

---

## Environment Variables Reference

### Required (Platform will not function without these)
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://directfanz.io
NODE_ENV=production
```

### Payment Processing
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### File Storage
```
BLOB_READ_WRITE_TOKEN=<auto-configured by Vercel Blob>
```

### Email
```
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@directfanz.io
```

### Cache & Sessions
```
REDIS_URL=rediss://default:password@host:port
```

### Error Tracking
```
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

### AI Content Moderation (Optional)
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
```

### Real-Time Events (Optional)
```
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=us2
NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

### Security
```
ENCRYPTION_KEY=<64-char hex: openssl rand -hex 32>
JWT_SECRET=<generate a strong secret>
```

---

## Cost Estimate

| Service | Tier | Cost |
|---------|------|------|
| Vercel Pro | Hosting | $20/month |
| Vercel Postgres | Database | $0–25/month |
| Vercel Blob | File storage | $0–20/month (pay per use) |
| Upstash Redis | Cache | $0–10/month |
| SendGrid | Email | $0–15/month |
| Sentry | Error tracking | $0–26/month |
| Stripe | Payments | 2.9% + 30¢ per transaction |
| Pusher | Real-time | $0–49/month |
| **Total (no scale)** | | **~$20–90/month** |

---

## Key Files Reference

| Category | Files |
|----------|-------|
| Database schema | `prisma/schema.prisma` |
| API routes | `src/app/api/` |
| File storage | `src/lib/upload.ts` (Vercel Blob) |
| Auth | `src/lib/auth.ts` |
| Redis | `src/lib/redis.ts` |
| Pusher | `src/lib/pusher.ts`, `src/lib/pusher-client.ts` |
| Email | `src/lib/email.ts` |
| GDPR | `src/lib/legal-compliance.ts`, `src/app/api/user/gdpr/` |
| Mobile app | `DirectFanzMobile/` |
| E2E tests | `e2e/` |
| Main config | `next.config.js`, `package.json` |
| CI/CD | `.github/workflows/` |
| Env template | `.env.example` |
