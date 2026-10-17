# apps/web/app/api/v1/ai-tasks/route.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`POST /api/v1/ai-tasks` — API-key-authenticated AI task enqueue. Awaits
`rateLimitResponse(headers, apiV1Limiter, "api-v1")` before the BFF call.
`runtime = "nodejs"`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | `await rateLimitResponse` (async limiter, Task 4) | Devin |
