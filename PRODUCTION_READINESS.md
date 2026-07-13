# DirectFanz — Production Readiness Report

_Production Trust Sprint • authoritative status document_

This report supersedes every older doc that claims the platform is
"PRODUCTION READY", "LIVE", or "COMPLETE". Where this file and another doc
disagree, this file is correct.

## Verdict

**Not launch-ready yet, but materially closer.** The build, test suite, CI, and
several serious security holes are fixed. A handful of **launch blockers**
remain — most importantly, production secrets that were committed to the repo
must be rotated, and the password-reset/email flow is a non-functional stub.
Do not put real artists or fans on this until the blockers below are cleared.

## Quality gates (local, this branch)

| Gate            | Status | Notes                                                        |
| --------------- | ------ | ------------------------------------------------------------ |
| `npm run typecheck` | ✅ pass | clean                                                    |
| `npm run lint:check` | ✅ pass | warnings only                                           |
| `npm test`      | ✅ pass | 55 suites, 684 passing, 1 skipped (was 9 suites / 28 failing) |
| `npm audit`     | ⚠️ improved | 0 critical (was 2); 4 production high remain, all needing major upgrades. CI blocks on critical and reports highs. |
| `npm run build` | ✅ pass | now build-safe with placeholder env (see below)              |

## What was fixed this sprint

### Security — routes & access control

- **Deleted the entire test/debug/demo surface** that shipped to production: 18
  pages (`/test`, `/test-auth*`, `/test-signin`, `/debug/websocket`,
  `/ui-showcase`, `/home-demo`, `/simple-demo`, `/features-demo`,
  `/upload-simple`, `/css-test`, `/minimal-test`, `/page-simple`,
  `/simple-signin`, …), 4 backup homepage files, and 3 API routes
  (`/api/test-new`, `/api/simple-upload` fake-upload stub, `/api/content-example`).
- **`/api/admin/change-role`** — replaced the `x-test-admin: true` header
  "auth" with a real authenticated-admin check (`getServerSession` + DB
  `role === 'ADMIN'`) and made it actually perform an audited role update.
- **`/api/admin/database/performance`** — was **completely unauthenticated**
  (data exposure + DB-stress DoS + optimization mutations). Now gated behind an
  admin check on both GET and POST.
- **`/api/admin/dashboard/stats`** — removed a hardcoded email backdoor
  (`admin@directfan.com`) that granted admin to anyone who registered that address.
- **`/api/admin/metrics`** and **`/api/ai/admin`** — fixed role checks that
  compared against lowercase `'admin'` (the DB enum is `'ADMIN'`).

### Security — auth, uploads, payments, content

- **`/api/auth/login`** — removed the hardcoded `'fallback-secret'` JWT signing
  key; it now fails closed if no real secret is configured (a known key lets
  anyone forge admin tokens).
- **`/api/upload`** — was unauthenticated and wrote the **client-supplied
  filename straight into a filesystem path** (path traversal → arbitrary file
  write). Now requires an authenticated session, generates server-side random
  filenames, and validates MIME type + size against an allowlist before writing.
- **`streaming-auth`** — stream-URL HMAC no longer falls back to an empty
  signing key (which made signatures forgeable); it fails closed instead.
- **Content paywall/IDOR** — `GET /api/content` merged the `search` filter into
  the subscription-gate `OR`, letting any fan retrieve premium content by
  searching its title/description. The gate is now an enforced `AND`.
- **`GET /api/fan/artists`** — stopped leaking every artist's `totalEarnings`
  to all fans.
- **GDPR** — verification tokens (which authorize data export/deletion) now use
  `crypto.randomBytes` instead of the guessable `Math.random()`.
- **Stripe webhook** — three correctness fixes: (1) handlers no longer swallow
  errors and return 200, so a failed provisioning now returns 500 and Stripe
  retries (was: paid-but-no-access, silently); (2) re-subscription after
  cancellation now reactivates the existing row instead of crashing on the
  `unique(fanId, tierId)` constraint; (3) a missing fan relation no longer
  crashes the whole webhook.

