# DirectFanz — MVP Route Map

Classification of every current route for the MVP (artist + fan + admin core journeys
only). Derived from a full code-level audit of `src/app` on the `integration-testing`
baseline.

Legend: **Keep** = core MVP · **Hide** = remove from navigation / redirect away ·
**Protect** = add/verify auth+role gate · **Defer** = out of MVP scope, leave un-navigable.

## Public

| Route | Verdict | Notes |
| --- | --- | --- |
| `/` (homepage) | Keep | Real marketing page. Remove its inline `<nav>` (double header) and the livestreaming marketing (out of scope). |
| `/auth/signup` | Keep | 3-step wizard, clear FAN/ARTIST choice. Hide dead Google/Facebook buttons. |
| `/auth/signin` | Keep | Must honor `callbackUrl` (was hardcoded to `/dashboard`). |
| `/auth/error` | Keep | NextAuth error page. |

## Artist (canonical tree: `/dashboard/artist/*`)

| Route | Verdict | Notes |
| --- | --- | --- |
| `/dashboard` | Keep / Protect | Client role-router → artist/fan/admin. Needs server gate. |
| `/dashboard/artist` | Keep / Protect | Real dashboard (`ArtistDashboard`). |
| `/dashboard/artist/tiers` | Keep | Tier CRUD — was fully broken (field/response mismatches). |
| `/dashboard/artist/upload` | Keep | Content upload — needed tier-gating + real storage. |
| `/dashboard/artist/content` | Keep | Content list. |
| `/dashboard/artist/analytics` | Keep | Read-only. |
| `/dashboard/artist/campaigns*` | Defer | Non-core. |
| `/dashboard/artist/livestreams` | Defer | Livestreaming out of scope. |
| `/artist/[id]` | Keep | Public artist profile (what a fan sees). Also serves as "preview as fan". |
| `/(dashboard)/artist/*` (URL `/artist`, `/artist/content`, `/artist/analytics`) | **Remove** | Orphan second dashboard; `ArtistSidebar` 404s 7/10 links; `/artist/tiers` collides with `/artist/[id]`; layout redirected to nonexistent `/login`. |
| `/upload` | Hide → redirect to `/dashboard/artist/upload` | Duplicate uploader. |
| `/profile` | Hide → redirect to `/profile/settings` | Demo page (random stats, `console.log` edit). |
| `/profile/settings` | Keep | Real profile edit (`/api/auth/profile`). Fix blank-prefill. |

## Fan (`/dashboard/fan`, `/discover`)

| Route | Verdict | Notes |
| --- | --- | --- |
| `/dashboard/fan` | Keep / Protect | Fan dashboard. |
| `/dashboard/fan/subscriptions` | Keep | Subscription list. |
| `/discover` | Keep | Real DB artists/content. Filters are cosmetic (deferred). |
| `/content/[id]` | Keep | Content viewer + paywall. |
| `/dashboard/fan/campaigns` | Defer | Non-core. |

## Admin (`/admin/*`)

| Route | Verdict | Notes |
| --- | --- | --- |
| `/admin` / `/admin/dashboard` | Keep / Protect | Read-only stats. |
| `/admin/users` | Keep / Protect | User list (verify). |
| `/admin/content` | Keep / Protect | Content review. |
| `/admin/analytics` | Keep / Protect | Read-only. |
| `/admin/moderation` | Keep / Protect | Reports review. |
| `/admin/migration` | **Remove** | **Security blocker:** unauthenticated page + API with destructive Pause/Resume. Out of MVP scope. |
| `/admin/monitoring` | Defer | System internals; calls a missing endpoint. |

## Non-MVP surfaces (Hide from nav / Defer)

`/features` (markets non-existent AI/NFT/mobile), `/feed`, `/player` (demo tracks),
`/playlists`, `/studio` · `/streams` · `/streaming` · `/streaming/live` · `/stream` (all
livestreaming — out of scope), `/campaigns`, `/chat` (duplicate of `/messages`),
`/analytics` (top-level; duplicates artist analytics), `/search` (overlaps `/discover`),
`/settings` (duplicate of `/profile/settings`). None are linked from the live global
header today; the task is to keep future nav from pointing at them and clean stale
branding ("Nahvee Even").

## Navigation

- Live global header is `StaticHeader` — **not session-aware** (shows Sign In / Sign Up
  even when logged in). Make it reflect auth state (Dashboard / Sign out).
- Dead/duplicate nav components to ignore or remove: `header.tsx`, `ClientHeader.tsx`,
  `MobileNav.tsx`, `ClientBreadcrumbs.tsx`. Three brand strings exist
  ("DirectFanz", "Direct Fan", "Nahvee Even") — standardize on **DirectFanz**.
