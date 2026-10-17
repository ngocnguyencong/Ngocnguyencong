# tests/e2e-production/global-setup.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Warm-up `globalSetup` for the production e2e suite (`playwright.
production.config.ts`). That suite runs `next dev` — `/api/local-reference`
rejects `NODE_ENV=production`, so `next start` is not an option — meaning
routes compile on first hit inside each test's own timeout. On loaded CI
runners that cold-compile cost failed `settings.spec.ts` 6/6 on a PR.

## What It Does

Reuses `warmRoutes` from `tests/e2e/global-setup.ts` with a minimal path
list — `/` (reference app shell, also covers `/?taskId=` recovery, which now
redirects to `/ai`), `/ai` (the production task console), `/settings`
(redirect chain compiles `settings/page` then `settings/[section]` for
"general"). All `/api/**` traffic in this suite is intercepted by each spec's
`page.route` fixtures, so no API paths are warmed.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Warm path `/dashboard` → `/ai` for the task console route | Devin |
| 2026-09-28 | Created: production-suite warm-up after CI cold-compile flakes | Devin |
