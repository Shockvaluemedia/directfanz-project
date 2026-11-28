# Setting up the DirectFanz database on RDS

**The plan (Demetrius, Nov 23, 2026): a fresh start.** The old database holds
only test and demo data, so nothing moves to AWS except the user accounts he
made on his own db4commerce email domain, with what they need to sign in. See
"Fresh start with his accounts" below. The full copy path is kept further down
for reference only; it is not the plan.

How to build the new RDS database, carry those accounts over, and get Prisma's
migration history right. The scripts live in
`scripts/migration/`. Everything here is prepared, not run: no real database
has been read, exported or written.

Where this fits: step 7 and step 11 of [RUNBOOK.md](./RUNBOOK.md). The
target is the `directfanz` database on the RDS instance from PR #56.

## Where the data lives today

From the repo and its docs only (no account was checked):

- Production most likely runs on a **Supabase Postgres project** in us-east-2,
  connected to the Vercel project as `DATABASE_URL`
  (`RECONNECT_SUPABASE.md`, `DEBUG_SIGNIN.md`, `PRODUCTION_STATUS_REPORT.md`).
  Whether it holds real users or only test accounts is not known.
- The old AWS RDS database (`directfanz-db`) no longer exists, so the leaked
  RDS password opens nothing (key rotation plan, step 0, Nov 21).
- The schema was built with `prisma db push`, so Supabase most likely has no
  `_prisma_migrations` table. `export.sh`'s dry run reports this either way.

## Two findings that change the plan

**1. PR #54's migrations run in the wrong order.** Prisma applies migration
folders in name order. `20261122_drop_presales` sorts before
`20261122_drops`, so `prisma migrate deploy` stops with
`relation "drops" does not exist` on any database, new or copied. Renaming the
eight folders so their names follow the order they were written fixes it; with
that change the whole copy-and-upgrade path below passed locally. The fix
belongs on PR #54's branch and needs the owner's yes before merging:

| New name | Was |
| --- | --- |
| `20261122000001_one_time_purchases` | `20261122_one_time_purchases` |
| `20261122000002_drops` | `20261122_drops` |
| `20261122000003_fan_list` | `20261122_fan_list` |
| `20261122000004_marketing_events` | `20261122_marketing_events` |
| `20261122000005_party_reminders` | `20261122_party_reminders` |
| `20261122000006_drop_presales` | `20261122_drop_presales` |
| `20261122000007_member_discounts` | `20261122_member_discounts` |
| `20261122000008_community` | `20261122_community` |

**2. The three old migrations don't build today's schema.** The schema kept
changing through `db push` after September 2025 (follows, user status, AI and
moderation tables and more). Running `prisma migrate deploy` on an empty RDS
database gives a database that differs from `prisma/schema.prisma` in 101
statements. PR #56's deploy workflow runs `prisma migrate deploy` before every
release, so on the first deploy it would build exactly that wrong schema. One
of the two paths below has to be done before the first deploy (RUNBOOK step
7); after that the workflow's migration step works normally. The lasting fix is to
squash the old migrations into one new baseline migration in its own PR.

## What moves and what stays behind

Chosen Nov 23: **fresh start, keeping only his own accounts.** The old database
is never changed or deleted by any of this; Supabase stays as it is until the
rollback window ends (RUNBOOK step 14).

| Moves to AWS, for each user on his db4commerce domain | Stays behind |
| --- | --- |
| The user row, password hash included, so the same email and password sign in | Every other user |
| The artist profile, if any, with Stripe reset (no Connect account, not onboarded, earnings and subscriber count 0), so the artist reconnects Stripe test mode on AWS | Content, drops, purchases, subscriptions, follows, messages, comments, streams |
| Google (or other) sign-in links, with every stored token emptied; only the provider and account id stay | Sessions and refresh tokens (dead anyway once the keys rotate), consent and age records |

The community (Nahvee first, then Never More), the drops and the files are set
up new on AWS (RUNBOOK step 9).

## Before running anything for real

- **Postgres client tools** at least as new as the source server. The dry run
  checks and stops if `pg_dump` is too old; set `PG_BIN` to a newer client's
  `bin` folder (for example `/usr/lib/postgresql/17/bin`).
- **Node and the repo's packages** (`npm ci`) for the Prisma steps.
- **The source URL:** Supabase's _session pooler_ or direct connection on port
  5432. The transaction pooler on port 6543 doesn't work with `pg_dump`, and
  the scripts refuse it.
