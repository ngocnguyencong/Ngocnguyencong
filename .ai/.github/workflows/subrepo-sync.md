# .github/workflows/subrepo-sync.yml

> Last updated: 2026-09-20 | Protection: STANDARD

## Purpose

Auto-push the monorepo into the three sub-repos on every `push` to `main`
(+ `workflow_dispatch`).

## What It Does

Pure-Node job: checkout + setup-node → `node scripts/sync-subrepos.mjs` with
`SUBREPO_*_REMOTE` set to `x-access-token` URLs under `github.repository_owner`.
Skipped (with a warning) when `SUBREPO_SYNC_TOKEN` is unset.

## Important Notes / NEVER Change

- Requires repo secret `SUBREPO_SYNC_TOKEN` = PAT/GitHub-App token with
  `contents:write` on `supastack-web`, `supastack-mobile`, `supastack-desktop`.
  `GITHUB_TOKEN` cannot push to other repos.
- `concurrency: subrepo-sync` serializes runs — keep it.
- Local mirror: `.githooks/pre-push` runs the same script on pushes to `main`
  (wired by the root `prepare` script → `core.hooksPath`).
