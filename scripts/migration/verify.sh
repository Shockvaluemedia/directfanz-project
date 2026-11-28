#!/usr/bin/env bash
# Compare the new database with the old one: row count and an
# order-independent checksum for every table in public, plus sequence values.
# Read-only on both sides.
#
#   Target against the export's snapshot:
#     TARGET_DATABASE_URL=... scripts/migration/verify.sh --dump-dir DIR
#
#   Both databases live (only meaningful while the app is in maintenance mode):
#     SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... scripts/migration/verify.sh --live
#
# Exits 0 when everything matches, 1 when anything differs.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MODE=""
DUMP_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump-dir)
      MODE=dump
      DUMP_DIR="${2:-}"
      shift
      ;;
    --live) MODE=live ;;
    -h | --help)
      sed -n '2,13p' "$0"
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done
[[ -n "$MODE" ]] || die "choose --dump-dir DIR or --live"
require_tool psql

load_conn TGT TARGET_DATABASE_URL
log "Target: $(describe TGT)"
# Reads only; never writes to the target either.
psql_q TGT "SELECT 1" >/dev/null || die "could not connect to the target"

if [[ "$MODE" == "dump" ]]; then
  [[ -f "$DUMP_DIR/source-snapshot.tsv" ]] || die "$DUMP_DIR/source-snapshot.tsv is missing"
  cp "$DUMP_DIR/source-snapshot.tsv" "$WORK_TMP/expected.tsv"
  log "Expected: export snapshot in $DUMP_DIR"
else
  load_conn SRC SOURCE_DATABASE_URL
  log "Source: $(describe SRC) (read-only session)"
  snapshot SRC "$WORK_TMP/expected.tsv"
fi

snapshot TGT "$WORK_TMP/actual.tsv"
if compare_snapshots "$WORK_TMP/expected.tsv" "$WORK_TMP/actual.tsv"; then
  log "VERIFIED: row counts and checksums match for every table and sequence."
else
  log "MISMATCH: do not switch traffic to the new database."
  exit 1
fi
