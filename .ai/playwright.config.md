# playwright.config.ts

> Last updated: 2026-10-09 | Protection: STANDARD

## Purpose

Local E2E config — chromium only, `fullyParallel`, own `next dev` webServer
on `PLAYWRIGHT_PORT` (default 3100). The runner must own that server; reusing
an arbitrary process on the port can silently test another local project.
Only `*.spec.ts` files are collected, keeping Vitest `*.test.ts` files out of
the Playwright runner.
`playwright.production.config.ts` is a separate config and now also has a
`globalSetup` (`./tests/e2e-production/global-setup.ts`).

## Important Notes / NEVER Change

- 2026-10-12: Pin APP_ENV=local and fake/local AI, billing, email and jobs in
  webServer.env. Local reference suites must not inherit a durable/real-provider
  configuration from the shell or populated .env files.

- Default to Playwright's pinned Chromium on Windows too;
  the package scripts install it automatically. Preserve explicit browser channel
  overrides. Do not assume Google Chrome exists on a fresh machine.

- Windows local runs are serial (`workers: 1`). The progression was 11
  (machine default) → 4 → 1: on loaded CI runners four parallel Chromium
  workers still starved `next dev` enough that warmed `next/link` clicks
  returned 200 while the page stayed on its old heading past the assertion
  budget — the same stall signature that motivated the first cap, so the
  suite now matches the production config's single-worker contract. Keep the
  actual navigation assertions and leave other platforms' worker selection
  unchanged. Windows also gets a 30s `expect.timeout` (15s elsewhere) for
  residual dev-compile latency.
- Do not enable `reuseExistingServer` by default. A local 3100 collision once
  caused 14 false E2E failures against another project's page. Use
  `PLAYWRIGHT_PORT` to pick a free port; occupied ports should fail clearly.
- `globalSetup: ./tests/e2e/global-setup.ts` warm-compiles all route families
  before the parallel run — Playwright starts `webServer` BEFORE
  `globalSetup`. The production config runs `next dev` as well (local-reference
  APIs are dev-only — `next start` would 404 them), so it needs its own
  warm-up; shared logic lives in `warmRoutes` inside the dev global-setup.
- `expect.timeout` 15s and test `timeout` 60s (2026-09-22): `next dev` route
  + RSC renders can take 10-30s under `fullyParallel`×11 on slower Windows
  machines; the defaults (5s/30s) flaked on compile latency, not defects.
  The production config now uses the same budgets (2026-09-28) — it runs
  `next dev` too, and its 5s/30s defaults caused the 6/6 settings CI failure.
- `retries: 1` on CI only (2026-09-28): a cold-compile failure reruns with
  the route now warm — the cheapest insurance against runner-load variance.
- The local acceptance gate resets `.next` between browser suites to avoid graph
  resumption failures. Standalone reruns with a stale cache can use the same
  `node scripts/reset-e2e-cache.mjs` helper after stopping the test server.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-09 | Windows workers 4→1 and win32 `expect.timeout` 15s→30s after the warmed suite still showed nav stalls on shared CI hardware | Devin |
| 2026-09-28 | Cap Windows local Playwright at four workers after an 11-worker Docs navigation stall; default suite 25/25 | Codex |
| 2026-09-27 | Disabled local server reuse after a port collision sent E2E tests to another app; use `PLAYWRIGHT_PORT` to select a free port | Codex |
| 2026-09-27 | Limit Playwright discovery to `*.spec.ts` after a Vitest file in the E2E directory broke CI collection | Codex |
| 2026-09-22 | globalSetup + expect 15s + test 60s (Windows e2e reliability) | Devin |
| 2026-09-28 | Documented that the production config also gets a globalSetup — `next dev` means route compile happens per first-hit there too (CI flake fix) | Devin |
| 2026-09-28 | `retries: 1` on CI; production config inherits the 15s/60s budgets | Devin |
