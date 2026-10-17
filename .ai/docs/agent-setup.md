# docs/agent-setup.md

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

THE agent-executable runbook: an autonomous coding agent with a fresh clone
and a shell stands the kit up end to end — preflight → env bootstrap →
containerized/host local setup → VPS deploy (Coolify or plain Docker) — with
verification checkpoints after every phase. `prompts/agent-setup.md` is the
pasteable contract that routes agents here; `llms.txt` links it as the map
entry for setup/deploy.

## What It Does

- Opens with the agent contract: read `llms.txt`, `AGENTS.md`, and
  `docs/agent-security.md`; execute in order and report safe checkpoint
  status/output with secrets and session values redacted. `.env.example` is
  the only env inventory, never commit `.env*`, fail-twice → stop and report,
  never disable auth/RLS/rate limits, ask before destructive ops.
- A short note after the contract points humans at `pnpm setup`
  (`node scripts/setup.mjs`) as the interactive alternative covering the
  Phase 0 host checks and Phase 1 env bootstrap; agents keep the
  deterministic phases.
- Phase 0: Docker/Podman paths use the supplied Node 22 container and need no
  host Node.js/Corepack; only host-pnpm needs Node 22+/Corepack. Port checks
  and a decision table route to Docker / Podman / host-pnpm +
  managed Postgres paths. OS notes cover WSL 2 for Docker Desktop, the
  PowerShell `corepack.cmd`/`--install-directory` shim, and the pnpm@11.19.0
  pin.
- Phase 1: `node scripts/setup-env.mjs` creates only missing env files from
  `.env.example`, preserves existing valid config, generates only
  missing/empty/placeholder secrets, keeps a valid
  `CREDENTIAL_ENCRYPTION_KEY` stable, and stops on invalid/conflicting keys
  before writing. Hostless Docker/Podman commands run it in Node 22. The
  read-only `--check` validates secret format and consistency without printing
  values; POSIX files use mode `600` and Windows must keep an account-private
  checkout ACL. Production values stay server-side.
- Phase 2: `docker-compose.dev.yml` path — start Postgres, run the one-shot
  migration, then start dev to avoid concurrent installs into the bind mount.
  A bounded 10-minute health poll has 198 attempts (2-second request limit,
  1-second pause), reports progress every 10 retries, and tails logs only on
  failure; `/api/health` → `"status":"ok"`, then the local demo;
  host-hybrid alternative via the base compose postgres.
- Phase 3: sequential Podman equivalents — socket (`systemctl --user enable --now
  podman.socket` + `DOCKER_HOST`), docker-compose binary preferred over
  `podman-compose` (which only honors `depends_on.condition:
  service_healthy` from ≥1.1.x — older releases let `dev`/`migrate` race
  postgres), `:z` on SELinux, `podman machine` on macOS/Windows with the
  `.:/app` mount limited to VM-shared paths (WSL escape hatch).
- Phase 4: condensed Coolify checklist delegating to `docs/vps-coolify.md`
  (install curl, Dockerfile pack, port 8080, `/api/health`, prod env set,
  private-network Node 22 migrator before app deploy, `* * * * *` scheduled
  tick via `node -e fetch`, and a real transactional email provider for
  production auth). The env table is split: the seven `packages/config`-enforced boot-required vars
  vs the not-boot-enforced feature set (`SCHEDULER_TICK_SECRET`,
  `RATE_LIMIT_STORE`, `TRUSTED_PROXY_COUNT`, `ADMIN_EMAILS`).
- Phase 5: fresh production-only clone, `setup-env.mjs` generates app secrets
  safely in the Docker container, then a unique secret-manager-generated
  `POSTGRES_PASSWORD` is entered alongside matching `DATABASE_URL`; start
  Postgres, migrate, then start the app with Postgres/web/MinIO ports on
  loopback by default. Caddy install + one-line Caddyfile,
  `TRUSTED_PROXY_COUNT=1`, ufw 22/80/443, cron tick with `x-scheduler-key`
  from a root-protected file. Migrations use a throwaway
  `node:22-bookworm-slim` container and mode-600 temporary env file after
  Postgres starts and before the app profile.
