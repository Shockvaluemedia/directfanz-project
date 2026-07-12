# DirectFanz - Next Steps Action Plan

**Platform**: Vercel (the AWS/Docker files in the repo are legacy)

> ⚠️ **Status correction:** The "95% production ready / live" claim below is
> **not accurate.** See [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)
> for the real status — there are open launch blockers (rotate leaked secrets,
> implement password reset, wire brute-force protection, add webhook
> idempotency). The stack description below is correct; the readiness claim is not.

## Historical status note (kept for context)

The DirectFanz platform targets **Vercel**. The platform uses:

- **Vercel** for hosting and deployment
- **Vercel Blob** for file storage (replacing AWS S3)
- **Vercel Postgres** or external PostgreSQL for database
- **Upstash Redis** for caching (replacing AWS ElastiCache)
- **WebRTC + Socket.io** for live streaming (replacing AWS MediaLive)
- **OpenAI** for content moderation (replacing AWS Rekognition)
- **SendGrid** for email (replacing AWS SES)

### Platform Summary

- **130+ API endpoints** across authentication, content, payments, streaming, messaging, campaigns, and admin
- **25+ database models** covering users, content, subscriptions, streaming, gamification, and compliance
- **699/700 tests passing** across 56 test suites
- **4 CI/CD workflows** via GitHub Actions (CI/CD, Vercel deploy, security, content uploader)
- **React Native mobile app** foundation in `/NahveeEvenMobile/`

---

## HIGH PRIORITY - Immediate Actions

### 1. Fix Redis Connection

**Problem**: Redis connection timeout — affects session management, caching, and rate limiting.

**Fix**: Set up Upstash Redis (serverless, Vercel-optimized)
1. Create a database at https://upstash.com
2. Select the region closest to your Vercel deployment
3. Copy the connection string (`rediss://...`)
4. Add `REDIS_URL` in Vercel environment variables
5. Redeploy

### 2. Set Up Vercel Blob Storage

File storage has been migrated from S3 to Vercel Blob. To enable:
1. In Vercel dashboard: Storage > Create Store > Blob
2. Connect to your project
3. The `BLOB_READ_WRITE_TOKEN` will be added automatically
4. Redeploy

### 3. Verify Production Routes

Some routes (e.g., `/login`) were returning 404. Audit:
- All public-facing routes against Next.js App Router config
- Authentication middleware isn't blocking valid routes
- Route groups `(dashboard)` resolve correctly

### 4. Verify External Services

| Service | Purpose | Env Var | Action |
|---------|---------|---------|--------|
| **Stripe** | Payments | `STRIPE_SECRET_KEY` | Test subscription flow |
| **SendGrid** | Email | `SENDGRID_API_KEY` | Test password reset email |
| **Upstash Redis** | Caching | `REDIS_URL` | Set up + test |
| **Vercel Blob** | File storage | `BLOB_READ_WRITE_TOKEN` | Set up + test upload |
| **OpenAI** | Moderation | `OPENAI_API_KEY` | Optional, for content moderation |

---

## MEDIUM PRIORITY - Technical Improvements

### 5. Fix Build Configuration

Re-enable strict checking:
```javascript
// next.config.js
typescript: { ignoreBuildErrors: false },
eslint: { ignoreDuringBuilds: false },
```
Then fix errors incrementally.

### 6. Complete Mobile App

The React Native app has auth, navigation, and themes working. Remaining:
- Replace placeholder screens with full implementations
- Content browsing and media playback
- Push notifications
- Subscription management

### 7. Expand E2E Test Coverage

Playwright is configured. Add tests for:
- Authentication flows (register, login, reset)
- Artist content upload and management
- Fan subscription and content access
- Payment flows
- Live streaming

### 8. Complete GDPR Compliance

~60% implemented. Remaining:
- Complete `src/lib/legal-compliance.ts` (has TODOs)
- User-facing data export UI
- Test data deletion workflows

### 9. Set Up Error Tracking (Sentry)

1. Create project at https://sentry.io
2. Add to Vercel:
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
   SENTRY_AUTH_TOKEN=...
   ```

---

## Environment Variables (Vercel Dashboard)

### Required
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<generated>
NEXTAUTH_URL=https://www.directfanz.io
NODE_ENV=production
```

### Services
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG...
FROM_EMAIL=noreply@directfanz.io
REDIS_URL=rediss://...
BLOB_READ_WRITE_TOKEN=<auto-configured by Vercel>
```

### Optional
```
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

---

## Cost Estimate

| Service | Cost |
|---------|------|
| Vercel Pro | $20/month |
| Vercel Postgres | $0-25/month |
| Vercel Blob | $0-20/month (pay per use) |
| Upstash Redis | $0-10/month |
| SendGrid | $0-15/month |
| Stripe | 2.9% + 30c per transaction |
| **Total** | **~$20-90/month** |

---

## Key Files Reference

| Category | Files |
|----------|-------|
| Database schema | `prisma/schema.prisma` |
| API routes | `src/app/api/` |
| File storage | `src/lib/s3.ts`, `src/lib/upload.ts` (Vercel Blob) |
| Auth | `src/lib/auth.ts` |
| Main config | `next.config.js`, `package.json` |
| CI/CD | `.github/workflows/ci-cd.yml`, `.github/workflows/vercel-deploy.yml` |
| Deployment | Vercel dashboard |
