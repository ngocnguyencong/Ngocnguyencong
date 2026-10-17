# apps/web/app/api/v1/workspaces/current/route.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`GET /api/v1/workspaces/current` — current workspace read for API-key
callers. Awaits `rateLimitResponse(headers, apiV1Limiter, "api-v1")` first.
`runtime = "nodejs"`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | `await rateLimitResponse` (async limiter, Task 4) | Devin |
