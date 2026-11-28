# shellcheck shell=bash
# Shared helpers for the DirectFanz database copy scripts.
#
# Rules these helpers enforce:
# - Connection URLs are read only from environment variables
#   (SOURCE_DATABASE_URL, TARGET_DATABASE_URL). Passwords go into a
#   temporary pgpass file (mode 0600) and never appear in argv, logs or output.
# - Every session on the source is read-only.
# - Nothing here creates, changes or deletes anything on its own; each script
#   is a dry run unless called with --execute.

set -euo pipefail

MIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$MIG_DIR/../.." && pwd)"

# Optional: point at a specific Postgres client version, e.g.
#   PG_BIN=/usr/lib/postgresql/17/bin
if [[ -n "${PG_BIN:-}" ]]; then
  export PATH="$PG_BIN:$PATH"
fi

log() { printf '%s\n' "$*" >&2; }
die() {
  log "ERROR: $*"
  exit 1
}

WORK_TMP="$(mktemp -d)"
chmod 700 "$WORK_TMP"
trap 'rm -rf "$WORK_TMP"' EXIT

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is not installed (set PG_BIN to a Postgres client bin directory)"
}

# load_conn SIDE ENV_VAR   (SIDE is SRC or TGT)
load_conn() {
  local side="$1" var="$2" out k v
  require_tool node
  out="$(node "$MIG_DIR/conn.mjs" "$var" "$WORK_TMP/$side.pgpass")" || die "could not read $var"
  while IFS='=' read -r k v; do
    [[ -n "$k" ]] && printf -v "${side}_${k}" '%s' "$v"
  done <<<"$out"
  printf -v "${side}_PASSFILE" '%s' "$WORK_TMP/$side.pgpass"
}

# describe SIDE -> user@host:port/db (no password)
describe() {
  local side="$1" u h p d
  u="${side}_USER" h="${side}_HOST" p="${side}_PORT" d="${side}_DATABASE"
  printf '%s@%s:%s/%s' "${!u}" "${!h}" "${!p}" "${!d}"
}

host_of() { local v="${1}_HOST"; printf '%s' "${!v}"; }
db_of() { local v="${1}_DATABASE"; printf '%s' "${!v}"; }

# Settings that make row text identical on both sides for checksums.
STABLE_OPTS='-c TimeZone=UTC -c DateStyle=ISO,YMD -c IntervalStyle=postgres -c extra_float_digits=3 -c bytea_output=hex'

# pg_as SIDE command [args...] -> runs a Postgres client with that side's settings
pg_as() {
  local side="$1"
  shift
  local h="${side}_HOST" p="${side}_PORT" d="${side}_DATABASE" u="${side}_USER" s="${side}_SSLMODE" f="${side}_PASSFILE"
  local opts="$STABLE_OPTS"
  if [[ "$side" == "SRC" ]]; then
    opts="$opts -c default_transaction_read_only=on"
  fi
  env -u PGPASSWORD -u PGSERVICE -u DATABASE_URL \
    PGHOST="${!h}" PGPORT="${!p}" PGDATABASE="${!d}" PGUSER="${!u}" \
    PGSSLMODE="${!s}" PGPASSFILE="${!f}" PGAPPNAME=directfanz-migration \
    PGCONNECT_TIMEOUT=15 PGOPTIONS="$opts" "$@"
}

# psql_q SIDE "sql" -> unaligned, tuples-only output; stops on the first error
psql_q() {
  local side="$1" sql="$2"
  pg_as "$side" psql -X -q -A -t -v ON_ERROR_STOP=1 -F $'\t' -c "$sql"
}

server_major() { psql_q "$1" "SELECT current_setting('server_version_num')::int / 10000"; }
server_version() { psql_q "$1" "SELECT current_setting('server_version')"; }

# client_major pg_dump -> 16
client_major() { "$1" --version | sed -E 's/.* ([0-9]+)(\.[0-9]+)?.*/\1/'; }

public_table_count() {
  psql_q "$1" "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"
}

# snapshot SIDE OUTFILE
# One line per public table: name, exact row count, order-independent md5 of
# every row's text. Sequences are listed with their last value. Sorted, so two
# snapshots can be compared with diff.
snapshot() {
  local side="$1" outfile="$2" t line
  : >"$outfile"
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    line="$(psql_q "$side" "SELECT count(*) || E'\t' || coalesce(md5(string_agg(h, '' ORDER BY h)), '-') FROM (SELECT md5(x::text) AS h FROM public.$t AS x) s")"
    printf 'table\t%s\t%s\n' "$t" "$line" >>"$outfile"
  done < <(psql_q "$side" "SELECT quote_ident(tablename) FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")
  psql_q "$side" "SELECT 'sequence', quote_ident(sequencename), coalesce(last_value::text, '-'), '-' FROM pg_sequences WHERE schemaname = 'public' ORDER BY 2" >>"$outfile"
  LC_ALL=C sort -o "$outfile" "$outfile"
}

# compare_snapshots EXPECTED ACTUAL -> prints a report, returns 1 on any difference
compare_snapshots() {
  local expected="$1" actual="$2" rc=0
  local tables_ok
  tables_ok="$(LC_ALL=C comm -12 "$expected" "$actual" | grep -c . || true)"
  if ! diff -q "$expected" "$actual" >/dev/null; then
    rc=1
    log "Differences (- expected from source, + found on target):"
    diff -u "$expected" "$actual" | grep -E '^[-+][a-z]' | grep -vE '^(---|\+\+\+)' >&2 || true
  fi
  log "Matching lines: $tables_ok of $(grep -c . "$expected" || true) expected."
  return "$rc"
}

# refuse_inside_repo DIR -> exported data must never land where git can pick it up
refuse_inside_repo() {
  local dir
  dir="$(cd "$1" && pwd)"
  case "$dir/" in
    "$REPO_ROOT/"*) die "output directory $dir is inside the repository; choose a folder outside it" ;;
  esac
}

looks_like_supabase() {
  [[ "$1" =~ (^|\.)supabase\.(co|com|net)$ ]]
}
