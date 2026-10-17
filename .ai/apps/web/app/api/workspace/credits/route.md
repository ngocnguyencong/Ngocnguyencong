# apps/web/app/api/workspace/credits/route.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`GET /api/workspace/credits` — prepaid credit balance plus the recent
ledger for the caller's resolved workspace. Backs the billing page's
credits card.

## What It Does

- `getAuthSession(request.headers)` → `401` when absent.
- `resolveChatScope(session.user.id)` → `403` when no workspace.
- Returns `{ balance, transactions }` — the latest 50 ledger entries,
  each serialized `{ id, kind, amount, balanceAfter, reason,
  createdAt (ISO) }`. `referenceId` is deliberately NOT projected —
  grant references embed provider subscription ids members don't need
  (same reason `actorUserId` stays server-side).

## Important Notes

- `runtime = "nodejs"`; all reads are scoped to the resolved
  `workspaceId` — nothing caller-supplied reaches the queries.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | `referenceId` removed from the member-facing projection | Devin |
| 2026-10-11 | Workspace credits read endpoint | Devin |
