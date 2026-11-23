# Launch community setup

The launch lineup lives in `src/lib/launch-community.ts`:

| Place | Lineup slot |
| --- | --- |
| 1 (headliner) | Nahvee |
| 2 | Never More |

Only the names and places are in code. The community's name, any emails and
every account are entered by an admin when the setup runs.

## Steps

1. Sign in as an admin.
2. Create the community and the invites (safe to run again):

   ```http
   POST /api/admin/community/setup
   Content-Type: application/json

   {
     "slug": "<community-slug>",
     "name": "<community name>",
     "artists": [
       { "label": "Nahvee", "email": "<optional: lock the invite to this email>" },
       { "label": "Never More", "email": "<optional>" }
     ]
   }
   ```

   The answer lists each slot. A slot with status `invite_created` carries its
   single-use `code` and, when `NEXT_PUBLIC_APP_URL` is set, a `signupUrl`
   like `https://<app>/auth/signup#invite=<code>`. **The code is shown only
   once**; only its hash is stored. Invites last 14 days unless
   `expiresInDays` says otherwise (1 to 90).
3. Share each link with that artist yourself. The sign-up page fills in the
   code and picks the artist role. The code sits after `#`, so it never
   reaches the server's logs.
4. When the artist signs up, they join the community at their place (Nahvee
   headlines). Set `COMMUNITY_SLUG` to the slug so `/community` shows it.
5. Check progress at any time, without codes:

   ```http
   GET /api/admin/community/setup?slug=<community-slug>
   ```

   Each slot reads `joined`, `invite_pending` or `not_invited`.

## Running it again

- The community is created once.
- A slot whose artist has joined is left alone.
- A slot with a live invite keeps it. To send a fresh code (for example the
  first link was lost), add `"reissue": ["Nahvee"]`; the old code stops
  working at once and the new one keeps the old email lock unless you give a
  new email.
- A name that isn't in the lineup is refused, so a typo can't make a stray
  invite.

`PATCH /api/admin/community/artists/:userId` with `{ "featuredRank": n }`
still moves an artist by hand.
