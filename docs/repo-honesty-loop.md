# Repo Honesty Loop

The repo honesty loop is the local truth gate for DirectFanz. It does not fix
the code automatically. It collects the blockers that make the repo unsafe to
ship, writes a durable report, and exits nonzero until the repo is honest.

## Commands

```bash
npm run honest:loop
```

Runs static honesty checks plus the real verification commands:

- `npm run typecheck`
- `npm run lint:check`
- `npm test -- --runInBand --passWithNoTests --watch=false`
- `npm run build`

```bash
npm run honest:loop:quick
```

Runs only static checks. Use this while cleaning repo structure before spending
time on the full compiler/test/build pass.

Useful options:

```bash
npm run honest:loop -- --quick --allow-dirty
npm run honest:loop -- --skip-build
```

## What It Checks

- The command is running from the real git checkout.
- Local worktree drift is explicit.
- Tracked files do not include secrets, databases, archives, cookies, or logs.
- Untracked sensitive/local artifacts are visible.
- Stale `.js` siblings do not shadow TypeScript modules in `src/lib`.
- Next build does not suppress TypeScript or ESLint failures.
- Configured tools have matching package dependencies.
- TypeScript scope is deliberate across web, mobile, e2e, and scripts.
- The default homepage is not a placeholder.
- Deployment readiness blockers are not left open.
- Local named imports match local named exports.

## Reports

Each run writes:

```text
reports/honesty/<timestamp>/report.md
reports/honesty/<timestamp>/report.json
reports/honesty/<timestamp>/*.log
reports/honesty/latest.md
reports/honesty/latest.json
```

The loop passes only when every static check and every command check passes.
Until then, the latest report is the backlog for making the repo honest.
