# src/security/client.test.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Vitest coverage for `createMobileSecurityActions.exportAccountData`:
route/method wiring (`GET /api/account/export`), verbatim pass-through of
the export record, rejection on a non-record payload, `MobileApiError`
propagation on non-ok responses, and the "unavailable" error when no
`MobileApiClient` was provided. A stub `MobileSecurityClient` stands in
for the Better Auth client; `createMobileApiClient` runs against a fake
transport.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
