#!/usr/bin/env bash
# Give a copied database the Prisma migration history it never had.
#
# Production was built with `prisma db push`, so it has no _prisma_migrations
# table. Without one, `prisma migrate deploy` would try to run every migration
# from the start and fail on tables that already exist. This script records the
# migrations the database already reflects as applied, so that `migrate deploy`
# then runs only the newer ones (for example PR #54's).
#
# Dry run by default. It refuses unless the database matches, exactly, the
# schema the old migrations describe (checked with `prisma migrate diff`).
#
#   TARGET_DATABASE_URL=... scripts/migration/baseline.sh \
#     --matches-schema /path/to/schema-before.prisma \
#     --applied-through 20250923_add_ai_features [--execute]
#
# --matches-schema   the schema the database holds today, e.g. from
#                    `git show fa9087d:prisma/schema.prisma > /tmp/schema-before.prisma`
# --applied-through  the last migration folder (by name) the database already
#                    reflects; it and every earlier folder are marked applied
# --prisma-schema    schema of the code being deployed (default prisma/schema.prisma);
#                    its migrations/ folder is the one recorded

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MATCHES=""
THROUGH=""
DEPLOY_SCHEMA="$REPO_ROOT/prisma/schema.prisma"
EXECUTE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --matches-schema)
      MATCHES="${2:-}"
      shift
      ;;
    --applied-through)
      THROUGH="${2:-}"
      shift
      ;;
    --prisma-schema)
      DEPLOY_SCHEMA="${2:-}"
      shift
      ;;
    --execute) EXECUTE=1 ;;
    -h | --help)
      sed -n '2,24p' "$0"
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done
[[ -f "$MATCHES" ]] || die "--matches-schema file not found"
[[ -f "$DEPLOY_SCHEMA" ]] || die "--prisma-schema file not found"
[[ -n "$THROUGH" ]] || die "--applied-through is required"
[[ -n "${TARGET_DATABASE_URL:-}" ]] || die "TARGET_DATABASE_URL is not set"
[[ -x "$REPO_ROOT/node_modules/.bin/prisma" ]] || die "run npm ci first"
require_tool psql

MIGRATIONS_DIR="$(cd "$(dirname "$DEPLOY_SCHEMA")" && pwd)/migrations"
[[ -d "$MIGRATIONS_DIR/$THROUGH" ]] || die "no migration folder named $THROUGH in $MIGRATIONS_DIR"

load_conn TGT TARGET_DATABASE_URL
TGT_HOST="$(host_of TGT)"
log "Database: $(describe TGT)"
if looks_like_supabase "$TGT_HOST"; then
  die "this is meant for the new RDS copy, not the Supabase original"
fi

if [[ "$(psql_q TGT "SELECT to_regclass('public._prisma_migrations') IS NOT NULL")" == "t" ]]; then
  N="$(psql_q TGT "SELECT count(*) FROM public._prisma_migrations")"
  [[ "$N" == "0" ]] || die "the database already has a migration history ($N rows); nothing to baseline"
fi

prisma_on_target() {
  (cd "$REPO_ROOT" && env DATABASE_URL="$TARGET_DATABASE_URL" PRISMA_HIDE_UPDATE_MESSAGE=1 \
    "$REPO_ROOT/node_modules/.bin/prisma" "$@")
}

log "Checking the database matches ${MATCHES}..."
prisma_on_target migrate diff --from-schema-datasource "$DEPLOY_SCHEMA" --to-schema-datamodel "$MATCHES" \
  --script >"$WORK_TMP/drift.sql"
if grep -qvE '^(-- This is an empty migration\.)?$' "$WORK_TMP/drift.sql"; then
  cat "$WORK_TMP/drift.sql" >&2
  die "the database does not match that schema, so the old migrations can't be marked applied safely"
fi
log "It matches."

mapfile -t TO_MARK < <(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort |
  awk -v last="$THROUGH" '{ print } $0 == last { exit }')
log "Would mark as applied:"
printf '  %s\n' "${TO_MARK[@]}" >&2
LATER="$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort |
  awk -v last="$THROUGH" 'found { print "  " $0 } $0 == last { found = 1 }')"
log "Left for 'prisma migrate deploy' to run afterwards:"
log "${LATER:-  (none)}"

if ((EXECUTE == 0)); then
  log ""
  log "DRY RUN: nothing was written. Re-run with --execute and CONFIRM_TARGET_HOST=$TGT_HOST."
  exit 0
fi
[[ "${CONFIRM_TARGET_HOST:-}" == "$TGT_HOST" ]] || die "set CONFIRM_TARGET_HOST=$TGT_HOST to confirm"

for m in "${TO_MARK[@]}"; do
  prisma_on_target migrate resolve --applied "$m" --schema "$DEPLOY_SCHEMA" >&2
done
log ""
log "Baseline recorded. Migration status now:"
prisma_on_target migrate status --schema "$DEPLOY_SCHEMA" >&2 || true
