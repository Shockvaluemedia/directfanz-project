#!/usr/bin/env bash
# Fresh-start export: copy out only the sign-in accounts on one email domain
# (the owner's own accounts), and nothing else from the old database.
#
# Read-only on the source. Dry run by default: it lists the email domains in
# the users table with counts, then the accounts on --email-domain and what
# would be carried for each. Nothing is written.
#
#   SOURCE_DATABASE_URL=... scripts/migration/export-accounts.sh --email-domain example.com
#   SOURCE_DATABASE_URL=... scripts/migration/export-accounts.sh --email-domain example.com \
#     --execute [--out DIR]
#
# What is carried, per matching user (exact domain match, case-insensitive):
#   users     the whole row, including the password hash, so the same password
#             still signs in (hashes don't depend on the rotated app secrets)
#   artists   the artist profile, if any, with Stripe reset: stripeAccountId
#             empty, isStripeOnboarded false, totalEarnings and
#             totalSubscribers 0 (the artist reconnects Stripe on AWS)
#   accounts  OAuth links (e.g. Google sign-in), with every stored token
#             emptied; only provider and providerAccountId are kept
# Everything else (content, purchases, sessions, refresh tokens, follows,
# messages, consent and age records...) is left behind.
#
# --execute writes, into DIR (default: a new folder under ${TMPDIR:-/tmp},
# never inside the repo, mode 0700):
#   users.csv, artists.csv, accounts.csv   the rows (contain personal data)
#   SHA256SUMS                             checksums of the three files
#   manifest.txt                           domain, counts, source, versions

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

EXECUTE=0
OUT=""
DOMAIN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=1 ;;
    --out)
      OUT="${2:-}"
      shift
      ;;
    --email-domain)
      DOMAIN="${2:-}"
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

require_tool psql
load_conn SRC SOURCE_DATABASE_URL
log "Source: $(describe SRC) (read-only session)"
server_major SRC >/dev/null || die "could not connect to the source"

log ""
log "Email domains in users (top 25, with counts):"
psql_q SRC "
  SELECT lower(substring(email from '@([^@]*)\$')) AS domain, count(*)
  FROM public.users GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 25" | sed 's/^/  /' >&2
log "  total users: $(psql_q SRC "SELECT count(*) FROM public.users")"

if [[ -z "$DOMAIN" ]]; then
  log ""
  log "DRY RUN: pick the domain from the list and run again with --email-domain DOMAIN."
  exit 0
fi
[[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die "--email-domain must be a plain domain like example.com"
DOMAIN="${DOMAIN,,}"

# Only these three queries ever leave the source. The domain is checked above,
# so it is safe inside a quoted literal.
MATCH="lower(substring(u.email from '@([^@]*)\$')) = '$DOMAIN'"
Q_USERS="SELECT u.* FROM public.users u WHERE $MATCH ORDER BY u.id"
Q_ARTISTS="SELECT (jsonb_populate_record(a, '{\"stripeAccountId\": null, \"isStripeOnboarded\": false, \"totalEarnings\": 0, \"totalSubscribers\": 0}'::jsonb)).*
  FROM public.artists a JOIN public.users u ON u.id = a.\"userId\" WHERE $MATCH ORDER BY a.id"
Q_ACCOUNTS="SELECT (jsonb_populate_record(x, '{\"refresh_token\": null, \"access_token\": null, \"expires_at\": null, \"token_type\": null, \"scope\": null, \"id_token\": null, \"session_state\": null}'::jsonb)).*
  FROM public.accounts x JOIN public.users u ON u.id = x.\"userId\" WHERE $MATCH ORDER BY x.id"

N_USERS="$(psql_q SRC "SELECT count(*) FROM ($Q_USERS) s")"
N_ARTISTS="$(psql_q SRC "SELECT count(*) FROM ($Q_ARTISTS) s")"
N_ACCOUNTS="$(psql_q SRC "SELECT count(*) FROM ($Q_ACCOUNTS) s")"

log ""
log "Accounts on @$DOMAIN that would be carried: $N_USERS"
psql_q SRC "
  SELECT u.email, u.role, u.status, to_char(u.\"createdAt\", 'YYYY-MM-DD'),
         CASE WHEN u.password IS NULL THEN 'no password' ELSE 'password' END,
         CASE WHEN a.id IS NULL THEN '' ELSE 'artist profile' END,
         coalesce((SELECT string_agg(x.provider, ',') FROM public.accounts x WHERE x.\"userId\" = u.id), '')
  FROM public.users u LEFT JOIN public.artists a ON a.\"userId\" = u.id
  WHERE $MATCH ORDER BY u.email" | sed 's/^/  /' >&2
log "Rows: users $N_USERS, artists $N_ARTISTS, accounts $N_ACCOUNTS (sign-in links, tokens emptied)."
log "Left behind: $(psql_q SRC "SELECT count(*) FROM public.users u WHERE NOT ($MATCH)") other users and every other table."

((N_USERS > 0)) || die "no users on @$DOMAIN; check the domain against the list above"

if ((EXECUTE == 0)); then
  log ""
  log "DRY RUN: nothing was written. Re-run with --execute to save these rows."
  exit 0
fi

if [[ -z "$OUT" ]]; then
  OUT="${TMPDIR:-/tmp}/directfanz-accounts-$(date -u +%Y%m%dT%H%M%SZ)"
fi
[[ "$OUT" != *"'"* ]] || die "--out must not contain a single quote"
[[ ! -e "$OUT" ]] || die "$OUT already exists; choose a new folder"
umask 077
mkdir -p "$OUT"
refuse_inside_repo "$OUT"
OUT="$(cd "$OUT" && pwd)"

# One read-only, repeatable-read transaction, so the three files agree.
# (\copy takes its query on one line.)
Q_USERS="${Q_USERS//$'\n'/ }" Q_ARTISTS="${Q_ARTISTS//$'\n'/ }" Q_ACCOUNTS="${Q_ACCOUNTS//$'\n'/ }"
pg_as SRC psql -X -q -v ON_ERROR_STOP=1 <<SQL
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
\copy ($Q_USERS) TO '$OUT/users.csv' WITH (FORMAT csv, HEADER true)
\copy ($Q_ARTISTS) TO '$OUT/artists.csv' WITH (FORMAT csv, HEADER true)
\copy ($Q_ACCOUNTS) TO '$OUT/accounts.csv' WITH (FORMAT csv, HEADER true)
COMMIT;
SQL

(cd "$OUT" && sha256sum users.csv artists.csv accounts.csv >SHA256SUMS)
{
  echo "exported_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "kind=accounts-only"
  echo "email_domain=$DOMAIN"
  echo "source_host=$(host_of SRC)"
  echo "source_database=$(db_of SRC)"
  echo "source_server=$(server_version SRC)"
  echo "git_commit=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "users=$N_USERS"
  echo "artists=$N_ARTISTS"
  echo "accounts=$N_ACCOUNTS"
} >"$OUT/manifest.txt"

log ""
log "Saved $N_USERS accounts to $OUT (mode 0700). It holds personal data and password hashes:"
log "keep it on this machine and delete it once the import is verified."
