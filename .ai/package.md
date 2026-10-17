# package.json (repo root)

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Workspace root manifest + script surface. `packageManager: pnpm@11.19.0`
(enforced via Corepack), turbo task runner, changesets release flow.

## Important Notes

- Windows `build` uses `scripts/run-turbo.mjs`, keeping the task graph and desktop
  exclusion. Browser scripts install pinned Chromium before testing. The local
  gate resets Web's Next cache between suites, matching Linux CI.

- Verify-gate split (2026-09-22): `typecheck:local` /
  `typecheck:desktop` filter turbo typecheck by desktop exclusion/inclusion;
  `check:local` = lint + typecheck:local + test + format:check;
  `verify:local` = check:local + build + both Playwright suites (no Rust);
  `verify:desktop` = typecheck:desktop + desktop tests + `build:desktop`
  (needs Rust + Tauri prereqs). `typecheck` and `check` are unchanged —
  `check` stays the full CI gate and its typecheck includes
  `cargo check` for `apps/desktop`.
- `scripts/subrepos.mjs` `KEEP_SCRIPTS` deliberately does not carry the
  `*:local`/`*:desktop` keys into sub-repos; `tests/subrepos.test.ts` and
  `tests/e2e/local-setup.test.ts` guard both contracts.
- `format:check` runs `prettier --check .` — `.env.example` has no parser
  and is excluded via `.prettierignore`.
- `setup` runs `scripts/setup.mjs` — the interactive guided-setup wizard
  (preflight → env bootstrap → optional install/migrate). Its `--check`
  and `--yes` paths keep it safe for non-interactive shells.
- Root acceptance gates call nested scripts with `corepack pnpm`. Turbo still
  resolves `pnpm` by name for workspace tasks, so Windows setup needs the
  Corepack-generated shim in a user-writable directory on `PATH` (README).

## Agent Decisions / Thoughts

- **2026-09-28 Codex:** Keep the gate steps and order unchanged while using
  Corepack for root recursion. Turbo does its own package-manager lookup, so a
  Corepack-generated shim must be discoverable; `corepack pnpm` alone cannot
  run Turbo workspace tasks on a shim-free `PATH`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | `setup` script added for the interactive guided-setup wizard (`scripts/setup.mjs`) | Devin |
| 2026-10-03 | `license` field added (`SEE LICENSE IN LICENSE.md`) | Devin |
| 2026-09-28 | Made root acceptance gates recurse through Corepack; preserved full/local desktop split | Codex |
| 2026-09-22 | Added typecheck:local/desktop + check:local + verify:local/verify:desktop | Devin |
