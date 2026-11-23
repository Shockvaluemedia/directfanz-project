#!/usr/bin/env bash
# Export DirectFanz's current Postgres (the app's `public` schema) to a
# pg_dump archive plus a row-count and checksum snapshot.
#
# Dry run by default: connects read-only and reports what it would copy.
#
#   SOURCE_DATABASE_URL=... scripts/migration/export.sh
#   SOURCE_DATABASE_URL=... scripts/migration/export.sh --execute [--out DIR]
#
# Use a direct or session connection to the source (port 5432), not a
# transaction pooler (port 6543). Put the app in maintenance mode first, so
# nothing writes while the copy is taken; the script compares a snapshot taken
# before the dump with one taken after and fails if they differ.
#
# --execute writes, into DIR (default: a new folder under ${TMPDIR:-/tmp},
# never inside the repo, mode 0700):
#   public.dump           pg_dump custom-format archive (contains user data)
#   public.dump.sha256    checksum of the archive
#   toc.txt               the archive's table of contents
#   source-snapshot.tsv   per-table row counts and checksums
#   manifest.txt          where it came from and with which versions (no secrets)

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

EXECUTE=0
OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=1 ;;
    --out)
      OUT="${2:-}"
      shift
      ;;
    -h | --help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

require_tool psql
require_tool pg_dump
require_tool pg_restore
load_conn SRC SOURCE_DATABASE_URL

log "Source: $(describe SRC) (read-only session)"
SRC_MAJOR="$(server_major SRC)" || die "could not connect to the source"
DUMP_MAJOR="$(client_major pg_dump)"
log "Source server: Postgres $(server_version SRC); pg_dump client: $DUMP_MAJOR"
if ((DUMP_MAJOR < SRC_MAJOR)); then
  die "pg_dump $DUMP_MAJOR cannot dump a Postgres $SRC_MAJOR server; install client $SRC_MAJOR and set PG_BIN"
fi

log ""
log "Tables in public, with exact row counts:"
psql_q SRC "
  SELECT c.relname, (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname), false, true, '')))[1]::text::bigint
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  ORDER BY 1" | awk -F'\t' '{ printf "  %-40s %12s\n", $1, $2; total += $2 } END { printf "  %-40s %12s\n", "TOTAL ROWS", total }' >&2

log ""
log "Size of the database: $(psql_q SRC "SELECT pg_size_pretty(pg_database_size(current_database()))")"

if [[ "$(psql_q SRC "SELECT to_regclass('public._prisma_migrations') IS NOT NULL")" == "t" ]]; then
  log "Prisma migration history: present. Applied migrations:"
  psql_q SRC "SELECT '  ' || migration_name || CASE WHEN finished_at IS NULL THEN '  (NOT FINISHED)' ELSE '' END FROM public._prisma_migrations ORDER BY started_at" >&2
else
  log "Prisma migration history: MISSING. The schema was probably built with 'prisma db push'."
  log "  After the import, follow 'Baseline the migration history' in docs/migration/DATABASE_COPY.md."
fi

POLICIES="$(psql_q SRC "SELECT count(*) FROM pg_policies WHERE schemaname = 'public'")"
RLS="$(psql_q SRC "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relrowsecurity")"
EXTS="$(psql_q SRC "SELECT coalesce(string_agg(e.extname, ', '), 'none') FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE n.nspname = 'public'")"
FUNCS="$(psql_q SRC "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'")"
TRIGS="$(psql_q SRC "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal")"
log "Row-level security: $RLS tables, $POLICIES policies (the import leaves these out; Prisma does not use them)"
log "Extensions in public: $EXTS; functions in public: $FUNCS; triggers: $TRIGS"
if [[ "$EXTS" != "none" || "$FUNCS" != "0" || "$TRIGS" != "0" ]]; then
  log "  Prisma creates none of these. Check what they are before importing."
fi

if ((EXECUTE == 0)); then
  log ""
  log "DRY RUN: nothing was written. Re-run with --execute to write the archive."
  exit 0
fi

if [[ -z "$OUT" ]]; then
  OUT="${TMPDIR:-/tmp}/directfanz-db-export-$(date -u +%Y%m%dT%H%M%SZ)"
fi
umask 077
mkdir -p "$OUT"
chmod 700 "$OUT"
refuse_inside_repo "$OUT"
[[ -e "$OUT/public.dump" ]] && die "$OUT already holds an export; choose a new folder"

log ""
log "Snapshot before the dump..."
snapshot SRC "$WORK_TMP/before.tsv"

log "Dumping the public schema..."
pg_as SRC pg_dump --format=custom --schema=public --no-owner --no-privileges \
  --file="$OUT/public.dump"

log "Snapshot after the dump..."
snapshot SRC "$OUT/source-snapshot.tsv"
if ! diff -q "$WORK_TMP/before.tsv" "$OUT/source-snapshot.tsv" >/dev/null; then
  log "The source changed while the dump ran:"
  diff "$WORK_TMP/before.tsv" "$OUT/source-snapshot.tsv" >&2 || true
  die "put the app in maintenance mode so nothing writes, then export again into a new folder"
fi

pg_restore --list "$OUT/public.dump" >"$OUT/toc.txt"
(cd "$OUT" && sha256sum public.dump >public.dump.sha256)

{
  echo "exported_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source=$(describe SRC)"
  echo "source_host=$(host_of SRC)"
  echo "source_database=$(db_of SRC)"
  echo "source_port=$SRC_PORT"
  echo "source_server_major=$SRC_MAJOR"
  echo "pg_dump_major=$DUMP_MAJOR"
  echo "git_commit=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "tables=$(grep -c '^table' "$OUT/source-snapshot.tsv" || true)"
  echo "rows=$(awk -F'\t' '$1 == "table" { s += $3 } END { print s + 0 }' "$OUT/source-snapshot.tsv")"
} >"$OUT/manifest.txt"

log ""
log "Export written to $OUT"
log "  $(cat "$OUT/manifest.txt" | grep -E '^(tables|rows)=' | tr '\n' ' ')"
log "This folder holds user data. Keep it off shared drives and out of git; delete it after the move is verified."
printf '%s\n' "$OUT"
