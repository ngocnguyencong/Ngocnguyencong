# apps/web/src/api-v1-bff.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit tests for `createApiV1Bff` with stubbed `ApiV1BffDependencies`:
OpenAPI passthrough, session auth, workspace listing, entitlements,
model requirements, task create/read/result with workspace-match checks,
and the `sk_` API-key auth lane (invalid key → 401 without session
fallback, `write` scope enforcement, key pinned to its workspace).

## Important Notes

- Task-dependency mocks assert the `caller` field
  (`{ userId, workspaceId }`) resolved from either the cookie session +
  `findCurrentWorkspace` or the `resolveApiKey` result — dependencies
  must receive identity explicitly, not via headers.
- A dependency `ApiV1DependencyError(429, "rateLimited")` re-envelopes to a
  429 `rateLimited` body, not a 500.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Dependency-429 re-envelope coverage | Devin |
| 2026-09-27 | Caller-propagation coverage (session + `sk_` paths) | Devin |
