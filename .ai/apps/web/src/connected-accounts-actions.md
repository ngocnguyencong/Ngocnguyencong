# apps/web/src/connected-accounts-actions.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`"use server"` actions backing Settings → Connections: list, disconnect,
refresh, and SMTP save for the workspace's connected accounts.

## What It Does

- `listConnectedAccountsAction` — sanitized rows for the panel.
- `disconnectConnectedAccountAction` / `refreshConnectedAccountAction` —
  member-gated mutations delegating to the runtime service, then
  `revalidatePath(CONNECTIONS_SETTINGS_PATH)`.
- `saveSmtpAccountAction` / `saveSmtpAccountFormAction` — SMTP connected
  account upsert (`normalizeSmtpAccountInput`), used by the SMTP transport
  card.

## Important Notes

- Every action re-checks session + active-workspace membership — the
  actions are the auth boundary, not the panel.
- Errors surface as `ConnectedAccountActionErrorKind` values mapped to
  copy keys; provider detail never crosses the wire.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
