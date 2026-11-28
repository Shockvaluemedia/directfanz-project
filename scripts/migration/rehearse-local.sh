#!/usr/bin/env bash
# Rehearse the whole database copy on two throwaway local Postgres servers.
# Touches nothing outside a temporary folder: no real database, no network.
#
#   scripts/migration/rehearse-local.sh [--schema path/to/schema.prisma] [--next-prisma-dir DIR]
#
# Needs: Postgres server binaries (initdb, pg_ctl, postgres; set PG_BIN if they
# are not on PATH), node, and `npm ci` already run (for the Prisma CLI).
# When run as root, the local servers run as the `postgres` OS user.
#
# What it checks:
#  1. Build a "source" shaped like production today (schema from `prisma db push`,
#     no migration history, Supabase-style row-level security) with sample rows.
#  2. export.sh dry run, then --execute.
#  3. import.sh dry run; --execute refused without the right CONFIRM_TARGET_HOST;
#     --execute with it; verification passes.
#  4. verify.sh in both modes passes; check-schema.sh shows the schema in step.
#  5. A changed row on the target makes verify.sh fail; a second import into the
#     now non-empty target is refused.
#  6. With --next-prisma-dir (a prisma/ folder from the code about to ship, e.g.
#     PR #54's): baseline.sh marks the old migrations applied on the copy, then
#     `prisma migrate deploy` runs the new ones, and the result must match the
#     new schema with every row still there.
#  7. Fresh-database path: `prisma migrate deploy` on an empty database, then
#     check-schema.sh, to show whether the migrations alone rebuild the schema.
#     A difference is reported as a FINDING, not a failure of the copy scripts.
#  8. Fresh start that keeps only the owner's accounts: export-accounts.sh and
#     import-accounts.sh carry the users on one email domain (with their artist
#     profile and sign-in links, tokens and Stripe ids emptied) into a database
#     built with `prisma db push`, and nothing else.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SCHEMA="$REPO_ROOT/prisma/schema.prisma"
NEXT_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --schema)
      SCHEMA="$(cd "$(dirname "${2:-}")" && pwd)/$(basename "${2:-}")"
      shift
      ;;
    --next-prisma-dir)
      NEXT_DIR="$(cd "${2:-}" && pwd)"
      shift
      ;;
    -h | --help)
      sed -n '2,33p' "$0"
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

if [[ -z "${PG_BIN:-}" ]]; then
  for d in /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin; do
    [[ -x "$d/initdb" ]] && PG_BIN="$d"
  done
  [[ -n "${PG_BIN:-}" ]] && export PATH="$PG_BIN:$PATH"
fi
require_tool initdb
require_tool pg_ctl
require_tool openssl
[[ -x "$REPO_ROOT/node_modules/.bin/prisma" ]] || die "run npm ci first"

RUN_AS=()
if [[ "$(id -u)" == "0" ]]; then
  id postgres >/dev/null 2>&1 || die "running as root needs a 'postgres' OS user for the local servers"
  RUN_AS=(runuser -u postgres --)
fi

