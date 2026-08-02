# DirectFanz AWS SSM Parameters

Last updated: June 14, 2026

DirectFanz ECS tasks read runtime secrets from AWS Systems Manager Parameter Store. Values must be created out-of-band and must not be committed to git.

## Required Parameters

| Name | Type | Source | Notes |
| --- | --- | --- | --- |
| `/directfanz/database/url` | SecureString | generated after RDS is provisioned | PostgreSQL connection string used by Prisma. |
| `/directfanz/redis/url` | SecureString | generated after ElastiCache is provisioned | Redis TLS/auth connection string. |
| `/directfanz/auth/nextauth-secret` | SecureString | generated | NextAuth signing secret. |
| `/directfanz/stripe/secret-key` | SecureString | Stripe | Stripe server secret key. |
| `/directfanz/stripe/webhook-secret` | SecureString | Stripe | Stripe webhook signing secret. |
| `/directfanz/openai/api-key` | SecureString | OpenAI | Optional until AI features are enabled, but ECS currently expects the parameter. |
| `/directfanz/sendgrid/api-key` | SecureString | SendGrid or SES migration placeholder | Optional until email is enabled, but ECS currently expects the parameter. |
| `/directfanz/sentry/dsn` | SecureString | Sentry | Optional observability parameter. |
| `/directfanz/security/encryption-key` | SecureString | generated | 32-byte hex encryption key. |
| `/directfanz/security/jwt-secret` | SecureString | generated | JWT signing secret. |
| `/directfanz/aws/access-key-id` | SecureString | AWS IAM | Prefer task role permissions long-term; keep only if the app still requires explicit keys. |
| `/directfanz/aws/secret-access-key` | SecureString | AWS IAM | Prefer task role permissions long-term; keep only if the app still requires explicit keys. |

## Preflight Check

Run before AWS deploy:

```bash
AWS_REGION=us-east-1 npm run aws:ssm:check
```

The script verifies that every required parameter exists. It does not print secret values.

## Create Or Update Parameters

Use placeholders locally, then replace values in your shell. Do not paste real secret values into docs, issues, PR descriptions, or chat.

```bash
aws ssm put-parameter \
  --name "/directfanz/auth/nextauth-secret" \
  --type "SecureString" \
  --value "$NEXTAUTH_SECRET" \
  --overwrite \
  --region us-east-1
```

Repeat for each required parameter.

Generated secret examples:

```bash
export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
export ENCRYPTION_KEY="$(openssl rand -hex 32)"
export JWT_SECRET="$(openssl rand -base64 32)"
```

Database and Redis values should be assembled after Terraform provisions RDS and ElastiCache outputs. Keep the values in Parameter Store, not in `terraform.tfvars`.

## Cost Note

Standard Parameter Store parameters are the low-cost default. Use Secrets Manager only when rotation, auditing, or managed secret workflows justify the added monthly cost.

## Seed parameters from environment variables

Use the seed script when you want to create or update the required Parameter Store entries from local shell environment variables without printing secret values.

```bash
export DIRECTFANZ_DATABASE_URL='postgresql://...'
export DIRECTFANZ_REDIS_URL='redis://...'
export DIRECTFANZ_NEXTAUTH_SECRET='...'
export DIRECTFANZ_STRIPE_SECRET_KEY='...'
export DIRECTFANZ_STRIPE_WEBHOOK_SECRET='...'
export DIRECTFANZ_OPENAI_API_KEY='...'
export DIRECTFANZ_SENDGRID_API_KEY='...'
export DIRECTFANZ_SENTRY_DSN='...'
export DIRECTFANZ_ENCRYPTION_KEY='...'
export DIRECTFANZ_JWT_SECRET='...'
export DIRECTFANZ_AWS_ACCESS_KEY_ID='...'
export DIRECTFANZ_AWS_SECRET_ACCESS_KEY='...'

AWS_REGION=us-east-1 npm run aws:ssm:seed
AWS_REGION=us-east-1 npm run aws:ssm:check
```

By default, the script skips missing environment variables and refuses values that look like placeholders. To intentionally update existing parameters, run with `OVERWRITE=true`. Only use `ALLOW_PLACEHOLDER_VALUES=true` for disposable staging smoke tests.

```bash
AWS_REGION=us-east-1 OVERWRITE=true npm run aws:ssm:seed
```
