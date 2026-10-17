# src/mobile-usage-route.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Route tests for `GET /api/mobile/usage` — `getAuthSession` and
`resolveMobileWorkspaceContext` are stubbed (the same pattern as the
mobile credits/appearance route tests) to assert 401 signed-out, 403 no
workspace, and the 200 overview passthrough.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
