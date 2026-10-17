# tests/local-setup.test.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

Vitest regression guard for the local fresh-setup contract (added for the
Windows outside-report fixes). 4 tests, pure text/regex parsing — no YAML
dependency.

## What It Asserts

1. `.env.example` `DATABASE_URL` user/password/db equal
   `docker-compose.yml` `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`.
2. `packages/db/drizzle.config.ts` fallback URL equals the `.env.example`
   `DATABASE_URL`, and the config loads the repo-root `.env`
   (`loadEnvFile` + `existsSync` present).
3. Root scripts: `verify:local` starts with `pnpm check:local`,
   `typecheck:local` contains `--filter=!@supastack/desktop`,
   `check:local` uses `typecheck:local`.
4. `apps/web` dev uses `--port 3000`, `apps/docs` dev uses `--port 3001`,
   `.env.example` `APP_URL` port is 3000, and the Dockerfile runs the
   standalone `server.js` (not the `start` script).

## Important Notes

- Runs under root vitest alongside `tests/subrepos.test.ts` — keep it free
  of workspace deps.
- `tests/**/*.ts` is in eslint's `disableTypeChecked` list — no tsconfig.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | `repoRoot` fix — `new URL("..", import.meta.url)` resolved to `tests/` (file moved under `tests/e2e/`), ENOENT on `.env.example`; now `"../.."` | Devin |
| 2026-09-22 | Created for the Windows fresh-setup fixes (TDD: red → green) | Devin |
