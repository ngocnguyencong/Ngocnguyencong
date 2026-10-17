# apps/web/src/api-v1-runtime.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Production `apiV1Bff` instance: Drizzle-backed `findCurrentWorkspace`,
entitlement listing, AI task create/read/result bridging to
`productionAiTaskBff`, and API-key auth delegated to
`resolveApiKeyCaller` (`api-key-auth.ts`) — the shared resolver also used by
`/api/mcp`.

## Important Notes / NEVER Change

- The `sk_` resolution logic lives in `api-key-auth.ts`; do not re-inline a
  divergent copy here.
- `mapBffError` normalizes worker-BFF error codes into `ApiV1DependencyError`:
  BFF 400/403/404/409/429 pass through (`rateLimited` AND `quotaExceeded`
  included); any other status collapses to 500 `internalError`.
- `toEntitlementStatus` mirrors the persisted billing domain
  (`active`/`trialing`/`past_due`/`inactive`) and maps any unknown stored
  status to `"inactive"` — the list endpoint fails closed instead of
  throwing a 500 on a single unexpected row.
- `createAiTask` forwards a FRESH `Headers` to `productionAiTaskBff.create`
  containing only a server-controlled `origin` (`serverConfig.app.webUrl`)
  plus the client's `idempotency-key` when present — never cookies,
  `authorization`, or a client-supplied `origin`. Task identity travels via
  the explicit `caller` (`{ userId, workspaceId }`), not headers; reads pass
  an empty `Headers`.

## Bug Fixes

| Date | Bug | Cause | Fix |
| --- | --- | --- | --- |
| 2026-09-27 | `GET /api/v1/entitlements` 500s on trialing/past_due/inactive rows | `toEntitlementStatus` accepted a stale `gracePeriod`/`expired`/`revoked` domain and threw on real persisted statuses | Accepts the billing domain; unknown → `"inactive"` |
| 2026-09-27 | `sk_` API-key task create/read 401→500/404; spoofable `origin` | Caller's full header set (incl. client `origin`) was forwarded to an in-process BFF that re-derives identity from cookies | Fresh `Headers` (server `origin` + `idempotency-key` only) + explicit `caller` argument |

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `mapBffError` treats BFF 429 `quotaExceeded` like `rateLimited` (passes through instead of 500) | Devin |
| 2026-09-27 | `mapBffError` passes BFF 429 through as `rateLimited` instead of 500 | Devin |
| 2026-09-27 | Entitlement domain realigned; task bridging switched to explicit caller + fresh headers | Devin |
| 2026-09-23 | Inline `resolveApiKey` replaced with shared `resolveApiKeyCaller` (behavior unchanged) | Devin |
