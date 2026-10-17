# .prettierignore (repo root)

> Last updated: 2026-09-26 | Protection: STANDARD

## Purpose

Prettier exclusions for generated output, lockfiles, and local/agent state —
keeps `pnpm format:check` scoped to hand-maintained source files. Listed in
`ROOT_FILES`, so it ships verbatim to every generated repo.

## Important Notes

- `.ai/` is ignored (2026-09-26): the per-file agent docs are hand-aligned
  (tables, wrapped prose) and intentionally not prettier-clean — never run
  `prettier --write` on them. Ignoring the tree fixes the monorepo
  `format:check` and keeps downstream `format:check` green too, since this
  file ships and `.ai/` docs ride along with the files they mirror.
- `pnpm-lock.yaml` + `**/drizzle/meta/*.json` are machine-written; the rest
  are build/test output (`test-results/`, `playwright-report/`, `.next*/`,
  `.turbo/`, `dist/`, `coverage/`, `**/src-tauri/target|gen`) and local
  state (`tmp/`, `.worktrees/`, `.superpowers/`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-26 | `.ai/` added — mirror docs are hand-formatted and now ship to the generated repos | Devin |
