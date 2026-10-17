# .githooks/pre-push

> Last updated: 2026-09-20 | Protection: STANDARD

## Purpose

Local auto-sync: runs `scripts/sync-subrepos.mjs` when a push targets
`refs/heads/main` (reads hook stdin refs). Warn-only — never blocks the push;
CI (`subrepo-sync.yml`) is the authoritative backstop.

## Important Notes / NEVER Change

- File must keep mode `100755` (exec bit) — set via
  `git update-index --chmod=+x .githooks/pre-push`.
- Wired by root `package.json` `prepare` → `git config core.hooksPath .githooks`
  (`|| exit 0` so Docker/CI installs without git don't fail).
- `SUBREPO_SYNC_SKIP=1` env escapes the sync for one-off pushes.
