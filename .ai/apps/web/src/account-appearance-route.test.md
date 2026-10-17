# src/account-appearance-route.test.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Route tests for `app/api/account/appearance/route.ts` — same mocking
shape as `workspace-credits-route.test.ts` (`getAuthSession`,
`@supastack/config`, and `appearance-sync` stubbed): GET 401 signed out,
PUT 403 cross-origin, PUT 400 `invalidPreferences`, and a PUT→GET round
trip scoped to the session user with `Cache-Control: no-store`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created (4 tests) | Devin |
