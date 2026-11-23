# DirectFanz key checklist for the move to AWS

Every secret the app needs on AWS: which are replacing leaked values, where
each new one goes, who makes it, and what to revoke once the move has held
for a week. Built from the key rotation plan
(`directfanz/key-rotation-plan.md` in the project files, Nov 21, 2026) and the
env names the code reads (integration-testing plus PR #54).

Nothing here has been created, changed or revoked. No secret values appear in
this file, and none should ever be added to it.

## Ground rules

- **Demetrius makes every key himself**, on his own computer or in the
  provider's dashboard, and pastes it straight into AWS Secrets Manager. Never
  into chat, docs, commits, tickets or shell history.
- **The three leaked app secrets are never reused.** They were in git history
  from September 2025 (`NEXTAUTH_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`).
  New values are made fresh, so nothing leaked ever reaches AWS.
- **The leaked database password is already dead:** the RDS database it
  belonged to no longer exists (checked Nov 21). The new RDS database gets a
  password that AWS generates and keeps.
- **Names follow PR #56** (the Terraform PR, `infra/aws/README.md`, and
  `directfanz/aws-settings.md` in the project files). App secrets are keys in
  **one** JSON secret, `directfanz-prod/app`, in us-east-1. ECS turns each key
  into an env var of the same name when the task starts. Every key Terraform
  lists in `app_secret_keys` must exist in that JSON, or the task won't start;
  an empty string is fine for a feature that's off.
- **Saving them, from PR #56:** write the whole JSON into a file on his own
  computer, save it in one go, then delete the file:
  ```bash
  aws secretsmanager put-secret-value --secret-id directfanz-prod/app \
    --secret-string file://app-secret.json
  rm -P app-secret.json   # macOS; on Linux: shred -u app-secret.json
  ```
  Or paste it in the console (Secrets Manager, `directfanz-prod/app`,
  "Retrieve secret value", "Edit", plaintext).
- **Making a value:** `openssl rand -base64 32` or `openssl rand -hex 32`, as
  the table says, straight into that file. Each key gets its own fresh value.

## Part 1: what goes into AWS

Tick each row at RUNBOOK step 4 (keys), 5 (IVS), 9 (Stripe test webhooks),
12 (scheduled calls) and 13 (Stripe live).

### Keys in the JSON secret `directfanz-prod/app`

