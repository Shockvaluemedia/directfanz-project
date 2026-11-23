#!/usr/bin/env bash
# Read-only check of a database's schema against this branch's
# prisma/schema.prisma and prisma/migrations. Run it on the new database after
# the import (or after a fresh setup), before `prisma migrate deploy`.
#
#   TARGET_DATABASE_URL=... scripts/migration/check-schema.sh [--schema path/to/schema.prisma]
#
# Reports:
# 1. Prisma's migration history on that database (`prisma migrate status`)
# 2. The SQL it would take to make the database match the schema file
#    (`prisma migrate diff`, printed, never applied). Empty means in step.
#
# Writes nothing to the database. The URL reaches Prisma only through its
# environment, never on a command line.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SCHEMA="$REPO_ROOT/prisma/schema.prisma"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --schema)
      SCHEMA="${2:-}"
      shift
      ;;
    -h | --help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done
[[ -f "$SCHEMA" ]] || die "schema file not found: $SCHEMA"
[[ -n "${TARGET_DATABASE_URL:-}" ]] || die "TARGET_DATABASE_URL is not set"
[[ -x "$REPO_ROOT/node_modules/.bin/prisma" ]] || die "run npm ci first (prisma CLI not found in node_modules)"

load_conn TGT TARGET_DATABASE_URL
log "Database: $(describe TGT)"
log "Schema file: ${SCHEMA#"$REPO_ROOT"/}"

prisma_on_target() {
  (cd "$REPO_ROOT" && env DATABASE_URL="$TARGET_DATABASE_URL" PRISMA_HIDE_UPDATE_MESSAGE=1 \
    "$REPO_ROOT/node_modules/.bin/prisma" "$@")
}

log ""
log "== Migration history (prisma migrate status) =="
set +e
prisma_on_target migrate status --schema "$SCHEMA" >&2
STATUS_RC=$?
set -e
if ((STATUS_RC != 0)); then
  log "(migrate status exit code $STATUS_RC: the history is missing or migrations are pending; see above)"
fi

log ""
log "== SQL needed to match the schema file (not applied) =="
prisma_on_target migrate diff --from-schema-datasource "$SCHEMA" --to-schema-datamodel "$SCHEMA" \
  --script >"$WORK_TMP/drift.sql"
if grep -qvE '^(-- This is an empty migration\.)?$' "$WORK_TMP/drift.sql"; then
  cat "$WORK_TMP/drift.sql" >&2
  log ""
  log "DRIFT: the database differs from ${SCHEMA#"$REPO_ROOT"/}. See docs/migration/DATABASE_COPY.md before running migrations."
  exit 1
fi
log "IN STEP: the database matches ${SCHEMA#"$REPO_ROOT"/}."
