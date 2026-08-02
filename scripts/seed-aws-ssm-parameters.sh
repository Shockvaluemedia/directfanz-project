#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ALLOW_PLACEHOLDER_VALUES="${ALLOW_PLACEHOLDER_VALUES:-false}"
OVERWRITE="${OVERWRITE:-false}"

write_parameter() {
  local env_name="$1"
  local parameter_name="$2"
  local value="${!env_name:-}"

  if [[ -z "$value" ]]; then
    echo "SKIP $parameter_name: missing environment variable $env_name"
    return 0
  fi

  if [[ "$ALLOW_PLACEHOLDER_VALUES" != "true" ]]; then
    case "$value" in
      *placeholder*|*PLACEHOLDER*|*changeme*|*CHANGE_ME*|*replace-me*|*REPLACE_ME*)
        echo "ERROR $parameter_name: $env_name looks like a placeholder."
        echo "Set ALLOW_PLACEHOLDER_VALUES=true only for disposable staging smoke tests."
        return 1
        ;;
    esac
  fi

  local overwrite_flag=()
  if [[ "$OVERWRITE" == "true" ]]; then
    overwrite_flag=(--overwrite)
  fi

  aws ssm put-parameter \
    --region "$AWS_REGION" \
    --name "$parameter_name" \
    --type "SecureString" \
    --value "$value" \
    "${overwrite_flag[@]}" \
    >/dev/null

  echo "OK $parameter_name"
}

echo "Seeding DirectFanz SSM parameters in $AWS_REGION"
echo "OVERWRITE=$OVERWRITE"
echo "ALLOW_PLACEHOLDER_VALUES=$ALLOW_PLACEHOLDER_VALUES"
echo

write_parameter "DIRECTFANZ_DATABASE_URL" "/directfanz/database/url"
write_parameter "DIRECTFANZ_REDIS_URL" "/directfanz/redis/url"
write_parameter "DIRECTFANZ_NEXTAUTH_SECRET" "/directfanz/auth/nextauth-secret"
write_parameter "DIRECTFANZ_STRIPE_SECRET_KEY" "/directfanz/stripe/secret-key"
write_parameter "DIRECTFANZ_STRIPE_WEBHOOK_SECRET" "/directfanz/stripe/webhook-secret"
write_parameter "DIRECTFANZ_OPENAI_API_KEY" "/directfanz/openai/api-key"
write_parameter "DIRECTFANZ_SENDGRID_API_KEY" "/directfanz/sendgrid/api-key"
write_parameter "DIRECTFANZ_SENTRY_DSN" "/directfanz/sentry/dsn"
write_parameter "DIRECTFANZ_ENCRYPTION_KEY" "/directfanz/security/encryption-key"
write_parameter "DIRECTFANZ_JWT_SECRET" "/directfanz/security/jwt-secret"
write_parameter "DIRECTFANZ_AWS_ACCESS_KEY_ID" "/directfanz/aws/access-key-id"
write_parameter "DIRECTFANZ_AWS_SECRET_ACCESS_KEY" "/directfanz/aws/secret-access-key"

echo
echo "Seed complete. Run: AWS_REGION=$AWS_REGION npm run aws:ssm:check"
