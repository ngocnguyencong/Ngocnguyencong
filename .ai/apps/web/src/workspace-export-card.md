# apps/web/src/workspace-export-card.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Settings → General "Workspace data" card — presentational component
(`WorkspaceExportCard`) rendered only for owner/admin members. A plain
`<a href="/api/workspace/export">` keeps the download working without
JavaScript; the route re-checks the role server-side.

## What It Does

- `<section aria-labelledby>` + `<h3>` + one-sentence description +
  `button button-secondary` link. Copy arrives via the
  `WorkspaceExportCardCopy` prop from `dictionary.settings.workspaceExport`
  (all 4 locales).
- Rendered in `web-settings-page.tsx` general branch behind
  `canExportWorkspace && workspaceExportCopy` — the prop is resolved
  server-side by `canExportWorkspaceData()` in `workspace-access.ts`
  (fails closed outside a request scope).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Workspace data export card (WP8) | Devin |
