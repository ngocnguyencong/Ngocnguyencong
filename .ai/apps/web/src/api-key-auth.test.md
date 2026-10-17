# apps/web/src/api-key-auth.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Unit tests for `createApiKeyResolver` (5 tests): null without Authorization;
malformed/non-`sk_` → invalid; hash lookup + workspace load + `lastUsedAt`
touch on active keys; unknown/revoked/expired → invalid; missing workspace →
invalid. `server-only`, `auth-runtime`, and `@supastack/db` are `vi.mock`ed so
the suite is fully offline.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created | Devin |
