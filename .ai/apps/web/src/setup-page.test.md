# src/setup-page.test.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Page-access tests for `app/setup/page.tsx`: development is open to
anonymous visitors on the plain layout, signed-in dev visitors get the
`WorkspaceShell` chrome, production 404s without an admin session, and a
platform admin renders. `NODE_ENV`, `getAdminSession`, `getAuthSession`,
`getRequestBrand`, `collectSetupSnapshot`, and `WorkspaceShell` are all
vi-mocked; `renderToStaticMarkup` renders the real `SetupReportView`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