- **A route to RDS.** RDS sits in private subnets with no public address.
  PR #56's move-day tunnel reaches it without any standing access: in a second
  terminal run `infra/aws/scripts/db-tunnel.sh 120` (minutes, 4 hours at most;
  Ctrl-C closes it early). It needs the AWS CLI v2, the Session Manager plugin,
  terraform and jq. While it runs, Postgres answers on `127.0.0.1:5432`, so
  `TARGET_DATABASE_URL` uses host `127.0.0.1`, database `directfanz` and
  `sslmode=require`. The login is in the RDS-managed secret (`db_secret_arn`
  output); he reads it into his own shell and nowhere else. Closing the script
  stops the tunnel task.
- **Connection strings stay in environment variables.** Set them in your own
  shell (`read -rs` keeps them out of history), never in a file in the repo, a
  chat or a ticket. The scripts move the password into a temporary file only
  they can read and never print it.

## The scripts

All of them are dry runs unless given `--execute`. They read connection URLs
from `SOURCE_DATABASE_URL` and `TARGET_DATABASE_URL` only.

| Script | What it does | Writes to |
| --- | --- | --- |
| `export.sh` | Read-only on the source. Dry run: version check, every table's row count, size, migration history, Supabase extras. `--execute`: `pg_dump` of the `public` schema, a snapshot of row counts and checksums taken before and after (fails if anything changed in between), sha256 of the archive. | A new folder outside the repo, mode 0700 |
| `import.sh` | Checks the archive's sha256, refuses a Supabase target, the source itself or a target that already has tables. Leaves out Supabase-only items (row-level security, policies, the `public` schema entry). `--execute` also needs `CONFIRM_TARGET_HOST`. Restores in one transaction, then verifies. | The empty RDS database |
| `verify.sh` | Row count and an order-independent checksum of every row, per table, plus sequence values. Against the export's snapshot (`--dump-dir`) or both databases live (`--live`). | Nothing |
| `check-schema.sh` | `prisma migrate status`, plus the SQL that would make the database match a schema file (printed, never applied). | Nothing |
| `baseline.sh` | Refuses unless the database exactly matches the schema you name. `--execute` records the old migrations as applied, so `migrate deploy` runs only the newer ones. | `_prisma_migrations` only |
| `export-accounts.sh` | **The plan.** Read-only on the source. Dry run: email domains with counts, then the accounts on `--email-domain` and what moves for each. `--execute`: three CSV files (users, artist profiles with Stripe reset, sign-in links with tokens emptied) in one read-only snapshot, with checksums. | A new folder outside the repo, mode 0700 |
| `import-accounts.sh` | Checks the checksums, refuses a Supabase target and users already present. Without `--execute` the whole load runs in a transaction that is rolled back; `--execute` (with `CONFIRM_TARGET_HOST`) commits it. | The new database's `users`, `artists`, `accounts` |
| `rehearse-local.sh` | The whole thing on two throwaway local Postgres servers, with guard and tamper tests. | A temp folder, deleted after |

## Fresh start with his accounts, step by step

This is the plan. Run from his machine, with the repo checked out at the code
being deployed and the tunnel open in a second terminal
(`infra/aws/scripts/db-tunnel.sh 120`).

**1. Read-only look at the old database (no yes needed beyond running it).**

```bash
read -rs SOURCE_DATABASE_URL && export SOURCE_DATABASE_URL   # Supabase, port 5432
scripts/migration/export-accounts.sh                          # lists email domains with counts
scripts/migration/export-accounts.sh --email-domain DOMAIN    # his accounts, one line each
```

The first run shows every email domain with how many users it has, so the
exact db4commerce domain can be read off it. The second lists each account
that would move (email, role, password or not, artist profile, sign-in
providers) and how many users stay behind. Neither writes anything, here or
on the source.

**2. Save those accounts (still read-only on the source). 🟡 YES**

```bash
scripts/migration/export-accounts.sh --email-domain DOMAIN --execute --out ~/directfanz-accounts
```

The folder is private to his user and holds password hashes and emails, so it
stays on his machine and is deleted after step 4.

**3. Build the new database. 🟡 YES** (writes to RDS)

```bash
read -rs TARGET_DATABASE_URL && export TARGET_DATABASE_URL    # RDS via the tunnel
DATABASE_URL="$TARGET_DATABASE_URL" npx prisma db push --skip-generate   # merged schema
LAST=$(ls -1 prisma/migrations | grep -v toml | sort | tail -1)
scripts/migration/baseline.sh --matches-schema prisma/schema.prisma --applied-through "$LAST"
CONFIRM_TARGET_HOST=127.0.0.1 scripts/migration/baseline.sh \
  --matches-schema prisma/schema.prisma --applied-through "$LAST" --execute
scripts/migration/check-schema.sh                                        # must say IN STEP
```

