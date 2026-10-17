# apps/web/app/settings/[section]/page.tsx

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Default-locale settings page loader: validates the `[section]` param
(`isSettingsSectionId` → `notFound`), resolves session/workspace,
copy, and panel data for the settings surface.

## Important Notes

- `?status=` query feeds panel feedback (connected-account callback
  results land here as `?status=` values; the usage actions redirect
  `budget-saved` / `cap-saved` / `cap-cleared` / `forbidden` / `invalid`
  through the same channel).
- Connections section data comes from `loadConnectionsPanelData`
  (shared with the `[locale]` mirror page so the two loaders cannot
  drift); usage section data comes from `loadUsagePanelData` only when
  `raw === "usage"`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | `general` section resolves `canExportWorkspace` via `canExportWorkspaceData()` (fail-closed outside request scope) + passes `workspaceExportCopy` for the owner/admin export card (WP8) | Devin |
| 2026-10-16 | `usage` section loads `loadUsagePanelData` → `usage` prop (workspace usage controls, WP2) | Devin |
| 2026-09-27 | Connections-section wiring merged via feat/prod-ready-kit — initial mirror | Devin |