### Secrets & hygiene

- **Removed committed secrets and PII from the working tree**: ECS task
  definitions with live `NEXTAUTH_SECRET` / `JWT_SECRET` / `ENCRYPTION_KEY` /
  DB password, three SQLite `*.db` files containing real user rows/hashes,
  `cookies.txt`, credential-dumping scripts (`diagnose-auth.cjs`,
  `test-login.cjs`, `fix-auth.js`, `reset-password.js`, `auth-debug.js`), and
  test HTML pages served from `/public`.
- **Redacted the leaked secret values** from ~11 markdown/script docs.
- Hardened `.gitignore` (`*.db`, `cookies.txt`, `*.pem`, `*.key`, the leaky ECS
  task-def JSONs).
- Removed the dead root `middleware.ts` (Next.js loads `src/middleware.ts`; the
  root one was ignored) and added `poweredByHeader: false`.

### CI / build / deps

- Upgraded **Next.js 14.0.4 → 14.2.35** (clears both critical advisories) and
  ran safe `npm audit fix`. Criticals: 2 → 0.
- Removed the unused **`next-pwa`** dependency (PWA has been disabled in
  `next.config.js`); this alone cleared 5 high advisories from its
  `workbox` / `rollup-plugin-terser` / `serialize-javascript` build chain.
- The CI audit gate **blocks on `critical`** (currently 0) and **reports
  `high` non-blocking**, so CI reflects reality and can go green while the
  residual highs are tracked below.
- Rewrote CI so it is **truthful**: `ci-cd.yml` now runs on the real branches
  (`integration-testing`, `main`) and runs ci → typecheck → lint → test →
  audit → build using scripts that actually exist. `security.yml` was stripped
  of steps calling non-existent scripts (`type-check`, `security:check`,
  `validate:secrets`, `test:coverage`, `test:e2e`) and now does dependency
  audit + Semgrep + dependency-review only. Deleted the broken
  `content-uploader-deploy.yml`. Fixed `vercel.json`'s non-existent `dev:next`.
