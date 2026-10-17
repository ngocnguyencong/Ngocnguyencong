# apps/web/src/api-v1-bff.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Dependency-injected BFF behind the public `/api/v1/*` routes: auth
resolution (cookie session via `getSession`, or `Bearer sk_*` via the
optional `resolveApiKey`), scope checks (`read`/`write`; `null` scopes =
unrestricted session caller), body validation, and the error envelope
(`{ error: { code, message, requestId } }`).

## Important Notes

- `ApiV1EntitlementStatus` is the persisted billing domain
  (`active`/`trialing`/`past_due`/`inactive`) — keep it aligned with
  `BillingEntitlementStatus` in `packages/db/src/repositories.ts` and the
  OpenAPI `Entitlement` schema in `packages/api`.
- `ApiV1TaskCaller` (`{ userId, workspaceId }`) is resolved once per
  request and passed into every task dependency input
  (`createAiTask`/`readAiTask`/`readAiTaskResult`) so downstream layers
  never re-derive identity from raw headers — API keys carry no cookie
  session.
- `resolveCaller` treats `resolveApiKey` returning `"invalid"` as a hard
  401 (no cookie fallback when a bearer token was supplied).
- `ApiV1DependencyError`/`errorResponse` admit statuses
  400/401/403/404/409/429/500 — a dependency 429 re-envelopes as
  `rateLimited`, never a 500.

## Bug Fixes

| Date | Bug | Cause | Fix |
| --- | --- | --- | --- |
| 2026-09-27 | `sk_` API-key task create/read 401→500/404 | Task dependencies received raw client headers; the worker BFF re-derives identity via cookie `getSession`, which API-key callers lack | Dependencies now receive the resolved `caller` identity alongside `headers` |

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Status unions += 429 (`rateLimited` dependency errors re-envelope intact) | Devin |
| 2026-09-27 | Created — caller propagation + persisted entitlement domain | Devin |