| ✓ | Key | What it is | Leaked before? | Who makes it, how | Runbook step |
| --- | --- | --- | --- | --- | --- |
| ☐ | `NEXTAUTH_SECRET` | Signs every login session, stream links, chat auth | **Yes, replace** | He: `openssl rand -base64 32` | 4 |
| ☐ | `JWT_SECRET` | Tokens from `/api/auth/login` | **Yes, replace** | He: `openssl rand -base64 32`, a different value | 4 |
| ☐ | `ENCRYPTION_KEY` | `encryptData` / `decryptData` | **Yes, replace** | He: `openssl rand -hex 32` (64 characters) | 4 |
| ☐ | `CRON_SECRET` | Bearer token for the two scheduled calls | No | He: `openssl rand -hex 32`. Copied once more into the EventBridge connection at step 12 (PR #56 gives the command; the value never enters Terraform) | 4, 12 |
| ☐ | `STRIPE_SECRET_KEY` | Stripe API | No (repo copies were placeholders) | He, Stripe dashboard: **test** key at step 4, **live** key at step 13 | 4, 13 |
| ☐ | `STRIPE_PUBLISHABLE_KEY` | Stripe in the browser (not sensitive, kept here by PR #56) | No | He, Stripe dashboard: test, then live, matching the secret key | 4, 13 |
| ☐ | `STRIPE_WEBHOOK_SECRET` | Platform webhook endpoint's signing secret | No | He, from the platform endpoint he creates. Empty string until then | 9, 13 |
| ☐ | `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect endpoint's signing secret | No | He, from the Connect endpoint he creates. Empty string until then | 9, 13 |
| ☐ | `SENDGRID_API_KEY` | Email, password reset | No (placeholder in repo) | He, SendGrid: a **new** key with Mail Send only | 4 |
| ☐ | `IVS_PLAYBACK_PRIVATE_KEY` | Signs fans' party playback tokens (P-384, ES384) | No | He, on his computer, at step 5 (below). Empty string until then | 5 |
| ☐ | `MARKETING_WEBHOOK_SECRET` | Signed event feed to GoHighLevel | No | Empty string now. He makes it only when the feed is switched on | 4 |
| ☐ | `SMS_INBOUND_TOKEN` | Guards the SMS reply webhook | No | Empty string now. He makes it only when an SMS provider is picked | 4 |
| ☐ | `TOKEN_ENCRYPTION_KEY` | Refresh-token encryption in `/api/auth/refresh` (the route throws without it) | No | He: `openssl rand -hex 32` (in PR #56's `app_secret_keys`, so it must exist) | 4 |

### Set by Terraform or AWS, nobody types them

| Name | Where it comes from |
| --- | --- |
| `DB_USERNAME`, `DB_PASSWORD` | The RDS-managed secret. AWS makes and keeps the password; the entrypoint builds `DATABASE_URL` from them plus `DB_HOST`, `DB_PORT` and `DB_NAME` (`directfanz`) |
| `REDIS_URL` | Terraform, from Valkey's address (`rediss://`) |
| `AWS_S3_BUCKET_NAME`, `S3_BUCKET_NAME`, `AWS_REGION`, `USE_LOCAL_STORAGE` | Terraform |
| `NEXTAUTH_URL` | Terraform: the load balancer's `http://` address in phase 1, `https://directfanz.io` once HTTPS is on (step 10) |
| `IVS_PLAYBACK_KEY_PAIR_ARN` | Terraform variable `ivs_playback_key_pair_arn`, set at step 5 |
| `APPLICATION_FEE_PERCENTAGE` (10), `FROM_EMAIL`, `FROM_NAME`, `SMS_PROVIDER`, `MARKETING_WEBHOOK_URL` | Terraform's `app_environment` map. Leave the last two unset to keep texts and the feed off |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN` | GitHub `production` environment variables, baked in at build (step 6) |

### The IVS playback key (step 5)

On his own computer:

```bash
openssl ecparam -name secp384r1 -genkey -noout -out ivs-private.pem
openssl ec -in ivs-private.pem -pubout -out ivs-public.pem
aws ivs import-playback-key-pair --name directfanz-prod \
  --public-key-material file://ivs-public.pem --tags Project=directfanz
```

The private half goes into `directfanz-prod/app` as `IVS_PLAYBACK_PRIVATE_KEY`
(the whole PEM), the returned ARN into `ivs_playback_key_pair_arn`. Then
delete both `.pem` files.

### Not needed on AWS at all

- `DATABASE_URL` as a secret: the entrypoint builds it.
- `BLOB_READ_WRITE_TOKEN`: files move to S3, which the task reaches through
  its IAM role.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: the task role replaces them.
  Never create access keys for the app.
- `VERCEL_*` tokens.

Optional, only if the feature is used, and each needs adding to
`app_secret_keys` in the infra PR first: `OPENAI_API_KEY` (content
moderation), `GOOGLE_CLIENT_SECRET` (Google sign-in),
`STREAM_URL_SIGNING_SECRET` (falls back to `NEXTAUTH_SECRET`).

What changing the leaked three does, from the key plan: everyone is signed
out, old stream and content links stop working, and old login tokens fail.
With launch still ahead, that costs nothing.

## Part 2: what to revoke after the move holds

Start a week after RUNBOOK step 11, once nothing points at the old setup. Each
line is **🟡 YES** and **he does it**, one at a time, in this order.

| ✓ | Where | What to do | Why |
| --- | --- | --- | --- |
| ☐ | Supabase | Already done at cut-over: database password reset (RUNBOOK 11.6) | Old app can't write |
| ☐ | Stripe | Delete the old webhook endpoints that pointed at the Vercel app; roll any secret key the Vercel project held | Old signing secrets and keys stop working |
| ☐ | SendGrid | Delete the API key the Vercel project used | Only the new, Mail-Send-only key remains |
| ☐ | Vercel | Remove all environment variables from the DirectFanz project, then pause or delete the project | Copies of the old (some leaked) values go away |
| ☐ | Vercel | Delete the Blob store | Kills every public file link shared before the paywall fix. Nothing in it moves to AWS (fresh start), so he downloads any file he wants to keep first |
| ☐ | Vercel | Revoke the account token used by GitHub Actions | Nothing can deploy to Vercel any more |
| ☐ | GitHub | Delete repo secrets `NEXTAUTH_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; retire `.github/workflows/vercel-deploy.yml` in its own PR | Leaked values gone from GitHub; the old deploy path closed |
| ☐ | Supabase | After the rollback window, take a final backup, then pause or delete the project | Last copy of the old database |
| ☐ | His computer | Delete any accounts export folder (`~/directfanz-accounts`) and any `.pem` files | They hold user data and key halves |
| ☐ | AWS, Justice Informed account | Check RDS, ECS and Parameter Store for any DirectFanz leftovers (the Nov 21 check covered Shock Value only) | Closes the last open item from the key plan |

## Left as a separate decision

Scrubbing the leaked values from git history. Once the keys are replaced the
old values are dead, so scrubbing only hides them. The key plan recommends it
only if the repo might become public or be shared; it rewrites every commit
and needs its own approval.
