# DirectFanz — MVP Readiness Report

Scope: stabilize the core creator/fan journeys so real artists and fans can use
DirectFanz. No new features, no mobile, no AI, no livestreaming. Companion docs:
[`MVP_ROUTE_MAP.md`](./MVP_ROUTE_MAP.md) (route classification) and
[`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) (trust-sprint baseline).

## Recommendation

**MVP nearly ready — with the blockers below.** The full monetization loop now
works end-to-end and was verified against a real Postgres database:

> artist signs up → creates a tier → uploads subscriber-only content →
> fan signs up → discovers the artist → is **blocked** from locked content →
> subscribes (simulated, no Stripe needed) → **unlocks** the content.

What remains before a public launch is external configuration (Stripe, email,
object storage, secret rotation) and a short list of UX gaps — not core-journey
bugs.

## How this was verified

Because no journey can be exercised without a database, a local Postgres 16
cluster was stood up and the app driven against it (signup APIs, NextAuth login,
tier/content/subscription/access endpoints, and the middleware redirects). Every
"verified" claim below was observed on a running server, not inferred from code.

## Verification gate (Phase 5)

| Check | Result |
| --- | --- |
| `npm run typecheck` | ✅ pass |
| `npm run lint:check` | ✅ pass (warnings only) |
| `npm test` | ✅ **55 suites / 685 passing, 1 skipped** |
| `npm audit --audit-level=critical` | ✅ 0 critical |
| `npm run build` | ✅ pass (placeholder env) |

## Blockers fixed (in order of depth)

Two of these were systemic — they broke *every* authenticated write and would
have blocked the whole product, and neither was visible without running the app.

1. **Every authenticated write from the UI returned 403 (CSRF).** The middleware
   enforced a double-submit CSRF token, but nothing in the app ever issued the
   cookie or sent the header, so create-tier, upload, subscribe, profile-edit and
   all admin actions failed. Replaced with the OWASP origin-verification pattern
   (no client token needed; still blocks cross-site forgery).
2. **Every `withApiAuth` route returned 401 for logged-in users.** The app signs a
   custom HS256 JWT, but those wrappers used `getToken()`, which only decodes the
   default encrypted-JWE format. Switched them to `getServerSession`, which uses
   the configured decode.
3. **Tier creation/listing was fully broken** by field/response-shape mismatches
   (`price`/`benefits` vs `minimumPrice`, `data.tiers` vs `data.data`).
4. **"Protected content" was impossible.** Content-create never linked tiers, so
   subscriber-only uploads were locked to everyone; local uploads also silently
   discarded the file. Now content is gated to artist-owned tiers (required for
   subscriber-only) and the bytes are actually persisted.
5. **Fans could never subscribe without Stripe.** Added a simulated-subscription
   path (default while Stripe is unconfigured) that writes the same ACTIVE row the
   webhook would; discovery/profile no longer hide non-Stripe artists.
6. **Security: `/admin/migration` was unauthenticated** with destructive
   pause/resume controls. Gated the API to ADMIN and removed the out-of-scope page.
7. **Auth/routing:** added server-side protection for `/dashboard`, `/profile`,
   etc. (redirect to signin before render); sign-in now honors `callbackUrl`;
   removed the orphan `(dashboard)/artist` dashboard (broken sidebar, `/login`
   redirect, namespace clash) and the dead Google/Facebook signup buttons.
8. **UX:** session-aware header (Dashboard / Sign out when logged in); homepage no
   longer double-stacks its nav or markets livestreaming; artists have a
   "Preview my page (as a fan)" link — the previously-missing preview step.

## Core journeys — status

| # | Journey | Status |
| --- | --- | --- |
| 1 | Artist registration | ✅ works (clear FAN/ARTIST choice, role redirect) |
| 2 | Artist profile completion | ✅ works via `/profile/settings` |
| 3 | Artist tier creation | ✅ fixed — was broken on both read and write |
| 4 | Artist protected content upload | ✅ fixed — gated to a tier and persisted |
| 5 | Fan registration | ✅ works |
| 6 | Fan discovery | ✅ works (real data; non-Stripe artists now visible) |
| 7 | Fan blocked from locked content | ✅ enforced server-side (verified 403) |
| 8 | Fan subscription (simulated) | ✅ new MVP-safe path (verified) |
| 9 | Fan accesses unlocked content | ✅ verified (access granted after subscribe) |
| 10 | Admin reviews users/content | ⚠️ partial — see remaining blockers |

## Remaining blockers before public launch

**Product/UX (in-scope follow-ups, not journey-breaking):**
- **Admin content review is non-functional**: `/admin/content` and the user "ban"
  action call API routes that don't exist (`/api/admin/content`,
  `/api/admin/content/[id]`, `PATCH /api/admin/users/[id]`). Read-only admin
  (users list, dashboard stats, analytics) works; moderation write actions do not.
- **Locked content has no teaser in the fan UI.** Blocking is enforced, but a fan
  browsing an artist sees only public content — there's no "🔒 subscribe to
  unlock" preview. Good next polish.
- **Profile settings opens blank** (`/api/auth/profile` returns `{ user }` but the
  form reads `{ data }`). Editing works; prefill doesn't.
- **Stale "Nahvee Even" branding** remains in a few components (`simple-nav`,
  `playlists`, a couple of content components).
- **Video/audio thumbnail generation** depends on ffmpeg, which isn't installed in
  this environment; image uploads process fully, A/V files still store but without
  a generated thumbnail.

**External configuration (must be done before launch — see PRODUCTION_READINESS.md):**
- **Rotate the secrets exposed in git history** (flagged in the trust sprint).
- **Stripe**: to take real payments, set `STRIPE_SECRET_KEY` / publishable /
  webhook secret. Simulated subscriptions auto-disable once real keys are present
  (or force with `ALLOW_SIMULATED_SUBSCRIPTIONS=false`). **Simulated subscriptions
  must be disabled in production.**
- **Object storage** (S3 / Blob / configured object storage): local disk storage
  works for dev but isn't durable for production; set `BLOB_READ_WRITE_TOKEN`
  (or the equivalent S3 config) for launch.
- **Email** (SendGrid): password reset is still a stub (from the trust sprint);
  wire real email before relying on account recovery.
- **Database & auth**: `DATABASE_URL` and a strong `NEXTAUTH_SECRET`.

## Manual configuration summary

| Service | Env var(s) | Needed for |
| --- | --- | --- |
| Postgres | `DATABASE_URL` | everything |
| NextAuth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | login/sessions |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | real payments |
| Simulated subs | `ALLOW_SIMULATED_SUBSCRIPTIONS` (`false` in prod) | MVP-safe subscribe |
| Storage | `BLOB_READ_WRITE_TOKEN` (or S3) | durable uploads |
| Email | `SENDGRID_API_KEY`, `FROM_EMAIL` | password reset / notifications |
