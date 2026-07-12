# DirectFanz Agent Guide

This file is the shared source of truth for Codex, Claude, Fable, and other
coding agents working in this repository. Agent-specific files may add a small
wrapper, but they must not contradict or duplicate this guide.

## Start With Repository Truth

- The normal integration branch and pull request base is
  `integration-testing`. `main` is the release branch; do not target it unless
  the task explicitly requires that base.
- Before editing, inspect `git status`, the current branch, the intended base,
  and active pull requests. Preserve unrelated local changes.
- When agents work concurrently, use separate branches and preferably separate
  git worktrees. Never share or clean another agent's working tree.
- Read `README.md`, `NEXT_STEPS.md`, and `PRODUCTION_STATUS_REPORT.md` before
  making readiness or deployment claims. If `PRODUCTION_READINESS.md` exists,
  it takes precedence for current launch status.
- Treat `.kiro/specs/` as historical requirements and design context, not proof
  that a feature, infrastructure stack, or deployment is currently live.

## Scope Rules

- Keep one bounded intent per branch and pull request.
- Make small, focused commits. Stage explicit paths in a mixed worktree; do not
  use broad staging that can capture another agent's changes.
- Do not perform broad refactors, mass formatting, file moves, dependency
  migrations, or architecture changes without explicit approval.
- During a production trust sprint, work only on security findings, correctness
  bugs, CI/build/test integrity, secret hygiene, and documentation accuracy. Do
  not add features, redesign UI, or expand the product scope.
- Do not weaken lint, type, test, audit, or build gates to make a check pass.
  Fix the cause or document the blocker.

## Branches, Commits, And Pull Requests

- Branch from the latest intended base. Use `claude/<scope>` for Claude,
  `fable/<scope>` for Fable, and `agent/<scope>` for Codex/automation.
- Use imperative, scoped commit subjects. Each commit should represent one
  reviewable idea and should not mix cleanup with behavior changes.
- Use PR titles in the form `<area>: <imperative summary>`, for example
  `agent-workflow: align codex and claude handoff`.
- Open PRs against `integration-testing` by default. Never merge, force-push,
  or retarget a PR unless the task explicitly authorizes it.
- The PR description must contain: Intent, Files changed, Verification run,
  Known risks, External config needed, and What Codex should review closely.
  Use `.github/pull_request_template.md`.

## Verification Before Push

For application, configuration, dependency, or workflow changes, run the
focused tests for the touched area and then the repo gates that apply:

```bash
npm run typecheck
npm run lint:check
npm test -- --runInBand
npm run build
```

For dependency or security work, also run `npm audit --audit-level=high` and
record the result. For documentation-only changes, `git diff --check` plus a
manual check that referenced paths and commands exist is sufficient; mark the
application gates as skipped because the change is docs-only.

In the PR, record every command as `PASS`, `FAIL`, or `SKIPPED`. For failures,
include the exit code, the first actionable error, and whether the failure also
exists on the base branch. Never describe an unrun or failing check as passing.

## Security And Audit Findings

- Treat audit output as evidence to investigate, not permission for a blanket
  upgrade. Record the affected package and dependency path, severity,
  production or development reachability, proposed fix, and verification.
- Do not run `npm audit fix --force`, accept an unrelated major upgrade, lower
  an audit threshold, or suppress a finding without explicit approval.
- Critical and high findings must remain visible in Known risks until they are
  fixed, verified, or explicitly accepted by the owner.
- If credentials or private data appear in source, logs, or git history, stop
  copying or printing them. Remove tracked material safely, flag rotation as an
  external action, and treat history rewriting as a separate approved task.

## Deployment And Secrets

- Vercel is the supported application deployment target. Vercel Blob, Upstash
  Redis, Stripe, SendGrid, and external PostgreSQL are the expected production
  services. AWS may still host an external resource such as RDS, but the old
  AWS/ECS/Terraform deployment specs are not the supported app deploy path.
- When deployment docs disagree, use this order: current
  `PRODUCTION_READINESS.md` if present, then `README.md`, `NEXT_STEPS.md`, and
  `PRODUCTION_STATUS_REPORT.md`, then live workflow/config files. Surface any
  remaining conflict in the PR instead of silently choosing a provider.
- Do not change production deployment workflows, `vercel.json`, domains, DNS,
  production migrations, provider architecture, or release behavior without
  explicit approval. Do not run a production deploy or merge to `main` as part
  of an ordinary implementation task.
- Keep real values in Vercel or GitHub secret stores. Commit only placeholders
  in example env files. Never paste secrets into code, docs, PRs, test output,
  shell history, or workflow logs.
- Do not add shell steps that echo secret values. Treat `vercel env pull`,
  secret rotation, secret-name changes, and deploy-workflow edits as privileged
  operations requiring explicit approval and a handoff note.

## Claude And Fable Handoff To Codex

- Leave the durable handoff in the PR description, not only in chat or an
  untracked note. Update it after the final commit.
- List exact files and behavior changed, exact verification results, unresolved
  risks, and any dashboard-only or secret configuration still required.
- Under `What Codex should review closely`, name the risky files, assumptions,
  migrations, security boundaries, or generated output that deserve a second
  pass. Write `None` only after checking.
- Leave the branch pushed and the worktree free of unrelated changes. If work
  is intentionally incomplete, say so plainly and keep the PR in draft.

## Design Compliance

Before making UI changes, read `DESIGN.md` and follow the documented archetype,
token direction, forbidden patterns, prompt recipe, and QA checklist.

- Keep component behavior consistent with existing patterns.
- Prefer existing design tokens or semantic tokens over one-off styles.
- Include screenshots or a clear visual verification note in UI pull requests.
- Do not introduce patterns listed under `Avoid` in `DESIGN.md`.
