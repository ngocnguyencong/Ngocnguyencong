# playwright.production.config.ts

## Purpose

Run offline production-interface acceptance against fake/local providers using a
dedicated Next dev server, one worker, route warm-up and 15s/60s time budgets.

## Important Notes

Default to pinned Playwright Chromium on every OS and preserve the explicit
`PLAYWRIGHT_BROWSER_CHANNEL` override. The package script installs Chromium first.
The suite still uses Next dev because its local-reference endpoints are dev-only.

2026-10-11: allow PLAYWRIGHT_DATABASE_URL to select an isolated migrated database,
matching the local browser suite. Preserve the existing fallback and offline fixtures.
