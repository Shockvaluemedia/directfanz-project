#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"

REQUIRED_PARAMETERS=(
  "/directfanz/database/url"
  "/directfanz/redis/url"
  "/directfanz/auth/nextauth-secret"
  "/directfanz/stripe/secret-key"
  "/directfanz/stripe/webhook-secret"
  "/directfanz/openai/api-key"
  "/directfanz/sendgrid/api-key"
  "/directfanz/sentry/dsn"
  "/directfanz/security/encryption-key"
  "/directfanz/security/jwt-secret"
  "/directfanz/aws/access-key-id"
  "/directfanz/aws/secret-access-key"
)

missing=()

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is required to check SSM parameters." >&2
  exit 1
fi

for name in "${REQUIRED_PARAMETERS[@]}"; do
  if aws ssm get-parameter \
    --name "$name" \
    --with-decryption \
    --region "$AWS_REGION" \
    >/dev/null 2>&1; then
    echo "OK $name"
  else
    echo "MISSING $name"
    missing+=("$name")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo
  echo "Missing ${#missing[@]} required SSM parameter(s). Create them before deploying:"
  printf '  %s\n' "${missing[@]}"
  exit 1
fi

echo
echo "All required DirectFanz SSM parameters exist in $AWS_REGION."
