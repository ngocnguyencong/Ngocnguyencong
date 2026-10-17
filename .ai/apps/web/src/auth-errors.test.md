# apps/web/src/auth-errors.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Unit tests for `authErrorMessage`: every code family maps to its
`auth.errors` key, HTTP 429 maps by status, unknown codes/messages/null
fall back to `generic`, and the raw server message never appears in the
result. Uses `getDictionary("en").auth.errors` as the copy fixture.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created | Devin |
