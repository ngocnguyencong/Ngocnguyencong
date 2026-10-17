# apps/web/src/api-key-auth.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Reusable `sk_` bearer-key resolution, extracted from the inline
`resolveApiKey` in `api-v1-runtime.ts`. `createApiKeyResolver(deps)` is the
pure, injectable core; `resolveApiKeyCaller` is the production DB binding used
by both `apiV1Bff` and `/api/mcp`.

Semantics (unchanged from the inline version): no `Authorization` header →
`null` (cookie auth may still apply on REST); malformed or non-`sk_` bearer →
`"invalid"`; sha256-hash lookup → active/revoked/expired check → workspace
load → `lastUsedAt` touch → `{ scopes, userId, workspace }`.

## Important Notes / NEVER Change

- MCP treats `null` as unauthorized — no cookie-session fallback.
- `parseApiKeyScopes` defaults to `["read"]` for empty/invalid scope lists.
- Keep the constant-time-agnostic hash lookup; the key itself never reaches
  logs.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Extracted from api-v1-runtime; dep-injected for offline tests | Devin |
