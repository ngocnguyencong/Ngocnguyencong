# apps/web/src/connected-accounts.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Shared connected-account helpers for the settings server actions and
Connections panel — the pure (no `server-only`) layer so the same
sanitizers/validators run in unit tests, server actions, and client code
without dragging in the runtime composition.

## What It Does

- `OAUTH_CONNECTED_PROVIDERS = ["x", "google", "microsoft"]` and the
  `OAUTH_PROVIDERS` registry (`id`, display name, `envVar`) — the single
  source for panel connect buttons, env gating, and callback routing.
  `"smtp"` rows are managed separately and are not OAuth providers.
- `sanitizeConnectedAccount` — strips token material into a
  `ConnectedAccountClientRow` safe to send over the wire.
- `normalizeSmtpAccountInput`, `smtpConnectedAccountRowId`,
  `maskExternalAccountId`, `mapRefreshFailureKind`,
  `CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES`, `isOAuthConnectedProvider`.
- `CONNECTIONS_SETTINGS_PATH = "/settings/connections"`.

## Important Notes

- Rows stay `workspaceId`-scoped; sanitization never leaks vault contents.
- `OAUTH_CONNECTED_PROVIDERS` ≠ main's `github-connection.ts` — that reads
  better-auth linked login identities; this module manages standalone
  OAuth API tokens (X/Google/Microsoft).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