- Security protocols: the numbered non-negotiable ruleset (generated secrets,
  server-only prefixes, `.gitignore` coverage, prod env requirements, image
  forcing `APP_ENV=production`, workspaceId scoping, `supabase:doctor
  --fix-rls`, `RATE_LIMIT_STORE`/`TRUSTED_PROXY_COUNT`, transactional-only
  email, invite gate, `PUBLIC_AI_DAILY_BUDGET_MICROUNITS=0`, Postgres audit
  trail).
- Verification checklist + symptom→cause→fix troubleshooting table.
  Health and demo evidence are explicitly separate from real authentication
  and cross-user isolation; two unrelated test users are required for the
  latter. Node-dependent checks use the selected host/container toolchain.

## Agent Decisions / Thoughts

- Every command/env name traces to a real source: `packages/config`
  superRefine for the production-required set and secret formats;
  `@next/env` 16.3.6 dist + `drizzle.config.ts` `process.loadEnvFile` for env
  precedence; `apps/web/app/api/internal/scheduler-tick/route.ts` for the
  `x-scheduler-key` header and 404-while-unset behavior; `health-snapshot.ts`
  for the `"status":"ok"`/`degraded` JSON + 503; Dockerfile `ENV`/`CMD` for
  forced `APP_ENV=production`; `docker-compose.yml` for the `app` profile's
  `env_file: .env` + `3000:8080` mapping.
- Phase 5 documents that `.env` must use the `postgres` service hostname for
  the app container, while host-side migrations use `localhost` through the
  published loopback port. The base compose ports are loopback-bound by
  default; set unique Postgres credentials before initializing a VPS volume.
- Docker Desktop could not start on the authoring machine. Compose assertions
  are covered by a focused structural test, but live container acceptance is
  still unverified and must be reported as such.

## Important Notes / NEVER Change

- Keep in sync with: `docker-compose.dev.yml` (service/profile names),
  `docker-compose.yml` (app profile, loopback port mappings and credentials),
  `Dockerfile` (port 8080, forced APP_ENV), `packages/config` (required prod vars, secret
  formats), `.env.example` (env inventory), `docs/vps-coolify.md` (Coolify
  specifics), `scripts/scheduler-tick.mjs` + the route (tick contract),
  `prompts/agent-setup.md` (the reading contract), and `llms.txt` (link).
- The guide must stay imperative/runbook-style — numbered steps, verbatim
  commands, expected-result checkpoints. No marketing prose.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Phase 2 demo checkpoint URL → `http://localhost:3000/ai` (the AI-task console moved off `/dashboard`) | Devin |
| 2026-10-10 | Note after the contract names `pnpm setup` (`node scripts/setup.mjs`) as the interactive alternative to the Phase 0–1 host path | Devin |
| 2026-10-07 | Adds `setup-env.mjs` bootstrap/check, stable secret handling, sequential local/VPS migration and startup, bounded 10-minute health polling, loopback Compose, safe migration env, and separate real auth/isolation evidence | Devin |
| 2026-10-06 | Audit hardening: bounded health gate (30×2s + failing curl); PowerShell checkpoint; decision-table notes Phase 1 runs first on every path; podman-compose ≥1.1.x floor for `service_healthy` + `podman machine` shared-paths caveat; Phase 5 `!override` extended to web `127.0.0.1:3000:8080` + MinIO note; verification preamble notes Node-less VPS runs pnpm steps in the throwaway container | Devin |
| 2026-10-06 | Review fixes: Phase 1 checkpoint catches empty secrets; `run -T` for non-TTY shells; Phase 4 table split boot-required vs feature vars; Phase 5 migrations via throwaway host-network node container (+ `git` in apt install); TTY troubleshooting row | Devin |
| 2026-10-06 | Initial doc: agent setup/deploy runbook (phases 0–5 + security protocols + verification + troubleshooting); "Deploying — the universal sequence" preamble added before Phase 4 | Devin |
