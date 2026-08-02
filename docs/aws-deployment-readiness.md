# DirectFanz AWS Deployment Readiness

Date: June 14, 2026
Status: Partially aligned; validation still required before first AWS production deploy

This audit checks whether the consolidated AWS path can be run safely. It does not validate product quality, UI readiness, or non-deployment feature completeness.

## Summary

DirectFanz now has the right target architecture direction: AWS ECS/Fargate, ECR, Terraform-managed infrastructure, RDS PostgreSQL, ElastiCache Redis, S3, ALB, Route 53, ACM, and AWS-native rollback.

The highest-risk drift has been reduced: Terraform now owns the ECS cluster, ECR repositories, web task/service, websocket task/service, and ALB routing. The deploy script builds and pushes images, then forces Terraform-managed ECS services to roll.

## Readiness Scorecard

| Area | Status | Notes |
| --- | --- | --- |
| Canonical deployment target | Pass | `docs/deployment.md` now defines AWS ECS/Fargate as the only active production path. |
| Active workflows | Pass | Active workflows are AWS deploy, AWS rollback, CI, and security only. |
| Docker build targets | Partial | Web build uses `Dockerfile.production`; websocket uses `Dockerfile`. Both exist now, but runtime commands need validation. |
| Terraform core infrastructure | Pass | VPC, ALB, RDS, Redis, S3, ECS web/websocket services, Route 53, and ACM validate successfully. CloudFront remains commented out. |
| ECR alignment | Pass | Terraform and deploy script use `directfanz-web` and `directfanz-websocket`. |
| ECS cluster alignment | Pass | Terraform and deploy script use `directfanz-cluster`. |
| ECS service alignment | Pass | Terraform and deploy script use `directfanz-web` and `directfanz-websocket`. |
| Websocket infrastructure | Pass | Terraform now defines websocket ECR, task definition, target group, listener rule, and ECS service. |
| Secrets model | Partial | ECS now uses one `/directfanz/...` SSM namespace, but parameter values still need to be created before deploy. |
| CDN | Partial | CloudFront config exists but is commented out. Route 53 currently points domains at ALB. |
| Health checks | Partial | Web `/api/health` exists. Websocket `/health` exists in `websocket-server.js`. Need container runtime verification. |
| Rollback | Partial | AWS rollback workflow exists, but service names must match Terraform before it can work. |
| Cost controls | Pass | Minimal staging defaults disable NAT Gateways, use micro RDS/Redis, keep ECS desired counts low, and keep logs to 7 days. |

## Blockers Before First AWS Deploy

1. Create required SSM parameters.

Current contract:
- ECS task definitions now reference SSM parameter ARNs under `/directfanz/...`.
- The actual parameter values must exist before ECS tasks can start.

Recommendation:
- Create secure SSM parameters for every secret in `local.app_secret_parameter_names` in `infrastructure/terraform/ecs.tf`.
- Store generated RDS/Redis connection strings in `/directfanz/database/url` and `/directfanz/redis/url`.
- Use `npm run aws:ssm:check` to verify required parameters exist before deploy.

2. Run Terraform plan.

Completed validation:
- `terraform fmt`
- `terraform validate`

Remaining validation:
- `terraform plan`

3. Confirm build/runtime command compatibility.

Current state:
- `Dockerfile.production` builds Next.js standalone output and runs `node server.js`.
- `Dockerfile` runs `node websocket-server.js`.
- `Dockerfile.production` now installs `curl` for ECS health checks.

Required validation:
- Build `Dockerfile.production`.
- Run it locally with minimum env vars and hit `/api/health`.
- Build `Dockerfile`.
- Run it locally and hit `/health`.

## Recommended Fix Order

1. Create/populate required SSM parameters.
2. Run local Docker image validation.
3. Run `terraform plan` and review output.
4. Deploy to staging AWS environment.
5. Run smoke checks.
6. Promote production only after rollback is rehearsed.

## Minimum First-Deploy Checklist

- [x] `terraform validate` passes.
- [ ] `terraform plan` shows expected ECS/ECR/RDS/Redis/S3/ALB/Route 53 resources.
- [x] ECR repo names match deploy script.
- [x] ECS cluster and service names match deploy script and rollback workflow.
- [x] Web task definition has every required app secret reference.
- [x] Websocket is fully provisioned in Terraform.
- [ ] Required SSM parameter values exist.
- [x] SSM parameter preflight script exists.
- [ ] Web Docker image builds and `/api/health` returns 200 locally.
- [ ] Websocket Docker image builds and `/health` returns 200 locally.
- [x] Minimal-cost staging defaults are configured.
- [ ] Staging deploy completes.
- [ ] Rollback workflow works against a previous task definition.

## Non-blocking Follow-ups

- Re-enable CloudFront after ACM and ALB path are validated.
- Restore or rewrite archived IVS streaming Terraform after the core ECS stack is stable.
- Remove or rewrite Vercel/Railway/Render comments in source files after AWS staging deploy passes.
- Replace placeholder domains in old websocket client defaults.
- Add AWS architecture diagram after first successful staging deployment.
- Add AWS cost guardrails before production traffic.
