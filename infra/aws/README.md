# DirectFanz on AWS (Terraform)

Infrastructure as code for running DirectFanz in the Shock Value AWS account
(958972795537, us-east-1), built the way BridgePoint runs. Nothing in this
folder has been applied. Every step below that creates, changes or pays for
something in AWS, DNS or GitHub needs the owner's yes first.

Plan and costs: the "DirectFanz on AWS: setup plan and monthly cost" doc
(about $73 a month at launch, plus $16 to $33 per 90-minute listening party
on IVS).

## What it builds

| Piece | File | Setting |
| --- | --- | --- |
| Network | `network.tf` | Own VPC, 2 zones. Public subnets for the load balancer and the task (public IP, no NAT gateway). Private subnets for Postgres and Valkey. Free S3 gateway endpoint. |
| App | `app.tf` | ECR image, ECS Fargate ARM64, 0.5 vCPU / 1 GB, 1 task, rolling deploys with automatic rollback. Logs 30 days. |
| Load balancer | `app.tf` | Idle timeout 300 s for chat, health check `/api/health`, sticky sessions. HTTP only in phase 1; HTTPS (TLS 1.3 policy) and redirects in phase 2. |
| Secrets | `app.tf` | Secrets Manager `directfanz-prod/app` (JSON, values set by hand) plus the RDS-managed database login. Injected when the task starts. |
| Database | `data.tf` | RDS Postgres 16, db.t4g.micro, 20 GB gp3 growing to 100 GB, encrypted, TLS forced, private, 7-day backups, deletion protection, final snapshot. |
| Cache | `data.tf` | ElastiCache Valkey 8, cache.t4g.micro, encrypted at rest and in transit (`rediss://`). |
| Files | `storage.tf` | Private S3 bucket, all public access blocked, TLS only, encrypted, versioned (old versions gone after 30 days), CORS for signed browser uploads. |
| Listening parties | `app.tf` | Task role may create and manage only IVS channels tagged `Project=directfanz`. Playback key pair is made by hand (below). |
| Domain | `dns.tf` | Route 53 zone for directfanz.io, copied records, ACM certificate for apex and www, CAA, and (at cutover) apex/www aliases to the load balancer. www redirects to the apex. |
| Scheduled calls and IVS events | `schedules.tf` | EventBridge POSTs `/api/cron/marketing-events` every 5 min and `/api/cron/party-reminders` every 10 min, and forwards IVS "Stream Start"/"Stream End" events to `/api/webhooks/ivs` (so OBS-only parties go live and end by themselves), all with `Authorization: Bearer <CRON_SECRET>`. Off until switched on. |
| Alerts | `monitoring.tf` | $100 monthly budget (80% actual, 100% forecast) and alarms for no healthy task, memory over 85%, 5xx bursts and low database storage, by email. |
| Deploys | `deploy-role.tf` + `.github/workflows/deploy-aws.yml` | GitHub OIDC role usable only from this repo's `production` environment. Manual workflow from `main` only. |

## Environment variables the app receives

Plain settings (set by Terraform): `NODE_ENV`, `PORT`, `HOSTNAME`,
`NEXTAUTH_URL`, `AWS_REGION`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `REDIS_URL`,
`AWS_S3_BUCKET_NAME` (and the same value as `S3_BUCKET_NAME`),
`USE_LOCAL_STORAGE=false`, `IVS_PLAYBACK_KEY_PAIR_ARN` (once set), plus
anything in `app_environment` (for example `FROM_EMAIL`).

