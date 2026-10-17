# packages/db/drizzle/0008_wonderful_lyja.sql

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Adds `connected_account` — workspace-scoped external OAuth/SMTP accounts
(`connected-accounts.ts` + `connected-account-vault.ts`).

## Important Notes

- FK `workspace_id → workspace.id` `ON DELETE cascade`.
- Unique `idx_connected_account_workspace_provider_external` on
  `(workspace_id, provider, external_account_id)` — the upsert key.
- `idx_connected_account_workspace`,
  `idx_connected_account_workspace_status`, `idx_connected_account_expiry`
  (`access_token_expires_at`) — panel listing, status filtering, and the
  `connected-account.token-sweep` refresh scan.
- Token material columns are nullable envelopes only — plaintext secrets
  never persist.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