**4. Load the accounts. 🟡 YES** (writes to RDS)

```bash
scripts/migration/import-accounts.sh --dump-dir ~/directfanz-accounts     # check, rolled back
CONFIRM_TARGET_HOST=127.0.0.1 \
  scripts/migration/import-accounts.sh --dump-dir ~/directfanz-accounts --execute
rm -rf ~/directfanz-accounts
```

The check runs the whole load in one transaction and rolls it back, so types,
constraints and counts are proven before anything is kept. It refuses altered
files, a Supabase target and users that are already there. After this, every
later release runs `prisma migrate deploy` normally.

## Copy path, for reference only (not the plan)

Kept in case the decision changes. It copies everything with `export.sh`,
`import.sh`, `verify.sh` and `baseline.sh`.

### Full copy, step by step

Run from a machine with the repo checked out at the code being deployed.

```bash
read -rs SOURCE_DATABASE_URL && export SOURCE_DATABASE_URL   # Supabase, port 5432
read -rs TARGET_DATABASE_URL && export TARGET_DATABASE_URL   # RDS via the tunnel

scripts/migration/export.sh                          # 1. dry run: counts, versions
```

RUNBOOK step 7 runs these steps once as a trial into `directfanz`, so the
first deploy has real data to test against. Inside the maintenance window
(RUNBOOK step 11), with that trial emptied first, they run for real:

```bash
scripts/migration/export.sh --execute --out ~/directfanz-export-final   # 2. copy out
scripts/migration/import.sh --dump-dir ~/directfanz-export-final          # 3. dry run
CONFIRM_TARGET_HOST=127.0.0.1 \
  scripts/migration/import.sh --dump-dir ~/directfanz-export-final --execute   # 4. restore + verify
scripts/migration/verify.sh --live                                         # 5. both live, must say VERIFIED

git show fa9087d:prisma/schema.prisma > /tmp/schema-before.prisma         # schema Supabase holds today
scripts/migration/baseline.sh --matches-schema /tmp/schema-before.prisma \
  --applied-through 20250923_add_ai_features                               # 6. dry run
CONFIRM_TARGET_HOST=127.0.0.1 scripts/migration/baseline.sh \
  --matches-schema /tmp/schema-before.prisma \
  --applied-through 20250923_add_ai_features --execute                     # 7. record history
```

Step 8 is `prisma migrate deploy`, run by "Deploy to AWS (manual)" from PR #56
with migrations on. Then `check-schema.sh` must say IN STEP.

If `baseline.sh` says the database doesn't match `schema-before.prisma`,
Supabase has drifted from the repo. Stop there: compare the printed SQL with
the repo and decide what is right before going further.

## If verification fails (copy path)

- **Before switching traffic:** don't switch. The old site is untouched.
  Empty the RDS database (drop and recreate its `public` schema, with
  Demetrius's yes) and run the export and import again into a new folder.
- **"The source changed while the dump ran":** something is still writing.
  Check maintenance mode is on and the scheduled calls are paused, then export
  again.
- **A table differs only in a JSON or date column:** both sides must use the
  scripts' session settings (UTC, ISO dates). Run `verify.sh --live` rather than
  comparing by hand.

## Rehearsed locally on Nov 23, 2026

Fresh start (the plan), on a source seeded with 500 other users, two accounts
on the chosen domain (one artist with a Stripe account and earnings, one with
a Google link and stored tokens) and one look-alike domain: the export held
exactly the two accounts, with the old tokens and Stripe id gone; the check
kept nothing; the load gave a database built from PR #54's schema exactly 2
users, 1 artist and 1 sign-in link; the password hash came across unchanged;
loading twice, altered files and a missing confirm were all refused. With the
rest below, 48 of 48 checks passed.

Full copy path:

`scripts/migration/rehearse-local.sh` on two throwaway Postgres 16 servers,
with a source built by `prisma db push`, 742 sample rows (Unicode, JSON,
decimals, nulls) and a Supabase-style policy:

- Copy path: 20 of 20 checks passed, including every refusal (wrong confirm
  host, target is source, altered archive, non-empty target) and a single
  changed row being caught.
- With `--next-prisma-dir` pointing at PR #54's `prisma/` folder as it stands:
  `migrate deploy` fails on `20261122_drop_presales` (finding 1).
- With the same folder renamed as in the table above: every check passed. The copy
  was baselined, the eight new migrations applied, the result matched #54's
  schema, and every row was still there. The fresh path also passed.
- Finding 2 reproduced: migrations alone differ from the schema by 101
  statements.

Not covered locally: Supabase itself, RDS, network and TLS between them, and
Postgres 15 or 17 on either side.
