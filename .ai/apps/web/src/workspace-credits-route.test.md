# apps/web/src/workspace-credits-route.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Route tests for `GET /api/workspace/credits` with the auth/scope/credits
seams stubbed.

## What It Does

- `401` when `getAuthSession` resolves no session.
- `200` with `{ balance, transactions }` for an authenticated member —
  transaction rows serialized with ISO `createdAt`.
- Workspace scoping — the credits reads receive the `resolveChatScope`
  workspace id, never a user-supplied one.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | Projection assertions now cover `referenceId`/`actorUserId` staying server-side | Devin |
| 2026-10-11 | Route coverage for the workspace credits endpoint | Devin |
