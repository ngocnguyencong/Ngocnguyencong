# apps/web/app/admin/admin-nav.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Static regression guard for the platform-admin nav. Scans every
`app/admin/**/page.tsx` and asserts each `href="/admin…"` resolves to a
route directory that ships a `page.tsx` — catches dead links like the
removed `/admin/orders` entry without booting the app.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Added with the `/admin/orders` dead link removal | Devin |
