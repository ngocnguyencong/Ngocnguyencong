# apps/web/app/api/mobile/feature-requests/route.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Mobile BFF endpoints for the feature board:
`GET /api/mobile/feature-requests` (list + `myVoteIds` + `canWrite`) and
`POST` (submit a request). Thin adapter — parses JSON leniently and
delegates to `mobileFeatureBoardBff` (`src/mobile-feature-board.ts`).

## Important Notes

- Auth/workspace/`canWrite` resolution lives in the BFF; the route only
  maps `{ body, status }` → `NextResponse.json`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created mobile feature board list/create route | Devin |
