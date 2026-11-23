# Copying the DirectFanz database to RDS

How to move today's Postgres data into the new RDS database, prove the copy is
exact, and get Prisma's migration history right. The scripts live in
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

## Choose a path

| | Copy path | Fresh path |
| --- | --- | --- |
| When | Supabase holds real accounts, purchases or content worth keeping | Only test data; the community is set up new (Nahvee first, then Never More) |
| Steps | export, import, verify, baseline the old migrations, `migrate deploy` the new ones | `prisma db push` the merged schema, baseline every migration |
| Downtime | Minutes of maintenance mode during the final copy | None |

`export.sh`'s dry run prints every table's row count, which settles the
choice. Demetrius decides; nothing is deleted either way, and Supabase stays
as it is until the rollback window ends.

## Before running anything for real

- **Postgres client tools** at least as new as the source server. The dry run
  checks and stops if `pg_dump` is too old; set `PG_BIN` to a newer client's
  `bin` folder (for example `/usr/lib/postgresql/17/bin`).
- **Node and the repo's packages** (`npm ci`) for the Prisma steps.
- **The source URL:** Supabase's _session pooler_ or direct connection on port
  5432. The transaction pooler on port 6543 doesn't work with `pg_dump`, and
  the scripts refuse it.
- **A route to RDS.** RDS sits in private subnets with no public address, and
  PR #56 doesn't yet include a way in. The ask is ECS Exec on the service (one
  setting plus SSM permissions on the task role), so an SSM port forward from
  Demetrius's machine reaches the database as `127.0.0.1:5432`. Then
  `TARGET_DATABASE_URL` uses host `127.0.0.1`, database `directfanz` and
  `sslmode=require`. The login is in the RDS-managed secret; he reads it into
  his own shell and nowhere else.
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
| `rehearse-local.sh` | The whole thing on two throwaway local Postgres servers, with guard and tamper tests. | A temp folder, deleted after |

## Copy path, step by step

Run from a machine with the repo checked out at the code being deployed.

```bash
read -rs SOURCE_DATABASE_URL && export SOURCE_DATABASE_URL   # Supabase, port 5432
read -rs TARGET_DATABASE_URL && export TARGET_DATABASE_URL   # RDS via the port forward

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

## Fresh path, step by step

```bash
read -rs TARGET_DATABASE_URL && export TARGET_DATABASE_URL
DATABASE_URL="$TARGET_DATABASE_URL" npx prisma db push --skip-generate   # merged schema
LAST=$(ls -1 prisma/migrations | grep -v toml | sort | tail -1)
scripts/migration/baseline.sh --matches-schema prisma/schema.prisma --applied-through "$LAST"
CONFIRM_TARGET_HOST=127.0.0.1 scripts/migration/baseline.sh \
  --matches-schema prisma/schema.prisma --applied-through "$LAST" --execute
scripts/migration/check-schema.sh                                        # must say IN STEP
```

`prisma db push` writes to the database, so it needs the same yes as the
import. After this, every later release runs `prisma migrate deploy` normally.

## If verification fails

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

`scripts/migration/rehearse-local.sh` on two throwaway Postgres 16 servers,
with a source built by `prisma db push`, 742 sample rows (Unicode, JSON,
decimals, nulls) and a Supabase-style policy:

- Copy path: 20 of 20 checks passed, including every refusal (wrong confirm
  host, target is source, altered archive, non-empty target) and a single
  changed row being caught.
- With `--next-prisma-dir` pointing at PR #54's `prisma/` folder as it stands:
  `migrate deploy` fails on `20261122_drop_presales` (finding 1).
- With the same folder renamed as in the table above: 31 of 31 passed. The copy
  was baselined, the eight new migrations applied, the result matched #54's
  schema, and every row was still there. The fresh path also passed.
- Finding 2 reproduced: migrations alone differ from the schema by 101
  statements.

Not covered locally: Supabase itself, RDS, network and TLS between them, and
Postgres 15 or 17 on either side.
