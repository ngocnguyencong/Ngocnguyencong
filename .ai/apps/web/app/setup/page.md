# app/setup/page.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

`/setup` — the in-app readiness checklist. `force-dynamic`, metadata
`title: "Setup"` + `robots: { index: false }`. Evaluates
`collectSetupSnapshot()` → `evaluateSetupReadiness()` and renders
`SetupReportView`.

## Important Notes

- Access: `NODE_ENV === "development"` → open to anyone (a fresh clone
  must show the checklist before auth works); otherwise `getAdminSession()`
  or `notFound()` — same operator-surface posture as `/admin`.
- Chrome: signed-in sessions render inside `WorkspaceShell`
  (`active: "Settings"`, `getRequestBrand()`); anonymous dev visitors get
  the plain `token-root`/`main-panel` utility layout (`styles.shell`),
  mirroring `/status`.
- Disallowed in `app/robots.ts` and absent from the marketing sitemap +
  llms.txt (asserted in `src/robots.test.ts`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
