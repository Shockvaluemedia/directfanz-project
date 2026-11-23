# DirectFanz move to AWS: runbook

The order of operations for moving DirectFanz from Vercel (and, most likely,
Supabase) to the Shock Value AWS account, from merging the open work to the
first real purchase. It follows the AWS plan ("DirectFanz on AWS: setup plan
and monthly cost", Nov 22, 2026) and adds the database copy, the key rotation
and rollback.

**🟡 YES** marks a step that waits for Demetrius's explicit yes, because it
changes AWS, Stripe, DNS, live data or the code, spends money, or can't be
undone. **He does it** marks a step only he can do, because it involves keys,
passwords or his accounts. Nothing in this folder has been run against
anything real.

Companion documents:

- [DATABASE_COPY.md](./DATABASE_COPY.md): the database scripts, two findings,
  copy path and fresh path.
- [KEY_ROTATION_CHECKLIST.md](./KEY_ROTATION_CHECKLIST.md): every key, where it
  goes, who makes it, what to revoke after.

## Pieces from other work

This runbook only sequences them. Each is its own PR, built and reviewed
separately.

| Piece | Where | Needed by step |
| --- | --- | --- |
| Reposition, paywall, sign-in limits | PRs #54, #52, #55 | 1 |
| Migration-order fix | PR #54's branch (finding 1 in DATABASE_COPY.md) | 1 |
| Container, Connect webhook secret, headers, chat sign-in | Code-change PR(s) from the AWS plan | 2 |
| Private S3 storage and the Blob-to-S3 file copy | Storage PR | 2, 8 |
| Listening parties on IVS | IVS PR | 2, 9 |
| Network, RDS, Valkey, S3, ECS, load balancer, Route 53, HTTPS, schedules, alarms, deploy workflow | PR #56 (`infra/aws/`, `.github/workflows/deploy-aws.yml`) | 3 to 12 |
| Database export, import, verify, baseline | This PR, `scripts/migration/` | 7, 11 |

Steps 3 to 12 follow PR #56's own order of approvals (`infra/aws/README.md`):
state bucket and first apply on a test address, fresh keys, IVS playback key,
GitHub production environment, name servers then HTTPS, scheduled calls. This
runbook adds the database, the test purchase, the cut-over and rollback in
between.

Two asks of PR #56 before step 7:

- **A route to RDS for the database copy.** RDS is private and PR #56 has no
  ECS Exec or bastion. Turning on ECS Exec for the service (one setting plus
  SSM permissions on the task role) would let an SSM port forward from his
  machine reach the database (DATABASE_COPY.md, "A route to RDS").
- **`TOKEN_ENCRYPTION_KEY` in `app_secret_keys`.** The refresh route needs it
  and PR #56's list doesn't have it (KEY_ROTATION_CHECKLIST.md).

## Steps

### Phase A: get the code ready (nothing live changes)

1. **Merge the open work. 🟡 YES**
   Fix #54's migration order first (finding 1), then merge #54, then #52; #55
   any time. Check: CI green on `integration-testing`.

2. **Merge the AWS code changes and PR #56. 🟡 YES**
   The code-change PR(s), the storage PR, the IVS PR and PR #56, then
   `integration-testing` into `main` (the deploy workflow runs from `main`
   only). Then rehearse the database steps against the merged code, which
   touches nothing real:
   ```bash
   npm ci
   mkdir -p /tmp/before && git archive fa9087d prisma | tar -x -C /tmp/before   # today's schema
   scripts/migration/rehearse-local.sh --schema /tmp/before/prisma/schema.prisma \
     --next-prisma-dir prisma
   ```
   Check: "0 failed". The one FINDING (old migrations) is expected until a
   squashed baseline migration lands.

### Phase B: build AWS next to the running site (PR #56, README steps 1 to 6)

3. **State bucket and first apply, on a test address. 🟡 YES (starts about $73 a month)**
   1. Create the Terraform state bucket and `terraform init` (PR #56 README,
      step 1).
   2. Fill `terraform.tfvars`: `alert_email`, and every current directfanz.io
      record (site, email, verification TXT) in `existing_dns_records`. Write
      the current site records down too; they are the rollback.
   3. Review `terraform plan`, then `terraform apply` in Shock Value,
      us-east-1. The site gets the load balancer's own `http://` address;
      nothing changes at Hostinger and directfanz.io still runs on Vercel.

   Rollback: `terraform destroy` (RDS deletion protection must be turned off
   first, with his yes). Nothing public has changed.

4. **Fresh keys. He does it.**
   Fill the JSON secret `directfanz-prod/app` with every key in
   [KEY_ROTATION_CHECKLIST.md](./KEY_ROTATION_CHECKLIST.md), part 1, saved in
   one go from his own computer. Stripe keys are **test** keys for now;
   features that are off get an empty string. The leaked values are never put
   into AWS. Check: every key is present (or the task won't start); no value
   was pasted anywhere but Secrets Manager.

5. **IVS playback key. He does it.**
   Make the P-384 pair on his computer, import the public half, put the
   private half in the secret, set `ivs_playback_key_pair_arn` and apply
   (checklist, "The IVS playback key"). **🟡 YES** for the apply.

6. **GitHub production environment. He does it. 🟡 YES**
   Create the `production` environment with himself as required reviewer, set
   `AWS_DEPLOY_ROLE_ARN` to the `github_deploy_role_arn` output, and
   optionally `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SENTRY_DSN`.

7. **Prepare the database (must happen before the first deploy).**
   The deploy workflow runs `prisma migrate deploy` before it rolls the
   service. On an empty database that builds the wrong schema (finding 2), so
   the database is set up here first.
   1. **He does it:** run `scripts/migration/export.sh` (dry run, read-only)
      against Supabase from his machine. It lists every table's row count.
   2. **Decide copy path or fresh path. 🟡 YES** (DATABASE_COPY.md, "Choose a
      path").
   3. Fresh path: `prisma db push` and `baseline.sh` on the `directfanz`
      database. **🟡 YES** This is final.
      Copy path: a full trial copy into the `directfanz` database (export,
      import, verify, baseline). **🟡 YES** It is redone for real at step 11.

### Phase C: prove it on AWS before anyone sees it

8. **First deploy on the load balancer's address. 🟡 YES**
   1. Run "Deploy to AWS (manual)" from `main`, with migrations on. He
      approves the run in GitHub. On the copy path it applies only the
      migrations newer than the baseline; on the fresh path it finds nothing
      to do.
   2. Copy real files from Vercel Blob to S3 with the storage PR's copy step
      and update their addresses. **🟡 YES** (Blob stays as it is.)
   3. Smoke test on the `load_balancer_url` output:
      - `GET /api/health` is 200.
      - Sign up, sign in, sign out. An old session cookie is rejected.
      - An artist uploads a track; a fan without access gets no file; the
        download link expires.
      - Chat connects only when signed in.
      - `scripts/migration/check-schema.sh` says IN STEP.

9. **Test purchase and test party in Stripe test mode. 🟡 YES**
   1. **He does it:** create two test-mode webhook endpoints in Stripe, one
      for the platform account and one for Connect events, at the load
      balancer address plus `/api/payments/webhooks` (test mode takes plain
      `http`; if Stripe refuses it, do this step after step 10). Put both
      signing secrets in `directfanz-prod/app` and redeploy.
   2. Set up the community (Nahvee at the top, Never More second, invites,
      Nahvee's single and drop). Connect a test Stripe account for Nahvee, buy
      the drop and a party ticket with a test card. Check: the purchase shows
      paid, the files unlock, the 10% fee lands on the platform.
   3. A short IVS party: the ticket holder can watch, an account without a
      ticket is refused.

### Phase D: switch (PR #56, README steps 8 to 11)

10. **Name servers to Route 53, then HTTPS. 🟡 YES**
    1. **He does it:** at Hostinger, replace directfanz.io's name servers with
       the four in the `route53_name_servers` output. Registration stays at
       Hostinger. The site keeps running on Vercel from the copied records.
    2. Wait until `dig NS directfanz.io +short` shows only Route 53 servers.
    3. Set `enable_https = true` and apply. Terraform waits for the
       certificate, then serves HTTPS on the load balancer.

    Rollback: switch the name servers back at Hostinger (can take up to 48
    hours, which is why the records were copied first).

11. **Cut over. 🟡 YES (one session, about an hour)**
    1. Put the Vercel site in maintenance mode, so nothing writes.
    2. Copy path only: empty the `directfanz` database from step 7's trial,
       then the final copy in DATABASE_COPY.md order: export, import,
       `verify.sh --live`, baseline, then "Deploy to AWS (manual)" with
       migrations on, then `check-schema.sh`. Any MISMATCH or DRIFT stops the
       cut-over here.
    3. Take the old apex and www records out of `existing_dns_records`, set
       `site_on_aws = true`, and apply.
    4. Smoke test again on `https://directfanz.io` (step 8's list).
    5. Point the two Stripe test endpoints at `https://directfanz.io`.
    6. **He does it:** reset the Supabase database password, so the old app
       can't write even by mistake. Leave the project itself in place.

    Rollback, while the old setup is intact: put the old site records back in
    `existing_dns_records`, set `site_on_aws = false`, apply, and take Vercel
    out of maintenance mode. Anything bought on AWS in between is in Stripe;
    reconcile it from there.

12. **Scheduled calls. 🟡 YES**
    Set `enable_schedules = true` and apply, then **he** copies `CRON_SECRET`
    into the EventBridge connection once (PR #56 README, step 11, has the
    command). Check: both calls show 200 in the logs within 10 minutes, and
    the party reminder and marketing calls fire. Then activate the `Project`
    cost allocation tag in Billing so the budget alarm counts DirectFanz.

13. **Go live. 🟡 YES (spends real money)**
    **He does it:** swap in the live Stripe keys and create the two live
    webhook endpoints at `https://directfanz.io/api/payments/webhooks`
    (checklist, part 1), then redeploy. Make one small real purchase and
    refund it. Then Nahvee's drop date can be picked.

### Phase E: close the old setup (after a quiet week)

14. **Revoke and retire. 🟡 YES, one item at a time.**
    KEY_ROTATION_CHECKLIST.md, part 2: Vercel project and tokens, the Blob
    store (this kills every public file link shared before the paywall fix),
    old Stripe endpoints and keys, the old SendGrid key, GitHub's Vercel
    secrets and deploy workflow, and finally the Supabase project. Delete the
    local export folders.

## Who to call when a step fails

| Symptom | Likely cause | First move |
| --- | --- | --- |
| `export.sh`: pg_dump too old | Supabase runs a newer Postgres | Install that client version, set `PG_BIN` |
| `import.sh` refuses: target has tables | A rehearsal left data behind | Use a new scratch database, or empty it with his yes |
| `migrate deploy`: "relation drops does not exist" | #54's migration order not fixed | Finding 1 in DATABASE_COPY.md |
| Deploy workflow fails at `migrate deploy` with P3005 "schema is not empty" | Baseline skipped | `baseline.sh`, step 7 |
| Certificate stuck on Pending | Name servers not switched yet | Step 10.1, then wait |
| Task never starts, "secret key not found" | A key missing from `directfanz-prod/app` | Add it (empty string if the feature is off) |
| Stripe events fail signature | Wrong endpoint secret in Secrets Manager | Re-copy the signing secret for that endpoint |
