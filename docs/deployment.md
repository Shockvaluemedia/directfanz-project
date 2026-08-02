# DirectFanz Deployment

Last updated: June 14, 2026

This is the only active deployment procedure for DirectFanz web.

Before attempting the first AWS deployment, clear the readiness blockers in `docs/aws-deployment-readiness.md`.

## Canonical Target

- Web app: AWS ECS/Fargate behind an Application Load Balancer
- Production domain: `https://www.directfanz.io`
- Container registry: Amazon ECR
- Infrastructure: Terraform under `infrastructure/terraform/`
- Database: Amazon RDS PostgreSQL
- Cache/session layer: Amazon ElastiCache Redis
- Content storage: Amazon S3
- CDN/DNS/TLS: CloudFront, Route 53, ACM
- Runtime secrets: AWS Secrets Manager or SSM Parameter Store
- Active CI workflow: `.github/workflows/ci.yml`
- Active deploy workflow: `.github/workflows/aws-deploy.yml`
- Active rollback workflow: `.github/workflows/aws-rollback.yml`

Vercel, Amplify, Railway, Render, and local Docker Compose docs are historical/reference material unless a new decision record revives them. Docker Compose remains local-only.

## Production Configuration

Set these through AWS Secrets Manager, SSM Parameter Store, ECS task definition secrets, or GitHub Actions environment secrets:

```text
AWS_ACCOUNT_ID
AWS_REGION
DATABASE_URL
REDIS_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
ENCRYPTION_KEY
JWT_SECRET
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_S3_BUCKET_NAME
SENDGRID_API_KEY
FROM_EMAIL
```

Optional secrets may stay unset until the corresponding feature is live, but checkout, auth, upload, email, and cache behavior must be tested before production launch.

See `docs/aws-ssm-parameters.md` for the complete Parameter Store contract.

## Pre-Deploy Checks

Run these before production deploys:

```bash
npm ci
npm run typecheck
npm run lint:check
npm test -- --passWithNoTests
npm run build
AWS_REGION=us-east-1 npm run aws:ssm:check
```

If production database schema changed:

```bash
npm run db:migrate
```

Run migrations only against the intended production database and only after a backup exists.

## Provision or Update Infrastructure

Terraform is the canonical infrastructure path:

```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

Use `terraform plan` output as the deployment review artifact before applying infrastructure changes.

## Cost Controls

The checked-in `terraform.tfvars` is a minimal-cost staging baseline, not a scaled production baseline.

Default cost controls:

- `enable_nat_gateway = false` so ECS tasks run in public subnets with ALB-only inbound access instead of paying for NAT Gateways.
- `db_instance_class = "db.t4g.micro"` with 20 GB initial storage.
- `redis_node_type = "cache.t4g.micro"` with one cache node.
- `web_app_desired_count = 1`.
- `websocket_desired_count = 0` until realtime features are required for staging.
- `log_retention_days = 7`.
- RDS enhanced monitoring and Performance Insights are disabled by default.

Before production traffic, deliberately raise only what the measured load requires:

- turn on NAT or VPC endpoints if private ECS outbound becomes required;
- increase ECS desired count for high availability;
- increase RDS/Redis sizes only after load tests;
- enable CloudFront after ALB/ACM smoke checks pass;
- enable monitoring features that have a clear operating purpose.

## Deploy

Preferred path: AWS ECS/Fargate through ECR image deployment.

```bash
AWS_ACCOUNT_ID=<account-id> AWS_REGION=us-east-1 npm run aws:deploy
```

This runs `scripts/deploy-ecs-containers.sh deploy`, which:

- authenticates to ECR
- builds web and websocket images
- pushes images to ECR
- verifies Terraform-managed ECR repositories exist
- updates ECS services
- waits for ECS service stability

Terraform owns ECS task definitions and services. Do not register task definitions from standalone JSON files.

Partial commands:

```bash
npm run aws:build
npm run aws:push
```

## Smoke Check

After deploy, verify:

- `https://www.directfanz.io` loads through CloudFront/ALB.
- `/api/health` returns healthy status if configured.
- ECS services `directfanz-web` and `directfanz-websocket` are stable.
- RDS connectivity works from the application task.
- Redis connectivity works from the application task.
- Login page renders.
- Artist dashboard route does not hard-fail.
- Fan discovery or public landing flow renders.
- Stripe webhook URL points at the production domain.
- Upload path can reach S3 in the intended bucket.

## Rollback

Use ECS rollback before attempting several hotfix deploys:

```bash
aws ecs list-task-definitions --family-prefix directfanz-web --sort DESC --max-items 5
aws ecs update-service \
  --cluster directfanz-cluster \
  --service directfanz-web \
  --task-definition <previous-task-definition-arn> \
  --region ${AWS_REGION:-us-east-1}
aws ecs wait services-stable \
  --cluster directfanz-cluster \
  --services directfanz-web \
  --region ${AWS_REGION:-us-east-1}
```

Repeat for `directfanz-websocket` if websocket deployment changed.

Database rollback is separate from application rollback. If a migration shipped, restore from the pre-deploy backup or apply a reviewed forward fix; do not assume ECS rollback reverses database state.

## Historical Paths

Archived deployment references live under `docs/archive/deployment/`. They are not active operating instructions.

Retired paths:

- Vercel
- Amplify
- Railway
- Render
- Docker Compose as production hosting
