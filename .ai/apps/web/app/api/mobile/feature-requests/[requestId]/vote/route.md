# apps/web/app/api/mobile/feature-requests/[requestId]/vote/route.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`POST /api/mobile/feature-requests/{requestId}/vote` — toggles the
authenticated member's vote on a request. Awaits `params.requestId` and
delegates to `mobileFeatureBoardBff.vote(headers, requestId)`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created mobile vote toggle route | Devin |
