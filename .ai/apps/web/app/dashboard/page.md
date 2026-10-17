# apps/web/app/dashboard/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Primary analytics surface: WorkspaceShell + site nav (Overview/Live/Visitors/Revenue→insights/Goals/Funnels/Alerts/Mentions/Settings), period picker, KPI StatGrid, interactive TrendChart, tabbed BreakdownPanel — all real queries via supadata/load + queries.

## Important Notes / NEVER Change

- Sub-pages under dashboard/ mount the same frame via src/supadata/web/frame.tsx.
- `taskId`/`submissionKey` query params forward to `/ai` — legacy
  `/dashboard?taskId=…` recovery links keep working (shared
  `taskRecoveryHref` helper at the top of `DashboardPage`, mirrors
  app/[locale]/dashboard/page.tsx; pinned by the canonical-dashboard case in
  src/locale-app-routes.test.ts).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Recovery forward extracted to shared `taskRecoveryHref` (`src/ai-task-recovery.ts`) | Devin |
| 2026-10-11 | Added with the supadata analytics module | Devin |
| 2026-10-16 | WP4: header row (h1 + site domain + live pill via `realtime()`), StatGrid deltas from previous equal-length range, `EmptyState` empty state + `CreateSiteForm`, panels moved to shared `dashboard.module.css` responsive grid | Devin |