From the app secret (JSON keys, `app_secret_keys`): `NEXTAUTH_SECRET`,
`JWT_SECRET`, `ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `SENDGRID_API_KEY`,
`CRON_SECRET`, `MARKETING_WEBHOOK_SECRET`, `SMS_INBOUND_TOKEN`,
`IVS_PLAYBACK_PRIVATE_KEY`. Every key listed must exist in the secret (an
empty string is fine for features that are off) or ECS won't start the task.

From the RDS-managed secret: `DB_USERNAME`, `DB_PASSWORD`. The container's
entrypoint (`docker/entrypoint.sh`) turns these into `DATABASE_URL` with
`sslmode=require`.

Browser-visible values (`NEXT_PUBLIC_*`) are baked in at image build time and
come from GitHub environment variables in the deploy workflow. The browser
finds the chat server through `NEXT_PUBLIC_WEBSOCKET_URL`; left unset it uses
the site's own address, which is right here because one task serves both.

## Order of steps (each needs a yes)

1. **State bucket.** Create the S3 bucket named in `backend.hcl.example` with
   versioning and encryption on, then `cp backend.hcl.example backend.hcl` and
   `terraform init -backend-config=backend.hcl`. Commit the generated
   `.terraform.lock.hcl`.
2. **Variables.** `cp terraform.tfvars.example terraform.tfvars`, set
   `alert_email`, and copy every current directfanz.io DNS record (site, mail,
   verification TXT) into `existing_dns_records`.
3. **Phase 1 apply.** `terraform plan`, review, then `terraform apply`. This
   creates everything (the bill starts here) with the site on the load
   balancer's own HTTP address. It changes nothing at the registrar.
4. **Secrets.** Generate fresh values on your own computer (per the key
   rotation plan) and save the whole JSON straight into the
   `directfanz-prod/app` secret, for example with
   `aws secretsmanager put-secret-value --secret-id directfanz-prod/app --secret-string file://app-secret.json`,
   then delete the local file. Never reuse the leaked values.
5. **IVS playback key.** Make a P-384 key pair locally, import the public
   half with `aws ivs import-playback-key-pair`, put the private half in the
   app secret as `IVS_PLAYBACK_PRIVATE_KEY`, and set
   `ivs_playback_key_pair_arn`.
6. **GitHub.** Create the `production` environment with required reviewers,
   and set its variable `AWS_DEPLOY_ROLE_ARN` to the `github_deploy_role_arn`
   output. Optional variables: `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_SENTRY_DSN`.
7. **First deploy.** Run "Deploy to AWS (manual)" from `main`. It builds the
   image, runs `prisma migrate deploy`, and rolls the service. Test on the
   `load_balancer_url` output.
8. **Name servers.** At the registrar, replace directfanz.io's name servers
   with the four in the `route53_name_servers` output. The site keeps working
   from the copied records.
9. **Phase 2 apply.** Set `enable_https = true` and apply. Terraform waits for
   the certificate, then serves HTTPS.
10. **Cutover.** Remove the old apex/www site records from
    `existing_dns_records`, set `site_on_aws = true`, and apply.
11. **Scheduled calls and IVS events.** Set `enable_schedules = true` and apply, then copy the
    cron secret into the EventBridge connection once (the value never enters
    Terraform):
    ```bash
    aws events update-connection --name directfanz-prod-cron \
      --authorization-type API_KEY \
      --auth-parameters "{\"ApiKeyAuthParameters\":{\"ApiKeyName\":\"Authorization\",\"ApiKeyValue\":\"Bearer $(aws secretsmanager get-secret-value --secret-id directfanz-prod/app --query SecretString --output text | jq -r .CRON_SECRET)\"}}"
    ```
12. **Budget tag.** In Billing, activate the `Project` cost allocation tag so
    the budget counts DirectFanz resources.

## Checks you can run without AWS access

```bash
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
terraform test   # mocked AWS provider; plans phase 1 and phase 2 offline
```

## Known limits

- The image starts plain `next start`. `server.ts` (Next.js plus socket.io on
  one port) can't start yet: it imports a missing `src/lib/aws-config` and
  `socket.io` isn't a dependency, and the chat sign-in is a stub. Change the
  Dockerfile `CMD` once an app PR fixes those.
- One task only. A second copy needs a socket.io Redis adapter first.
- `REDIS_URL` uses TLS (`rediss://`); the app's Redis client must accept it.
