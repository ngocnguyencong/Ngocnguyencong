# apps/web/app/[locale]/settings/[section]/page.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Localized settings page loader — same contract as the default-locale
`settings/[section]/page.tsx`, localized via `params.locale` (copy +
panel data through `loadConnectionsPanelData`).

## Important Notes

- Loads the same per-section panel data as the canonical loader:
  `members`, `developers` (api keys + schedules + webhooks), `audit`,
  `sessions` (security section), `domains`, `connections`, and request
  `brand` — all passed to `WebSettingsPage`. A parity test in
  `src/locale-app-routes.test.ts` asserts both pages pass identical
  prop sets and call the same section loaders.
- Shares `loadConnectionsPanelData` with the default-locale loader —
  the single seam keeps accounts fetch/copy/locale/provider-availability
  in sync across both surfaces.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | `general` section resolves `canExportWorkspace` + `workspaceExportCopy` like the canonical route (WP8) | Devin |
| 2026-10-16 | `usage` section loads `loadUsagePanelData` → `usage` prop, matching the canonical route (WP2) | Devin |
| 2026-10-13 | Load `developers`/`audit`/`sessions` panel data like the canonical route — localized developers/audit/security sections rendered empty | Devin |
| 2026-09-27 | Connections-section wiring merged via feat/prod-ready-kit — initial mirror | Devin |
