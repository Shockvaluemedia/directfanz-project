#!/usr/bin/env bash
# Restore an export made by export.sh into the new, empty RDS database, then
# verify it row by row against the export's snapshot.
#
# Dry run by default: checks the archive, the target and what would be
# restored, and changes nothing.
#
#   TARGET_DATABASE_URL=... scripts/migration/import.sh --dump-dir DIR
#   TARGET_DATABASE_URL=... CONFIRM_TARGET_HOST=<target host> \
#     scripts/migration/import.sh --dump-dir DIR --execute
#
# Safety checks, all before anything is written:
# - the archive's sha256 matches the one written at export
# - the target is not a Supabase host and not the export's own source
# - the target's public schema has no tables (this never overwrites data)
# - --execute also needs CONFIRM_TARGET_HOST set to the target's host name
# The restore runs in one transaction and stops at the first error, so a
# failure leaves the target as empty as it was.
#
# Left out of the restore: the `public` schema itself (RDS already has it),
# row-level security policies and extensions (Supabase-specific; Prisma uses
# neither). The list of what was left out is printed.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

EXECUTE=0
DUMP_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=1 ;;
    --dump-dir)
      DUMP_DIR="${2:-}"
      shift
      ;;
    -h | --help)
      sed -n '2,24p' "$0"
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

[[ -n "$DUMP_DIR" ]] || die "--dump-dir is required"
for f in public.dump public.dump.sha256 source-snapshot.tsv manifest.txt; do
  [[ -f "$DUMP_DIR/$f" ]] || die "$DUMP_DIR/$f is missing; was this folder written by export.sh --execute?"
done

require_tool psql
require_tool pg_restore

log "Checking the archive's checksum..."
(cd "$DUMP_DIR" && sha256sum --check --quiet public.dump.sha256) || die "public.dump does not match its checksum"

manifest() { grep -E "^$1=" "$DUMP_DIR/manifest.txt" | head -1 | cut -d= -f2-; }
SRC_MAJOR="$(manifest source_server_major)"
DUMP_MAJOR="$(manifest pg_dump_major)"
RESTORE_MAJOR="$(client_major pg_restore)"
if ((RESTORE_MAJOR < DUMP_MAJOR)); then
  die "pg_restore $RESTORE_MAJOR cannot read an archive from pg_dump $DUMP_MAJOR; set PG_BIN to a newer client"
fi

load_conn TGT TARGET_DATABASE_URL
TGT_HOST="$(host_of TGT)"
log "Target: $(describe TGT)"

if looks_like_supabase "$TGT_HOST"; then
  die "the target is a Supabase host; TARGET_DATABASE_URL must be the new RDS database"
fi
if [[ "$TGT_HOST" == "$(manifest source_host)" && "$TGT_PORT" == "$(manifest source_port)" && "$(db_of TGT)" == "$(manifest source_database)" ]]; then
  die "the target is the same database the export came from"
fi

TGT_MAJOR="$(server_major TGT)" || die "could not connect to the target"
log "Target server: Postgres $(server_version TGT); source was $SRC_MAJOR; pg_restore client: $RESTORE_MAJOR"
if ((SRC_MAJOR > TGT_MAJOR)); then
  log "WARNING: restoring from Postgres $SRC_MAJOR into older Postgres $TGT_MAJOR."
  log "  Rehearse this restore on a scratch RDS database first, or create the RDS database at $SRC_MAJOR."
fi

EXISTING="$(public_table_count TGT)"
if [[ "$EXISTING" != "0" ]]; then
  die "the target already has $EXISTING tables in public; this script only restores into an empty database"
fi
log "Target public schema is empty."

# Build the restore list, leaving out what RDS already has or doesn't need.
pg_restore --list "$DUMP_DIR/public.dump" >"$WORK_TMP/full.list"
SKIP_RE='^[0-9]+; [0-9]+ [0-9]+ (SCHEMA - public |COMMENT - SCHEMA public |POLICY |ROW SECURITY |EXTENSION |COMMENT - EXTENSION |ACL |DEFAULT ACL )'
grep -Ev "$SKIP_RE" "$WORK_TMP/full.list" >"$WORK_TMP/restore.list" || true
SKIPPED="$(grep -E "$SKIP_RE" "$WORK_TMP/full.list" || true)"
ITEMS="$(grep -cE '^[0-9]+;' "$WORK_TMP/restore.list" || true)"
TABLE_DATA="$(grep -cE '^[0-9]+; [0-9]+ [0-9]+ TABLE DATA ' "$WORK_TMP/restore.list" || true)"
log "Would restore $ITEMS items, including data for $TABLE_DATA tables."
if [[ -n "$SKIPPED" ]]; then
  log "Left out:"
  sed -E 's/^[0-9]+; [0-9]+ [0-9]+ /  /' <<<"$SKIPPED" >&2
fi
log "Export snapshot: $(manifest tables) tables, $(manifest rows) rows, exported $(manifest exported_at_utc)."

if ((EXECUTE == 0)); then
  log ""
  log "DRY RUN: nothing was written. Re-run with --execute and CONFIRM_TARGET_HOST=$TGT_HOST to restore."
  exit 0
fi

[[ "${CONFIRM_TARGET_HOST:-}" == "$TGT_HOST" ]] || die "set CONFIRM_TARGET_HOST=$TGT_HOST to confirm the restore target"

log ""
log "Restoring (one transaction, stops at the first error)..."
pg_as TGT pg_restore --single-transaction --exit-on-error --no-owner --no-privileges \
  --use-list="$WORK_TMP/restore.list" --dbname="$(db_of TGT)" "$DUMP_DIR/public.dump"

log "Updating planner statistics..."
psql_q TGT "ANALYZE" >/dev/null

log "Verifying against the export snapshot..."
snapshot TGT "$WORK_TMP/target.tsv"
if compare_snapshots "$DUMP_DIR/source-snapshot.tsv" "$WORK_TMP/target.tsv"; then
  log "IMPORT VERIFIED: every table's row count and checksum match the export."
else
  die "the restored data does not match the export; do not switch traffic. See docs/migration/DATABASE_COPY.md, 'If verification fails'"
fi
