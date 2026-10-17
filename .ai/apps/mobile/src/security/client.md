# src/security/client.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Account-security surface (sessions + connected accounts + data export).
Sessions/accounts hit the Better Auth server's own REST endpoints via the
mobile auth client — no `/api/mobile/*` BFF needed; the expoClient plugin
attaches the session cookie to every auth request. The data export rides
the shared cookie-authenticated `MobileApiClient` instead, because
`/api/account/export` is a plain `/api/*` route, not a Better Auth
endpoint.

## What It Does

- `createMobileSecurityActions(client, api?)` → `listSessions` (sorted
  newest first), `revokeSession(token)`, `revokeOtherSessions`,
  `listAccounts`, `unlinkAccount({providerId, accountId?})`,
  `exportAccountData()`.
- `MobileSecurityClient` is the structural seam the real better-auth
  client is cast to — responses arrive as `{data, error}` wrappers and
  are unwrapped defensively.
- `exportAccountData` GETs `/api/account/export` via the optional
  `MobileApiClient` second argument, shallow-checks the payload is a JSON
  record (shape is server-defined user data — never enumerated), and
  returns it verbatim; throws "unavailable" when constructed without an
  API client.

## Important Notes

- Password/2FA/passkey management stays web-only: mobile sign-in is
  passwordless, so those flows have no input to bind against.
- The `api` parameter is optional so older call sites that only need the
  Better Auth endpoints (e.g. the connections screen) keep working.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Added `exportAccountData` (optional `MobileApiClient` param) | Devin |
| 2026-09-28 | Created | Devin |
