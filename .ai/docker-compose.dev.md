# docker-compose.dev.yml

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose

Fully containerized dev stack — the compose counterpart to
`docker-compose.yml` (which only supplies postgres/minio for host-side dev
and the production-image `app` profile). Lets an agent stand the app up with
zero host toolchain beyond a container runtime.

## What It Does

- `postgres`: identical service contract to the base file (postgres:16-alpine,
  supastack user/db/password, `pg_isready` healthcheck, `postgres-data`
  volume) but **no host port publish** — reachable only as `postgres:5432` on
  the compose network. Same default project name + volume as the base file,
  so the two stacks share one postgres container/data set.
- `dev`: `node:22-bookworm-slim` (glibc on purpose — musl hits pnpm/native-dep
  edge cases), `working_dir /app`, bind-mount `.:/app`, named `pnpm-store`
  volume at the default pnpm store path, publishes `3000:3000`, waits on
  healthy postgres, runs `corepack enable && corepack pnpm install
  --frozen-lockfile && exec corepack pnpm --filter @supastack/web dev`.
- `migrate` (profile `migrate`): same image/mounts, one-shot `pnpm --filter
  @supastack/db db:migrate`.
- Top comments document the sequential startup (Postgres → migrate → dev),
  bounded health polling from the runbook, short `logs --tail` diagnostics,
  Docker + Podman usage (compose providers, podman socket, SELinux `:z`), and
  the host↔container node_modules mixing caveat.

## Prescribed Startup

Start Postgres, run migrations once it is healthy, then start the web service.
Do not start `dev` while `migrate` is installing dependencies into the same
bind-mounted `node_modules` directory. Use the bounded health poll in
`docs/agent-setup.md`; inspect only a finite log tail when diagnosing a failure.

```sh
docker compose -f docker-compose.dev.yml up -d postgres
docker compose -f docker-compose.dev.yml --profile migrate run --rm -T migrate
docker compose -f docker-compose.dev.yml up -d dev
docker compose -f docker-compose.dev.yml logs --tail=100 dev
```

The same sequence works with `podman compose` when a compose provider is
configured. The log-tail command is for diagnostics; it exits instead of
blocking an agent session.

## Agent Decisions / Thoughts

- Env precedence was verified in source, not assumed: `@next/env` 16.3.6 only
  assigns `.env*` values for keys absent from the initial `process.env`
  snapshot, and `drizzle.config.ts` uses `process.loadEnvFile` (never
  overrides). So compose `environment:` > `env_file: .env` > mounted
  `apps/web/.env.local` — `DATABASE_URL` is pinned to the `postgres` service
  hostname in `environment:` while `env_file: .env` supplies the Phase-1
  generated secrets; a `localhost:5432` value inside the container cannot win.
- `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` keeps the pinned pnpm@11.19.0 download
  non-interactive; `HOSTNAME=0.0.0.0` is belt-and-braces (next dev already
  defaults to 0.0.0.0); `WATCHPACK_POLLING` is a commented escape hatch for
  Docker Desktop bind mounts.
- Docker unavailable on the authoring machine — file was validated by
  inspection only, not by `docker compose config` or a live `up`.

## Important Notes / NEVER Change

- Keep `postgres` behavior aligned with `docker-compose.yml` (same creds,
  healthcheck, volume name) — the runbook and README assume the shared
  credentials.
- The guide `docs/agent-setup.md` references this file by name; keep the
  service names (`dev`, `migrate`, `postgres`) and the `migrate` profile flag
  in sync with it.
- `.env` is a required `env_file` — compose errors if it's missing; Phase 1
  of the runbook always creates it first.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-07 | Usage summary now prescribes Postgres → migrate → dev and finite log-tail diagnostics | Codex |
| 2026-10-06 | Header/migrate comments now show `run --rm -T` (no TTY allocation — non-interactive shells) | Devin |
| 2026-10-06 | Initial file: postgres (internal-only) + dev + migrate-profile services for agent-driven setup | Devin |
