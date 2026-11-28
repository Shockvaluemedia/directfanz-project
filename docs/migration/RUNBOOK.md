# DirectFanz move to AWS: runbook

The order of operations for moving DirectFanz from Vercel (and, most likely,
Supabase) to the Shock Value AWS account, from merging the open work to the
first real purchase. It follows the AWS plan ("DirectFanz on AWS: setup plan
and monthly cost", Nov 22, 2026) and adds the database, the key rotation and
rollback.

**Database plan (Demetrius, Nov 23, 2026): a fresh start.** The old data is
test and demo data. Only the accounts on his own db4commerce email domain move
over, with what they need to sign in; content, purchases and files start new.
The old database is never changed or deleted by this runbook until step 14.

**🟡 YES** marks a step that waits for Demetrius's explicit yes, because it
changes AWS, Stripe, DNS, live data or the code, spends money, or can't be
undone. **He does it** marks a step only he can do, because it involves keys,
passwords or his accounts. Nothing in this folder has been run against
anything real.

Companion documents:

- [DATABASE_COPY.md](./DATABASE_COPY.md): the database scripts, two findings,
  the fresh start with his accounts (the plan) and the full copy (reference).
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
| Private S3 storage | Storage PR | 2 |
| Listening parties on IVS | IVS PR | 2, 9 |
| Network, RDS, Valkey, S3, ECS, load balancer, Route 53, HTTPS, schedules, alarms, deploy workflow | PR #56 (`infra/aws/`, `.github/workflows/deploy-aws.yml`) | 3 to 12 |
| Database build, account carry-over, baseline | This PR, `scripts/migration/` | 7 |

Steps 3 to 12 follow PR #56's own order of approvals (`infra/aws/README.md`):
state bucket and first apply on a test address, fresh keys, IVS playback key,
GitHub production environment, name servers then HTTPS, scheduled calls. This
runbook adds the database, the test purchase, the cut-over and rollback in
between.

**Reaching the private database.** Every database step here (step 7) goes
through PR #56's move-day tunnel, `infra/aws/scripts/db-tunnel.sh`: a
separate one-off task with no secrets and its own role, which forwards
`127.0.0.1:5432` on his machine to RDS and stops when the script ends or after
the minutes given (4 hours at most). There is no standing shell access to the
app service. Each run starts a small AWS task (a few cents), so it's part of
the yes for the step it serves.

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
   the database is set up here first, as a fresh start
   (DATABASE_COPY.md, "Fresh start with his accounts"). All of it runs from
   his machine.
   1. **He does it:** `scripts/migration/export-accounts.sh` against Supabase,
      read-only. It lists every email domain with a count; then, with
      `--email-domain`, each of his accounts that would move. Nothing is
      written anywhere. Check: the list is exactly the accounts he expects.
   2. **He does it. 🟡 YES** Save those accounts with `--execute` (still
      read-only on Supabase) into a private folder on his machine.
   3. **🟡 YES** With the tunnel open in another terminal
      (`infra/aws/scripts/db-tunnel.sh 120`): `prisma db push`, `baseline.sh`
      and `check-schema.sh` on the `directfanz` database.
   4. **🟡 YES** `import-accounts.sh` (first as a check that rolls back, then
      with `--execute`), then delete the local folder.

   Move-day checklist for the database, in this order, each on its own yes:

   - [ ] **🟡 YES 1. Save his accounts** to a private folder on his computer
     (`export-accounts.sh --execute`). Supabase is only read.
   - [ ] **🟡 YES 2. Build the new AWS database** (`prisma db push`,
     `baseline.sh --execute`, `check-schema.sh` says IN STEP). Opens the
     tunnel, a few cents.
   - [ ] **🟡 YES 3. Load his accounts** (`import-accounts.sh` check, then
     `--execute`), then delete the local folder. Opens the tunnel, a few cents.

### Phase C: prove it on AWS before anyone sees it

8. **First deploy on the load balancer's address. 🟡 YES**
   1. Run "Deploy to AWS (manual)" from `main`, with migrations on. He
      approves the run in GitHub. After step 7's baseline it finds nothing to
      do.
   2. No file copy: content starts fresh, so nothing moves from Vercel Blob
      (which stays as it is until step 14).
   3. Smoke test on the `load_balancer_url` output:
      - `GET /api/health` is 200.
      - He signs in with one of his carried accounts and its old password.
      - Sign up a new account, sign in, sign out. An old session cookie is
        rejected.
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
    1. Put the Vercel site in maintenance mode.
    2. No data copy: the database was set up fresh at step 7. If he made a
       new db4commerce account on the old site since then, carry it the same
       way (steps 7.1, 7.2 and 7.4); the import refuses accounts that are
       already there.
    3. Take the old apex and www records out of `existing_dns_records`, set
       `site_on_aws = true`, and apply.
    4. Smoke test again on `https://directfanz.io` (step 8's list).
    5. Point the two Stripe test endpoints at `https://directfanz.io`.
    6. **He does it:** reset the Supabase database password, so the old app
       can't write even by mistake. Leave the project itself in place.

    Rollback, while the old setup is intact: put the old site records back in
    `existing_dns_records`, set `site_on_aws = false`, apply, and take Vercel
    out of maintenance mode. Anything done on AWS in between stays on AWS; it
    is all test-mode until step 13.

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
    local accounts export folder.

## Who to call when a step fails

| Symptom | Likely cause | First move |
| --- | --- | --- |
| `psql` can't connect to Supabase | Transaction pooler (port 6543) or an old client | Use the session/direct connection on 5432; set `PG_BIN` to a newer client |
| `export-accounts.sh`: no users on that domain | Domain typed differently | Copy it from the domain list the dry run prints |
| `import-accounts.sh`: users already on the target | It was loaded before | Nothing to do; check by signing in |
| `migrate deploy`: "relation drops does not exist" | #54's migration order not fixed | Finding 1 in DATABASE_COPY.md |
| Deploy workflow fails at `migrate deploy` with P3005 "schema is not empty" | Baseline skipped | `baseline.sh`, step 7 |
| Certificate stuck on Pending | Name servers not switched yet | Step 10.1, then wait |
| Task never starts, "secret key not found" | A key missing from `directfanz-prod/app` | Add it (empty string if the feature is off) |
| Stripe events fail signature | Wrong endpoint secret in Secrets Manager | Re-copy the signing secret for that endpoint |
