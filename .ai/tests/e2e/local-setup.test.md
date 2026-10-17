# local-setup.test.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Guard the fresh local setup contracts that can otherwise fail only after a
buyer installs dependencies and starts the acceptance gates.

## Important Notes

- Compose credentials may use `${NAME:-default}`. The local-default comparison
  resolves that fallback rather than comparing the raw interpolation syntax
  with the example URL. Never inspect real operator environment values.

- Guards: Next environment files stay untracked, both Next app typechecks
  generate their types before tsc, and E2E commands install pinned Chromium.

- Keep the Docker credentials, Drizzle fallback, desktop split, and fixed
  web/docs port assertions when adding script checks.
- The root gate contract checks ordered nested commands for `check`,
  `check:local`, `verify:local`, and `verify:desktop`. These commands use
  `corepack pnpm` rather than requiring a globally installed pnpm package.
- Turbo still looks up `pnpm` by name when it launches workspace tasks, so the
  README must document a Corepack-generated shim in a user-writable directory.

## Agent Decisions / Thoughts

- **2026-09-28 Codex:** Assert the exact ordered gate steps in this test because
  the fix must not silently remove desktop coverage or other acceptance work.
- **2026-09-28 Codex:** Guard the README's Corepack shim bootstrap as well;
  script text alone passed while Turbo still failed at runtime without a
  resolvable `pnpm` binary.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-28 | Added root gate ordering and Windows Corepack bootstrap contracts | Codex |
