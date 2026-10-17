# scripts/supabase-provision.mjs

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`pnpm supabase:provision` — creates a Supabase Cloud project through the
Management API (`POST /v1/projects`, `GET /v1/projects/{ref}` polling
until ACTIVE_HEALTHY). Needs `SUPABASE_ACCESS_TOKEN`; args
`--org --name --region [--plan] [--write-env] [--force] [--migrate] [--yes]`.
Without `--yes` it is a dry run that prints the plan (project creation
can be billable). Generates a strong DB password (never printed), builds
session/transaction pooler + direct URLs (masked on output), optionally
writes root `.env` (never overwrites without `--force`), optionally runs
`pnpm --filter @supastack/db db:migrate`, and prints the Storage S3
endpoint + dashboard steps for S3 keys.

## Exported pure helpers (tested in tests/supabase-provision.test.ts)

`parseArgs`, `generateDbPassword`, `buildConnectionStrings`,
`maskDatabaseUrl`, `mergeEnv`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial script (phase B4) | Devin |
