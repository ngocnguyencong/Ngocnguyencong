# app/api/analytics/collect/route.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Route-level tests for `POST /api/analytics/collect` — provider gating,
body validation, rate limiting, and the inserted row contract.

## What It Does

- 404 when `ANALYTICS_PROVIDER` is off/plausible/posthog (mode never
  revealed); 204 path only under `local`.
- 400 on non-object bodies, bad `kind`, oversized fields, non-relative
  paths, pageviews without a path, events without a name; 413 past the
  2 KB bound.
- Happy path: exactly one inserted row with a 64-char hex `visitorHash`
  that never equals the raw IP, no `ip`/`userAgent` fields persisted,
  `workspaceId: null`.
- Rate-limit short-circuit returns the limiter response.

## Dependencies

- `vitest`; mocks `./route` dependencies (`src/analytics`,
  `src/rate-limit-*`, `src/observability-runtime`).

## Important Notes

- Asserts both response status and the exact row shape reaching the
  repository — the privacy boundary is a test contract, not a comment.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial coverage (16 tests) | Devin |
