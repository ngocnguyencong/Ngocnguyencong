# apps/web/src/connected-accounts-runtime.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Server-only composition root for connected accounts: binds
`createConnectedAccountService`/`prepareOAuthConnect`/`handleOAuthCallback`
to the real drizzle repository, AES-256-GCM vault, audit, notification,
and observability singletons.

## What It Does

- `createDrizzleConnectedAccountRepository` + `createConnectedAccountVault`
  from `@supastack/db` (`CREDENTIAL_ENCRYPTION_KEY`-backed envelope).
- Exposes the runtime singletons consumed by the `/api/accounts/[provider]`
  routes and the settings server actions.
- `ConnectedAccountRefreshResult` / `ConnectedAccountService` types
  re-exported for action/panel callers.

## Important Notes

- `server-only` import boundary — never import from client code; the pure
  surface for shared helpers is `connected-accounts.ts`.
- Provider enablement comes from `serverConfig.connectedAccounts[provider]`
  (id+secret present → enabled; X tolerates a public client).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
