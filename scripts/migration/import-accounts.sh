#!/usr/bin/env bash
# Fresh-start import: load the accounts saved by export-accounts.sh into the
# new database, which already has the current schema (prisma db push plus
# baseline.sh, RUNBOOK step 7).
#
#   TARGET_DATABASE_URL=... scripts/migration/import-accounts.sh --dump-dir DIR
#   TARGET_DATABASE_URL=... CONFIRM_TARGET_HOST=<host> \
#     scripts/migration/import-accounts.sh --dump-dir DIR --execute
#
# Without --execute it is a check: the whole load runs inside one transaction
# that is rolled back at the end, so every type, constraint and count is tested
# and nothing is kept. With --execute the same transaction is committed.
#
# It refuses a Supabase target, an archive whose checksums don't match, and a
# target that already has any of these users (by id or email). Columns that
# exist on both sides are copied; a column only the new schema has gets its
# default or stays empty; a required new column with no default stops it.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DIR=""
EXECUTE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump-dir)
      DIR="${2:-}"
      shift
      ;;
    --execute) EXECUTE=1 ;;
    -h | --help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done
[[ -d "$DIR" ]] || die "--dump-dir is required and must be a folder"
DIR="$(cd "$DIR" && pwd)"
[[ "$DIR" != *"'"* ]] || die "the folder path must not contain a single quote"
for f in users.csv artists.csv accounts.csv SHA256SUMS manifest.txt; do
  [[ -f "$DIR/$f" ]] || die "$DIR/$f is missing; is this an export-accounts.sh folder?"
done
grep -qx 'kind=accounts-only' "$DIR/manifest.txt" || die "$DIR is not an export-accounts.sh folder"
(cd "$DIR" && sha256sum --quiet -c SHA256SUMS) || die "checksums don't match: the files changed after export"
log "Files match their checksums."

manifest() { sed -n "s/^$1=//p" "$DIR/manifest.txt"; }

require_tool psql
load_conn TGT TARGET_DATABASE_URL
TGT_HOST="$(host_of TGT)"
log "Target: $(describe TGT)"
looks_like_supabase "$TGT_HOST" && die "the target looks like Supabase; this loads the new AWS database only"
server_major TGT >/dev/null || die "could not connect to the target"
for t in users artists accounts; do
  [[ "$(psql_q TGT "SELECT to_regclass('public.$t') IS NOT NULL")" == "t" ]] ||
    die "the target has no $t table; build the schema first (RUNBOOK step 7)"
done
if ((EXECUTE == 1)); then
  [[ "${CONFIRM_TARGET_HOST:-}" == "$TGT_HOST" ]] || die "set CONFIRM_TARGET_HOST=$TGT_HOST to confirm"
fi

# header_cols FILE -> the CSV's column names, one per line
header_cols() { head -1 "$1" | tr -d '\r' | tr ',' '\n' | sed 's/^"//; s/"$//'; }

SQL="$WORK_TMP/load.sql"
{
  echo '\set ON_ERROR_STOP 1'
  echo 'BEGIN;'
} >"$SQL"

for t in users artists accounts; do
  mapfile -t CSV_COLS < <(header_cols "$DIR/$t.csv")
  for c in "${CSV_COLS[@]}"; do
    [[ "$c" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "$t.csv has an unexpected column name"
  done
  # name, type, required (not null and no default), on the target
  mapfile -t TGT_INFO < <(psql_q TGT "
    SELECT a.attname, format_type(a.atttypid, a.atttypmod), (a.attnotnull AND d.adbin IS NULL)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'public.$t'::regclass AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum")
  declare -A TYPE=() REQUIRED=()
  for line in "${TGT_INFO[@]}"; do
    IFS=$'\t' read -r name typ req <<<"$line"
    TYPE["$name"]="$typ"
    REQUIRED["$name"]="$req"
  done
  declare -A IN_CSV=()
  INS=() SEL=()
  for c in "${CSV_COLS[@]}"; do
    IN_CSV["$c"]=1
    if [[ -n "${TYPE[$c]:-}" ]]; then
      INS+=("\"$c\"")
      SEL+=("s.\"$c\"::${TYPE[$c]}")
    else
      log "  $t.$c: not in the new schema, left out"
    fi
  done
  for name in "${!TYPE[@]}"; do
    if [[ -z "${IN_CSV[$name]:-}" ]]; then
      [[ "${REQUIRED[$name]}" == "t" ]] && die "$t.$name is required in the new schema and the export has no value for it"
      log "  $t.$name: new column, gets its default"
    fi
  done
  STG_COLS="$(printf '"%s" text, ' "${CSV_COLS[@]}")"
  {
    echo "CREATE TEMP TABLE stg_$t (${STG_COLS%, }) ON COMMIT DROP;"
    echo "\\copy stg_$t FROM '$DIR/$t.csv' WITH (FORMAT csv, HEADER true)"
  } >>"$SQL"
  INSERTS+=("INSERT INTO public.$t ($(
    IFS=,
    echo "${INS[*]}"
  )) SELECT $(
    IFS=,
    echo "${SEL[*]}"
  ) FROM stg_$t s;")
  unset TYPE REQUIRED IN_CSV
done

cat >>"$SQL" <<SQL
DO \$\$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM stg_users;
  IF n <> $(manifest users) THEN RAISE EXCEPTION 'users.csv has % rows, the manifest says $(manifest users)', n; END IF;
  SELECT count(*) INTO n FROM stg_artists;
  IF n <> $(manifest artists) THEN RAISE EXCEPTION 'artists.csv has % rows, the manifest says $(manifest artists)', n; END IF;
  SELECT count(*) INTO n FROM stg_accounts;
  IF n <> $(manifest accounts) THEN RAISE EXCEPTION 'accounts.csv has % rows, the manifest says $(manifest accounts)', n; END IF;
  SELECT count(*) INTO n FROM public.users u JOIN stg_users s ON u.id = s.id OR lower(u.email) = lower(s.email);
  IF n > 0 THEN RAISE EXCEPTION '% of these users are already on the target; nothing was loaded', n; END IF;
  IF EXISTS (SELECT 1 FROM stg_users WHERE lower(substring(email from '@([^@]*)\$')) <> '$(manifest email_domain)') THEN
    RAISE EXCEPTION 'users.csv holds an address outside @$(manifest email_domain)';
  END IF;
END
\$\$;
${INSERTS[0]}
${INSERTS[1]}
${INSERTS[2]}
SELECT 'loaded', (SELECT count(*) FROM public.users u JOIN stg_users s USING (id)),
       (SELECT count(*) FROM public.artists a JOIN stg_artists s USING (id)),
       (SELECT count(*) FROM public.accounts x JOIN stg_accounts s USING (id));
SQL
if ((EXECUTE == 1)); then echo 'COMMIT;' >>"$SQL"; else echo 'ROLLBACK;' >>"$SQL"; fi

RESULT="$(pg_as TGT psql -X -q -A -t -F ' ' -f "$SQL")" || die "the load failed and was rolled back; nothing was kept"
read -r _ U A X <<<"$(grep '^loaded ' <<<"$RESULT")"
log ""
log "Accounts on @$(manifest email_domain): users $U, artists $A, sign-in links $X."
if ((EXECUTE == 0)); then
  log "CHECK ONLY: the load worked inside a transaction and was rolled back. Nothing was kept."
  log "Re-run with --execute and CONFIRM_TARGET_HOST=$TGT_HOST to keep it."
  exit 0
fi
log "Committed. These people sign in with the same email and password as before."
log "Delete $DIR once you have signed in with one of them."
