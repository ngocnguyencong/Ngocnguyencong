# apps/web/src/api-v1-runtime.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Offline tests for `apiV1Bff` (the production composition). `server-only`,
`@supastack/config` (`parseServerConfig` → fixed `app.webUrl`),
`./auth-runtime` (`database` select-chain mock keyed on the real
`@supastack/db` table objects via a thenable `where()` supporting
`.orderBy()`/`.limit()`, plus `getAuthSession`), `./ai-task-runtime`
(`productionAiTaskBff` getter), and `./api-key-auth`
(`resolveApiKeyCaller`) are all `vi.mock`ed.

## What It Covers

- Entitlement status domain: `active`/`trialing`/`past_due`/`inactive`
  rows → 200 with status preserved; unknown persisted status →
  `"inactive"` without throwing (regression for the stale-domain 500s).
- Task bridging: `create` forwards a fresh `Headers` with only
  server-derived `origin` + optional `idempotency-key` (no
  cookie/authorization/spoofed origin) plus the resolved `caller`;
  `read`/`readTaskResult` pass `caller` and drop client headers; cookie
  sessions resolve caller via `findCurrentWorkspace`.
- `mapBffError` table: BFF 400/403/404/409/429 re-envelope to matching API
  codes (`entitlementRequired`→`forbidden`, `idempotencyConflict`→`conflict`,
  `rateLimited`→`rateLimited` at 429); an unmapped 503 collapses to 500
  `internalError`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | `mapBffError` pass-through table (incl. 429 `rateLimited`) + unmapped→500 case | Devin |
| 2026-09-27 | Created | Devin |
