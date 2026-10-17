# scripts/subrepos.json

> Last updated: 2026-10-12 | Protection: CRITICAL

## Purpose

Declarative list of the standalone per-platform repos produced by
`pnpm sync:subrepos`. Names MUST stay `supastack-web` / `supastack-mobile` /
`supastack-desktop` — they are the repo names buyers are invited to.

## Shape

Array of `{ name, app, remoteEnv, extraPaths, scripts }`:

- `name` — repo name under the origin org.
- `app` — workspace dir mirrored as the sub-repo's product code.
- `remoteEnv` — env var that overrides the derived remote URL.
- `extraPaths` — extra root paths shipped verbatim (a directory entry walks
  its whole tree). All three repos ship `scripts/scheduler-tick.mjs` (buyers
  run `pnpm jobs:tick` locally), `docs/agent-security.md`, and a curated set
  of `docs/*.md` guides;
  web also ships `Dockerfile`, `docker-compose.yml`/`docker-compose.dev.yml`,
  `.dockerignore`, `scripts/run-turbo.mjs`, `scripts/setup-env.mjs` +
  `scripts/setup.mjs` (the guided setup wizard — its `spec.scripts` entry
  wires `pnpm setup`; the env bootstrap targets `apps/web`, so the pair
  stays web-only), `docs/agent-setup.md`, the
  `scripts/supabase-*.mjs` helpers (its `spec.scripts` wires
  `supabase:doctor`/`supabase:provision` — they need `packages/db`, which
  only the web closure carries), and the whole `prompts/` prompt library.
  `docs/agent-setup.md` is web-only: it references `apps/web`, `Dockerfile`,
  and the compose files, none of which ship to mobile/desktop. Entries that
  don't exist yet are skipped by `buildFileManifest`.
- `scripts` — per-repo overrides merged over `KEEP_SCRIPTS` output in the
  generated `package.json` (`renderRootPackageJson`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | Desktop manifest += `docs/desktop-updates.md` extraPath (updater signing/`--config` overlay guide) | Devin |
| 2026-10-10 | Web manifest += `scripts/setup.mjs` extraPath and a `setup` script override so `pnpm setup` works in the web checkout | Devin |
| 2026-10-07 | Shared agent security checklist added to every platform manifest | Codex |
| 2026-10-07 | Web manifest includes the safe local environment bootstrap helper; native manifests remain scoped to their platform | Codex |
| 2026-10-06 | web += `scripts/supabase-doctor.mjs` + `scripts/supabase-provision.mjs` extraPaths and matching `supabase:doctor`/`supabase:provision` script entries (shipped docs/`AGENTS.md`/`prompts` name them — consistency test pins references ↔ manifest); `docs/agent-setup.md` dropped from mobile/desktop (web-only references) | Devin |
| 2026-10-06 | extraPaths gained curated `docs/*.md` guides on all repos; web also gained `docker-compose.dev.yml` + the `prompts/` directory — feeds the generated `llms.txt` | Devin |
| 2026-09-27 | `scripts/scheduler-tick.mjs` added to every repo's extraPaths (prod-ready-kit) | Devin |
| 2026-09-20 | Created for the Tauri/subrepos spec (Part 2) | Devin |
