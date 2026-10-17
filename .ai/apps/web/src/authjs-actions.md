# apps/web/src/authjs-actions.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Server actions for the Auth.js engine (`AUTH_PROVIDER=authjs`):
`authJsCredentialsSignIn` (email + password via `authjs.signIn`),
`authJsSocialSignIn` (provider redirect), `authJsSignOut`.

## Important Notes / NEVER Change

- `AuthJsSignInState.error` is a machine `AuthJsErrorCode`
  (`ENGINE_DISABLED` / `MISSING_FIELDS` / `INVALID_CREDENTIALS`), never a
  display string — the client maps it through `authErrorMessage` to a
  localized toast. Do not return raw or pre-rendered messages.
- The `authjs === null` guard means the engine is disabled for the
  deployment; `authJsSocialSignIn`/`authJsSignOut` throw or no-op there.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | `error` strings replaced by `AuthJsErrorCode` codes for client-side localization (T3) | Devin |