- **Build is now build-safe**: production config validation is skipped during
  `next build` (Next's `phase-production-build`) so a placeholder
  `NEXTAUTH_URL` no longer aborts the build, while still failing closed at
  runtime. The build previously died collecting `/api/data-export`.

## 🚫 Launch blockers (must clear before real users)

1. **Rotate the leaked production secrets — they are compromised.** They were
   committed to git history (removing them from the tree does not purge
   history). Rotate now and invalidate existing sessions:
   - `NEXTAUTH_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`
   - the RDS/Postgres database password
   - force a password reset for any account whose hash was in the committed
     `*.db` files.
   Optionally purge the values from git history (BFG / `git filter-repo`).
2. **Password reset & "forgot password" are non-functional stubs.**
   `/api/auth/forgot-password` and `/api/auth/reset-password` always return
   success without sending email or changing anything. Implement a real
   token-based flow (hashed, single-use, short-TTL, emailed via SendGrid)
   before launch. Requires SendGrid configured.
3. **Login brute-force protection is effectively disabled.** The auth rate
   limiter is set to test-mode values and the account-lockout code
   (`AuthSecurityManager`) is never wired into the login path. Restore strict
   limits and wire lockout in before launch.
4. **No Stripe webhook idempotency.** Error propagation now makes Stripe retry
   failed events (good), but retries can double-count earnings/subscriber
   counts because processed events are not deduplicated. Add a
   `processed_webhook_events` table (persist `event.id`, short-circuit on
   replay) — this needs a Prisma migration.

## ⚠️ Remaining risks (should fix soon; not all blockers)

- **Uploads:** file-type validation still trusts client MIME on
  `/api/content/upload` (no magic-byte sniffing / AV scan); gated content is
  stored as world-readable Vercel Blob with guessable keys (paywall bypass via
  direct URL); `local-storage.ts` can store `.html`/`.svg` (stored-XSS if
  served same-origin).
- **Page-route auth is client-side only** for `/studio`, `/admin`, `/upload`,
  `/settings` (they check the session in `useEffect`, not server-side). The API
  routes behind them do enforce auth, but add server-side guards
  (layout `getServerSession` redirect or middleware) for defense in depth.
- **Content access edge cases:** `GET /api/content/[id]` and the fan feed grant
  access on lapsed subscriptions (no `currentPeriodEnd`/`tier.isActive` check).
- **Payments portal IDOR:** `/api/payments/portal` trusts a client-supplied
  `stripeAccountId`; derive it server-side from the fan's own subscription.
- **Account deletion** requires only a session cookie (no step-up re-auth) and
  there are two divergent deletion paths.
- **Email verification** is not enforced at login.
- **Duplicate/divergent auth configs** (`auth.ts`, `auth-production.ts`);
  consolidate on one and make a missing/short `NEXTAUTH_SECRET` a hard failure
  in all non-build environments.
- **CSP** allows `unsafe-inline`/`unsafe-eval`; middleware imports Node `crypto`
  which logs an Edge-runtime warning at build.
- **Remaining `npm audit` highs — 4 production, 0 critical.** After removing
  the unused `next-pwa` chain, the only highs left in production dependencies
  each require a **major-version upgrade** with its own validation pass, so they
  are deliberately deferred out of this trust sprint:
  - `next` — DoS advisories (Image Optimizer `remotePatterns`, HTTP request
    deserialization); patched line is Next 15/16 → App Router migration test.
  - `@sentry/nextjs` (+ its `rollup`) — fix is `@sentry/nextjs` 10.x (major).
  - `undici` (via `@vercel/blob`) — fix is `@vercel/blob` 2.x (major; storage
    API surface must be re-tested).
  None has a safe (non-major) fix. CI blocks on `critical` and reports these
  highs so they stay visible without wedging the pipeline red.
- **Repo hygiene:** ~50 debug/fix/test scripts and 100+ markdown docs remain at
  the repo root, many contradicting each other. Recommend archiving them under
  `docs/archive/` so the tree tells one story.

## Manual actions required (external services / config)

You must configure these yourself — they cannot be done from the codebase:

| Service       | Action                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| **Secrets**   | **Rotate** `NEXTAUTH_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`, DB password (see blocker 1). |
| **Host**      | Set all env vars in the host's secret store. Never commit them.                         |
| **Stripe**    | Live keys; create the webhook → `/api/payments/webhooks`; set `STRIPE_WEBHOOK_SECRET`.  |
| **SendGrid**  | API key + verified sender (`FROM_EMAIL`) — required for notifications & password reset. |
| **Redis**     | Redis instance (e.g. Upstash) → `REDIS_URL` (rate limiting, cache).                      |
| **Object storage** | Configured object storage (S3 / Blob) → `BLOB_READ_WRITE_TOKEN` or the S3 config.   |
| **Database**  | Managed Postgres (Supabase / RDS / etc.) → `DATABASE_URL`; run migrations.               |
| **Domain**    | Point the domain at the host; set `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` (HTTPS).          |

## Deployment path (decision)

**Not settled in this repo.** The tree carries config for both a Vercel setup
(`vercel.json`, `.github/workflows/vercel-deploy.yml`) and an AWS/ECS/Docker/
Terraform setup from earlier iterations; both are history until a target is
chosen, and neither should be read as the supported deploy path. The one
enforced build gate is CI (`.github/workflows/ci-cd.yml`) — typecheck, lint,
tests, the critical `npm audit` gate, and the production build. Application code
currently wires `@vercel/blob`, Stripe, SendGrid, Redis, and external Postgres;
swap object storage for your chosen provider (S3 / Blob) at deploy time. See the
README for provider-neutral pre-launch steps.
