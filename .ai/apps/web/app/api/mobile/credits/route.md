# apps/web/app/api/mobile/credits/route.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`GET /api/mobile/credits` — mobile BFF twin of `GET
/api/workspace/credits`; same `{ balance, transactions }` payload for the
Expo billing screen.

## What It Does

- `getAuthSession(request.headers)` → `401` when absent.
- `resolveMobileWorkspaceContext(session.user.id)` resolves the active
  workspace (cookie → preference → personal fallback) → `403` when none.
- Returns `{ balance, transactions }` — latest 50 ledger entries, ISO
  timestamps, workspace-scoped. `referenceId` stays server-side like the
  web twin (grant refs embed provider subscription ids).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | `referenceId` removed from the member-facing projection | Devin |
| 2026-10-11 | Mobile credits read endpoint | Devin |
