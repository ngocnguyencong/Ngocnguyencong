# packages/db/drizzle.config.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

drizzle-kit config for `@supastack/db` (migrate/generate/studio). Postgres
dialect, schema `src/schema.ts`, out `./drizzle`, strict + verbose.

## What It Does

Before exporting the config, it loads the repo-root `.env`
(`fileURLToPath(new URL("../../.env", import.meta.url))`, guarded by
`existsSync`) because drizzle-kit's bundled dotenv only reads `.env` from
its cwd (`packages/db`) — `pnpm --filter @supastack/db db:migrate` from the
root would otherwise miss `DATABASE_URL`. `process.loadEnvFile` does NOT
overwrite already-set vars (verified on Node 22.16.0), so an explicit env
(CI's postgres service, exported `DATABASE_URL`) still wins.

Fallback URL is `postgres://supastack:supastack@localhost:5432/supastack`,
matching `docker-compose.yml` `POSTGRES_*` (which only applies on first
volume init — do not "fix" compose for existing volumes).

## Important Notes / NEVER Change

- `.github/workflows/ci.yml` keeps its own `postgres:postgres` service —
  the fallback/env precedence must keep working for it.
- `packages/db/src/postgres.test.ts` uses its own fixture URL — unrelated.
- `tests/local-setup.test.ts` asserts fallback === `.env.example`
  `DATABASE_URL` === compose credentials; keep all three in sync.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Root `.env` loading + supastack:supastack fallback (Windows setup report) | Devin |
