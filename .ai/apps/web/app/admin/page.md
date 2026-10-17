# app/admin/page.tsx

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Platform-admin overview page: the admin session gate plus summary cards
(user/workspace/billing counts) and, under `ANALYTICS_PROVIDER=local`, a
"Site analytics" section reporting anonymous marketing traffic.

## What It Does

- `getAdminSession()` gates the page; `summarizeAdminCounts(
  adminOverviewStats())` feeds the top card grid.
- When (and only when) a real admin session exists AND the provider is
  `local`, `loadSiteAnalyticsSummary(30)` runs server-side and renders:
  pageviews / unique visitors / events summary-cards for the last 30
  days, then a top-10 paths list (path + view count, empty-state copy).

## Dependencies

- `../../src/admin-actions`, `../../src/admin`,
  `../../src/analytics` (`resolveAnalyticsProvider`,
  `loadSiteAnalyticsSummary`).

## Important Notes

- `force-dynamic`; the summary query only ever aggregates
  `workspace_id IS NULL` rows — anonymous traffic stays anonymous even in
  reporting.
- Third-party providers (`plausible`/`posthog`) deliberately get no card —
  their dashboards live on the vendor side.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Admin nav += "Setup checklist" link to `/setup` | Devin |
| 2026-10-10 | "Site analytics" 30-day card (local provider, admin-only) | Devin |
