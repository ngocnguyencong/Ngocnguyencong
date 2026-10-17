# packages/db/src/connected-accounts.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Drizzle repository + row types for `connected_account` (migration 0008) —
the workspace-scoped store for externally-connected OAuth/SMTP accounts.

## What It Does

- `ConnectedAccountStatus = "active" | "needs_reauth" | "revoked"`.
- `ConnectedAccountProvider = "google" | "microsoft" | "smtp" | "x" |
  (string & {})` — varchar column, so new providers need no migration;
  the union keeps autocomplete.
- `createDrizzleConnectedAccountRepository(db)` — CRUD, upsert on the
  `(workspaceId, provider, externalAccountId)` unique index, token
  envelope write via `connected-account-vault`, expiry/status queries for
  the refresh sweep.

## Important Notes

- Unique index `idx_connected_account_workspace_provider_external` +
  `workspace`/`workspace,status`/`access_token_expires_at` indexes —
  cascade-deletes with the workspace.
- Tokens only persist as envelopes — the repository never returns
  plaintext secrets.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
