# packages/supadata-cli/sd.mjs

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`sd` / `supadata` CLI — zero-dependency client over `apps/web`'s
`/api/v1` analytics surface. Auth via `SD_API_KEY` (`sd_*` site key or
`sk_*` workspace key), `SD_SITE_ID`, `SD_BASE_URL`; `--json` for raw
output, tables otherwise.

## Important Notes / NEVER Change

- Stays zero-dependency (Node >=18 fetch) — buyers run it from a clone without install.
- Site keys pin one site server-side; the CLI never selects workspaces.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