R="$(mktemp -d "${TMPDIR:-/tmp}/directfanz-rehearsal.XXXXXX")"
chmod 755 "$R"
if ((${#RUN_AS[@]})); then chown postgres "$R"; fi
PW="$(openssl rand -hex 16)" # throwaway password for these local servers only
printf '%s\n' "$PW" >"$R/pw"
chmod 644 "$R/pw"
SRC_PORT_N=55432
TGT_PORT_N=55433

PASS=0
FAIL=0
FINDINGS=0
step() { log ""; log "=== $* ==="; }
ok() { log "PASS: $*"; PASS=$((PASS + 1)); }
bad() { log "FAIL: $*"; FAIL=$((FAIL + 1)); }
expect_ok() {
  local what="$1"; shift
  if "$@"; then ok "$what"; else bad "$what"; fi
}
expect_fail() {
  local what="$1"; shift
  if "$@"; then bad "$what (it should have been refused)"; else ok "$what"; fi
}

cleanup() {
  for p in "$SRC_PORT_N" "$TGT_PORT_N"; do
    [[ -d "$R/pg$p" ]] && "${RUN_AS[@]}" pg_ctl -D "$R/pg$p" -m immediate stop >/dev/null 2>&1 || true
  done
  rm -rf "$R" "$WORK_TMP"
}
trap cleanup EXIT

start_server() {
  local port="$1"
  "${RUN_AS[@]}" initdb -D "$R/pg$port" -U postgres --auth=scram-sha-256 --pwfile="$R/pw" >/dev/null
  "${RUN_AS[@]}" pg_ctl -D "$R/pg$port" -l "$R/pg$port.log" -w \
    -o "-p $port -k $R -c listen_addresses=127.0.0.1" start >/dev/null
}

step "Start two throwaway Postgres servers ($(postgres --version))"
start_server "$SRC_PORT_N"
start_server "$TGT_PORT_N"
url() { printf 'postgresql://postgres:%s@127.0.0.1:%s/%s?sslmode=disable' "$PW" "$1" "$2"; }
admin() { env PGPASSWORD="$PW" psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$1" -U postgres -d "$2" -c "$3"; }
admin "$SRC_PORT_N" postgres "CREATE DATABASE directfanz"
admin "$TGT_PORT_N" postgres "CREATE DATABASE directfanz"
admin "$TGT_PORT_N" postgres "CREATE DATABASE fresh"

step "Build a production-shaped source with prisma db push and sample rows"
(cd "$REPO_ROOT" && env DATABASE_URL="$(url "$SRC_PORT_N" directfanz)" PRISMA_HIDE_UPDATE_MESSAGE=1 \
  node_modules/.bin/prisma db push --skip-generate --schema "$SCHEMA" >"$R/dbpush.log" 2>&1) ||
  { cat "$R/dbpush.log" >&2; die "prisma db push failed"; }
admin "$SRC_PORT_N" directfanz "
  INSERT INTO users (id, email, \"displayName\", \"updatedAt\", \"socialLinks\", bio)
  SELECT 'u' || g, 'fan' || g || '@example.test', 'Fan ' || g || ' – é ü 🎵', now() - (g || ' minutes')::interval,
         jsonb_build_object('ig', '@fan' || g), CASE WHEN g % 3 = 0 THEN NULL ELSE E'line one\nline two' END
  FROM generate_series(1, 500) g;
  UPDATE users SET role = 'ARTIST' WHERE id IN ('u1', 'u2');
  INSERT INTO artists (id, \"userId\", \"totalEarnings\", \"updatedAt\")
  VALUES ('a1', 'u1', 1234.56, now()), ('a2', 'u2', 0.10, now());
  INSERT INTO content (id, \"artistId\", title, type, \"fileUrl\", \"fileSize\", format, tags, \"updatedAt\")
  SELECT 'c' || g, CASE WHEN g % 2 = 0 THEN 'u1' ELSE 'u2' END, 'Track ' || g, 'AUDIO',
         'https://files.example.test/' || g || '.mp3', 1000 * g, 'mp3', 'single', now()
  FROM generate_series(1, 40) g;
  DO \$\$ BEGIN
    IF to_regclass('public.follows') IS NOT NULL THEN
      INSERT INTO follows (id, \"followerId\", \"followedId\")
      SELECT 'f' || g, 'u' || (g + 2), 'u1' FROM generate_series(1, 200) g;
    END IF;
  END \$\$;
  -- The owner's own accounts (kept in a fresh start), and a look-alike domain that must not be:
  INSERT INTO users (id, email, \"displayName\", \"updatedAt\", password, role) VALUES
    ('d1', 'Owner@DB4Commerce.test', 'Owner', now(), '\$2b\$12\$ownerhashownerhashownerhash', 'ARTIST'),
    ('d2', 'team@db4commerce.test', 'Team – é', now(), '\$2b\$12\$teamhashteamhashteamhash', 'FAN'),
    ('d3', 'someone@db4commerce.test.evil', 'Not ours', now(), NULL, 'FAN');
  INSERT INTO artists (id, \"userId\", \"stripeAccountId\", \"isStripeOnboarded\", \"totalEarnings\", \"updatedAt\")
  VALUES ('a3', 'd1', 'acct_oldtest123', true, 99.50, now());
  INSERT INTO accounts (id, \"userId\", type, provider, \"providerAccountId\", access_token, refresh_token)
  VALUES ('x1', 'd2', 'oauth', 'google', 'google-123', 'old-access-token', 'old-refresh-token');
  -- Supabase-style extras that RDS does not have:
  CREATE ROLE authenticated NOLOGIN;
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  CREATE POLICY own_row ON users FOR SELECT TO authenticated USING (true);
  COMMENT ON SCHEMA public IS 'standard public schema';
" >/dev/null
ok "source built: $(admin "$SRC_PORT_N" directfanz "SELECT count(*) FROM users" >/dev/null && echo ready)"

export SOURCE_DATABASE_URL TARGET_DATABASE_URL
SOURCE_DATABASE_URL="$(url "$SRC_PORT_N" directfanz)"
TARGET_DATABASE_URL="$(url "$TGT_PORT_N" directfanz)"
EXPORT_DIR="$R/export"

step "export.sh dry run"
expect_ok "export dry run" "$MIG_DIR/export.sh"
[[ ! -e "$EXPORT_DIR" ]] && ok "dry run wrote nothing"

step "export.sh --execute"
expect_fail "export refuses a folder inside the repo" "$MIG_DIR/export.sh" --execute --out "$REPO_ROOT/.rehearsal-export"
rm -rf "$REPO_ROOT/.rehearsal-export"
expect_ok "export --execute" "$MIG_DIR/export.sh" --execute --out "$EXPORT_DIR"
cat "$EXPORT_DIR/manifest.txt" >&2
if grep -q "$PW" "$EXPORT_DIR/manifest.txt" "$EXPORT_DIR/toc.txt"; then bad "password found in export metadata"; else ok "no password in export metadata"; fi

step "import.sh dry run and guards"
expect_ok "import dry run" "$MIG_DIR/import.sh" --dump-dir "$EXPORT_DIR"
[[ "$(admin "$TGT_PORT_N" directfanz "SELECT 1" >/dev/null; env PGPASSWORD="$PW" psql -X -A -t -h 127.0.0.1 -p "$TGT_PORT_N" -U postgres -d directfanz -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'")" == "0" ]] &&
  ok "dry run left the target empty"
expect_fail "import refused without CONFIRM_TARGET_HOST" "$MIG_DIR/import.sh" --dump-dir "$EXPORT_DIR" --execute
expect_fail "import refused with the wrong CONFIRM_TARGET_HOST" env CONFIRM_TARGET_HOST=wrong.example "$MIG_DIR/import.sh" --dump-dir "$EXPORT_DIR" --execute
expect_fail "import refused when the target is the source" env TARGET_DATABASE_URL="$SOURCE_DATABASE_URL" CONFIRM_TARGET_HOST=127.0.0.1 "$MIG_DIR/import.sh" --dump-dir "$EXPORT_DIR" --execute
cp "$EXPORT_DIR/public.dump" "$R/dump.bak"
printf 'x' >>"$EXPORT_DIR/public.dump"
expect_fail "import refused when the archive was altered" "$MIG_DIR/import.sh" --dump-dir "$EXPORT_DIR"
cp "$R/dump.bak" "$EXPORT_DIR/public.dump"

step "import.sh --execute"
expect_ok "import --execute (restore and verify)" env CONFIRM_TARGET_HOST=127.0.0.1 "$MIG_DIR/import.sh" --dump-dir "$EXPORT_DIR" --execute

step "verify.sh and check-schema.sh"
expect_ok "verify against the export snapshot" "$MIG_DIR/verify.sh" --dump-dir "$EXPORT_DIR"
expect_ok "verify live, source against target" "$MIG_DIR/verify.sh" --live
expect_ok "check-schema: target matches the schema file" "$MIG_DIR/check-schema.sh" --schema "$SCHEMA"
[[ "$(env PGPASSWORD="$PW" psql -X -A -t -h 127.0.0.1 -p "$TGT_PORT_N" -U postgres -d directfanz -c "SELECT count(*) FROM pg_policies WHERE schemaname='public'")" == "0" ]] &&
  ok "Supabase-style policies were left out of the target"

step "Negative checks"
admin "$TGT_PORT_N" directfanz "UPDATE users SET bio = 'changed' WHERE id = 'u7'" >/dev/null
expect_fail "verify catches one changed row" "$MIG_DIR/verify.sh" --dump-dir "$EXPORT_DIR"
expect_fail "import refuses a non-empty target" env CONFIRM_TARGET_HOST=127.0.0.1 "$MIG_DIR/import.sh" --dump-dir "$EXPORT_DIR" --execute

if [[ -n "$NEXT_DIR" ]]; then
  step "Upgrade the copy to the next schema (${NEXT_DIR})"
  admin "$TGT_PORT_N" postgres "CREATE DATABASE upgrade" >/dev/null
  UP_URL="$(url "$TGT_PORT_N" upgrade)"
  env TARGET_DATABASE_URL="$UP_URL" CONFIRM_TARGET_HOST=127.0.0.1 "$MIG_DIR/import.sh" --dump-dir "$EXPORT_DIR" --execute 2>"$R/up-import.log" ||
    { cat "$R/up-import.log" >&2; die "import into the upgrade database failed"; }
  LAST_OLD="$(find "$(dirname "$SCHEMA")/migrations" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort | tail -1)"
  expect_ok "baseline dry run" env TARGET_DATABASE_URL="$UP_URL" "$MIG_DIR/baseline.sh" \
    --matches-schema "$SCHEMA" --applied-through "$LAST_OLD" --prisma-schema "$NEXT_DIR/schema.prisma"
  expect_ok "baseline --execute (old migrations marked applied through $LAST_OLD)" env TARGET_DATABASE_URL="$UP_URL" CONFIRM_TARGET_HOST=127.0.0.1 \
    "$MIG_DIR/baseline.sh" --matches-schema "$SCHEMA" --applied-through "$LAST_OLD" --prisma-schema "$NEXT_DIR/schema.prisma" --execute
  expect_fail "baseline refuses to run twice" env TARGET_DATABASE_URL="$UP_URL" CONFIRM_TARGET_HOST=127.0.0.1 \
    "$MIG_DIR/baseline.sh" --matches-schema "$SCHEMA" --applied-through "$LAST_OLD" --prisma-schema "$NEXT_DIR/schema.prisma" --execute
  if (cd "$REPO_ROOT" && env DATABASE_URL="$UP_URL" PRISMA_HIDE_UPDATE_MESSAGE=1 \
    node_modules/.bin/prisma migrate deploy --schema "$NEXT_DIR/schema.prisma" >"$R/up-deploy.log" 2>&1); then
    ok "migrate deploy ran the new migrations on the copy: $(grep -c 'Applying migration' "$R/up-deploy.log" || true) applied"
  else
    cat "$R/up-deploy.log" >&2
    bad "migrate deploy failed on the copied database"
  fi
  expect_ok "upgraded copy matches the next schema" env TARGET_DATABASE_URL="$UP_URL" "$MIG_DIR/check-schema.sh" --schema "$NEXT_DIR/schema.prisma"
  for t in users artists content follows; do
    a="$(env PGPASSWORD="$PW" psql -X -A -t -h 127.0.0.1 -p "$SRC_PORT_N" -U postgres -d directfanz -c "SELECT count(*) FROM public.$t" 2>/dev/null || echo none)"
    b="$(env PGPASSWORD="$PW" psql -X -A -t -h 127.0.0.1 -p "$TGT_PORT_N" -U postgres -d upgrade -c "SELECT count(*) FROM public.$t" 2>/dev/null || echo none)"
    if [[ "$a" == "$b" ]]; then ok "rows kept through the upgrade: $t $b"; else bad "row count changed in $t: $a -> $b"; fi
  done
fi

step "Fresh-database path: prisma migrate deploy on an empty database"
if (cd "$REPO_ROOT" && env DATABASE_URL="$(url "$TGT_PORT_N" fresh)" PRISMA_HIDE_UPDATE_MESSAGE=1 \
  node_modules/.bin/prisma migrate deploy --schema "$SCHEMA" >"$R/deploy.log" 2>&1); then
  ok "migrate deploy ran on an empty database"
  if env TARGET_DATABASE_URL="$(url "$TGT_PORT_N" fresh)" "$MIG_DIR/check-schema.sh" --schema "$SCHEMA" 2>"$R/fresh-check.log"; then
    ok "migrations alone rebuild the full schema"
  else
    log "FINDING: migrations alone do NOT rebuild the schema. First differences:"
    grep -E '^(CREATE|ALTER|DROP)' "$R/fresh-check.log" | head -15 >&2 || true
    log "  ($(grep -cE '^(CREATE|ALTER|DROP)' "$R/fresh-check.log" || true) statements in all; see docs/migration/DATABASE_COPY.md)"
    FINDINGS=$((FINDINGS + 1))
  fi
else
  sed -n '1,40p' "$R/deploy.log" >&2
  bad "migrate deploy failed on an empty database"
fi

if [[ -n "$NEXT_DIR" ]]; then
  step "Fresh-database workaround: db push the next schema, then baseline every migration"
  admin "$TGT_PORT_N" postgres "CREATE DATABASE fresh2" >/dev/null
  F2_URL="$(url "$TGT_PORT_N" fresh2)"
  (cd "$REPO_ROOT" && env DATABASE_URL="$F2_URL" PRISMA_HIDE_UPDATE_MESSAGE=1 \
    node_modules/.bin/prisma db push --skip-generate --schema "$NEXT_DIR/schema.prisma" >"$R/f2-push.log" 2>&1) ||
    { cat "$R/f2-push.log" >&2; die "db push of the next schema failed"; }
  LAST_NEXT="$(find "$NEXT_DIR/migrations" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort | tail -1)"
  expect_ok "baseline all migrations through $LAST_NEXT" env TARGET_DATABASE_URL="$F2_URL" CONFIRM_TARGET_HOST=127.0.0.1 \
    "$MIG_DIR/baseline.sh" --matches-schema "$NEXT_DIR/schema.prisma" --applied-through "$LAST_NEXT" \
    --prisma-schema "$NEXT_DIR/schema.prisma" --execute
  expect_ok "migrate deploy afterwards has nothing left to do" \
    env DATABASE_URL="$F2_URL" PRISMA_HIDE_UPDATE_MESSAGE=1 bash -c \
    'cd "$1" && node_modules/.bin/prisma migrate deploy --schema "$2" 2>&1 | grep -q "No pending migrations"' _ "$REPO_ROOT" "$NEXT_DIR/schema.prisma"
fi

step "Fresh start, carrying only the accounts on one email domain"
admin "$TGT_PORT_N" postgres "CREATE DATABASE carry" >/dev/null
CARRY_URL="$(url "$TGT_PORT_N" carry)"
CARRY_SCHEMA="$SCHEMA"
[[ -n "$NEXT_DIR" ]] && CARRY_SCHEMA="$NEXT_DIR/schema.prisma"
(cd "$REPO_ROOT" && env DATABASE_URL="$CARRY_URL" PRISMA_HIDE_UPDATE_MESSAGE=1 \
  node_modules/.bin/prisma db push --skip-generate --schema "$CARRY_SCHEMA" >"$R/carry-push.log" 2>&1) ||
  { cat "$R/carry-push.log" >&2; die "db push for the fresh start failed"; }
ACC_DIR="$R/accounts"
q_carry() { env PGPASSWORD="$PW" psql -X -A -t -h 127.0.0.1 -p "$TGT_PORT_N" -U postgres -d carry -c "$1"; }
expect_ok "export-accounts lists the email domains" "$MIG_DIR/export-accounts.sh"
expect_ok "export-accounts dry run for db4commerce.test" "$MIG_DIR/export-accounts.sh" --email-domain db4commerce.test
[[ ! -e "$ACC_DIR" ]] && ok "accounts dry run wrote nothing"
expect_fail "export-accounts refuses a domain with no users" "$MIG_DIR/export-accounts.sh" --email-domain nobody.test --execute --out "$R/none"
expect_fail "export-accounts refuses a folder inside the repo" "$MIG_DIR/export-accounts.sh" --email-domain db4commerce.test --execute --out "$REPO_ROOT/.rehearsal-accounts"
expect_ok "export-accounts --execute" "$MIG_DIR/export-accounts.sh" --email-domain db4commerce.test --execute --out "$ACC_DIR"
if [[ ! -f "$ACC_DIR/users.csv" ]] || grep -qE 'example\.test|\.evil|old-access-token|old-refresh-token|acct_oldtest123' "$ACC_DIR"/*.csv; then
  bad "the export holds other users, old tokens or old Stripe ids"
else
  ok "the export holds only the two accounts, with tokens and Stripe ids emptied"
fi
export TARGET_DATABASE_URL="$CARRY_URL"
expect_ok "import-accounts check (rolled back)" "$MIG_DIR/import-accounts.sh" --dump-dir "$ACC_DIR"
[[ "$(q_carry "SELECT count(*) FROM users")" == "0" ]] && ok "the check kept nothing"
expect_fail "import-accounts refused without CONFIRM_TARGET_HOST" "$MIG_DIR/import-accounts.sh" --dump-dir "$ACC_DIR" --execute
expect_ok "import-accounts --execute" env CONFIRM_TARGET_HOST=127.0.0.1 "$MIG_DIR/import-accounts.sh" --dump-dir "$ACC_DIR" --execute
GOT="$(q_carry "SELECT (SELECT count(*) FROM users) || ' ' || (SELECT count(*) FROM artists) || ' ' || (SELECT count(*) FROM accounts)")"
if [[ "$GOT" == "2 1 1" ]]; then ok "fresh database has exactly 2 users, 1 artist, 1 sign-in link"; else bad "unexpected counts on the fresh database: $GOT"; fi
SRC_HASH="$(env PGPASSWORD="$PW" psql -X -A -t -h 127.0.0.1 -p "$SRC_PORT_N" -U postgres -d directfanz -c "SELECT password FROM users WHERE id = 'd1'")"
[[ "$(q_carry "SELECT password FROM users WHERE id = 'd1'")" == "$SRC_HASH" ]] && ok "password hash carried unchanged (same password signs in)" || bad "password hash changed"
[[ "$(q_carry "SELECT coalesce(\"stripeAccountId\", 'none') || ' ' || \"isStripeOnboarded\" || ' ' || (\"totalEarnings\" = 0) FROM artists")" == "none false true" ]] &&
  ok "artist profile carried with Stripe reset" || bad "artist Stripe fields not reset"
[[ "$(q_carry "SELECT provider || ' ' || coalesce(access_token, 'none') || ' ' || coalesce(refresh_token, 'none') FROM accounts")" == "google none none" ]] &&
  ok "Google sign-in link carried without its old tokens" || bad "sign-in link tokens not emptied"
expect_fail "import-accounts refuses to load the same users twice" env CONFIRM_TARGET_HOST=127.0.0.1 "$MIG_DIR/import-accounts.sh" --dump-dir "$ACC_DIR" --execute
cp -r "$ACC_DIR" "$R/accounts-tampered"
sed -i 's/Team/Tampered/' "$R/accounts-tampered/users.csv"
expect_fail "import-accounts refuses altered files" "$MIG_DIR/import-accounts.sh" --dump-dir "$R/accounts-tampered"

log ""
log "Rehearsal finished: $PASS passed, $FAIL failed, $FINDINGS finding(s)."
((FAIL == 0))
