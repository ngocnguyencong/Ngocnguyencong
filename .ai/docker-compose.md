# docker-compose.yml

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose

Base compose file: local backing services (Postgres + optional MinIO) for
host-side development, plus the production-image `app` profile that runs
the Dockerfile build next to Postgres. The containerized dev counterpart
lives in `docker-compose.dev.yml` (internal-only postgres + `dev` +
`migrate` services).

## What It Does

- `postgres`: `postgres:16-alpine` with local `supastack` defaults (parity
  with `.env.example`'s `DATABASE_URL`); `POSTGRES_PASSWORD` is configurable
  for a unique VPS credential. Publishes `127.0.0.1:5432:5432` for host-side
  tooling only, with `postgres-data` volume and `pg_isready` healthcheck.
- `web` (profile `app`): builds the root Dockerfile, publishes
  `127.0.0.1:3000:8080`, `env_file: .env` injects the env file verbatim — an
  inline comment now warns that `DATABASE_URL` inside `.env` must use the
  `postgres` service hostname under this profile (localhost inside a
  container is the container itself). `depends_on` waits for healthy
  postgres; no restart policy (documented in the runbook).
- `minio` (profile `storage`): `minio/minio:latest`, configurable local
  default credentials, publishes API/console on `127.0.0.1:9000` and
  `127.0.0.1:9001` only.

## Agent Decisions / Thoughts

- The `env_file` comment (added 2026-10-06) mirrors the Phase-5 runbook
  warning because the trap fires silently: a `.env` written for host-side
  commands (`localhost:5432`) makes the `app` profile's web container try
  to reach Postgres on itself.
- Published ports bind to loopback by default so a VPS firewall cannot be
  bypassed by direct Postgres, web, or MinIO access. Caddy on the VPS reaches
  the app at `127.0.0.1:3000`. The `supastack` credentials remain local-only;
  set unique production values before initializing the VPS database volume.
- Docker unavailable on the authoring machine — file validated by
  inspection only, not `docker compose config` or a live `up`.

## Important Notes / NEVER Change

- Keep `postgres` creds/healthcheck/volume aligned with
  `docker-compose.dev.yml` — both share the default project name and the
  `postgres-data` volume, so their postgres containers are the same one.
- `web`'s `3000:8080` mapping pairs with the Dockerfile's `PORT=8080` +
  `EXPOSE 8080`; the `app` profile name is referenced by
  `docs/agent-setup.md`, `docs/deployment.md`, and `prompts/agent-setup.md`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-07 | Binds Postgres/web/MinIO ports to loopback and adds parameterized Postgres and MinIO credentials with local-only defaults | Devin |
| 2026-10-06 | `env_file: .env` comment warns `DATABASE_URL` must use the `postgres` service hostname under the `app` profile | Devin |
| (older) | postgres + MinIO services + `app` profile for the Dockerfile image — pre-mirror history; see git log | — |
