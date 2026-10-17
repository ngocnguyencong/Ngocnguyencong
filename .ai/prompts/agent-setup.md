# prompts/agent-setup.md

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose

Pasteable prompt a product builder hands their coding agent to stand the
kit up end to end: `<SETUP_PATH>` (docker / podman / host) for local work
and `<DEPLOY_TARGET>` (coolify / vps-docker / local-only) for the deploy.

## What It Does

- Orders the reading contract: `llms.txt` (repo map) → `AGENTS.md`
  (boundaries) → `docs/agent-security.md` → `docs/agent-setup.md` executed in
  order with its verification checkpoints.
- Uses `node scripts/setup-env.mjs` and `--check` to bootstrap from
  `.env.example`; container equivalents in the runbook support Docker/Podman
  without host Node.js. The helper creates only missing files, preserves
  existing valid config (especially `CREDENTIAL_ENCRYPTION_KEY`), generates
  only missing/empty/placeholders, and stops on invalid/conflicting keys
  before writing. It reports safe status without printing secret values.
- Routes local setup through `docker-compose.dev.yml` for Docker/Podman
  without requiring host Node.js/Corepack; Postgres, migration, and dev start
  sequentially to prevent overlapping installs. The host path requires Node
  22+ and runs `corepack pnpm dev`.
- Routes deploys: `coolify` → the `docs/vps-coolify.md` checklist;
  `vps-docker` → start Postgres, migrate, then start the compose `app` profile
  with a unique generated Postgres password matching `DATABASE_URL`,
  loopback-bound published ports, Caddy + `ufw` + scheduler-tick timer;
  `local-only` stops at local verification. Keeps
  `RATE_LIMIT_STORE`/`TRUSTED_PROXY_COUNT` honest for the proxy topology.
- Requires migrations before first real sign-in and ends with a status-based
  report contract. Keep dashboard demo/health separate from real auth and
  cross-user workspace isolation; use two unrelated fictional users and mark
  checks `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` with safe evidence.
- Closes with the invariant rules: never commit `.env*`, no placeholder
  secrets in production, no `NEXT_PUBLIC_`/`EXPO_PUBLIC_` server secrets,
  `workspaceId` scoping, fail-twice → stop and report, never disable
  auth/RLS/rate limits, ask before destructive ops.

## Agent Decisions / Thoughts

- The prompt delegates step detail to `docs/agent-setup.md` rather than
  duplicating commands — the guide is the single source of truth; the
  prompt owns the verification/reporting contract.
- `llms.txt`, `docs/agent-setup.md`, and `docker-compose.dev.yml` are
  authored in parallel with this prompt; they are referenced as canonical
  targets, not summarized.
- "Fails twice → stop and report sanitized command output" is the anti-rabbit-hole
  clause; security features (auth checks, RLS — Supabase deployments fix
  exposure via `pnpm supabase:doctor --fix-rls`, rate limits) are named
  explicitly as things never to disable.

## Important Notes / NEVER Change

- Keep the verification checklist in sync with `docs/agent-setup.md`'s
  checkpoints and the real endpoint/command names (`/api/health`,
  `corepack pnpm jobs:tick`, `corepack pnpm --filter @supastack/db
  db:migrate`, `corepack pnpm check`/`check:local`) — they are pinned in
  code, not invented here. All `pnpm` invocations carry the `corepack`
  prefix per the runbook's pinned-toolchain rule.
  `check:local`/`typecheck:local` are kept in the generated script
  manifests now, so both gate names work downstream — the prompt's
  "monorepo vs standalone" phrasing is conservative.
- This is the on-ramp prompt: `prompts/README.md` lists it first, ahead of
  the styling prompts.

## Change History

| Date       | Change                                                                | Author |
| ---------- | --------------------------------------------------------------------- | ------ |
| 2026-10-07 | Uses the safe setup helper, no-host-Node container path, sequential migrations, loopback VPS ports, unique DB credentials, and separate real auth/isolation evidence | Devin |
| 2026-10-06 | Env step covers empty secrets (`SCHEDULER_TICK_SECRET=` ships empty, tick 404s); `up web` → `up -d`; stale "check:local is monorepo-only" claim corrected — it's in KEEP_SCRIPTS and ships | Devin  |
| 2026-10-06 | Report step now names `pnpm check` for standalone checkouts (generated manifests drop `check:local`); RLS fix phrased as Supabase-conditional | Devin  |
| 2026-10-06 | Initial doc: agent setup + deploy prompt added to `prompts/`          | Devin  |
| 2026-10-06 | Bare `pnpm` → `corepack pnpm` throughout (pinned-toolchain parity with the runbook)       | Devin  |
