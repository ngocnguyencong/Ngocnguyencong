# packages/auth/src/oauth-providers.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

OAuth2 + PKCE provider adapters for connected external accounts
(Settings → Connections). Distinct from sign-in social providers: they
request API scopes (`tweet.read`, `gmail.send`, `Mail.Send`) whose
refreshable tokens are stored per workspace.

## What It Does

- X, Google, Microsoft adapters: authorize-URL builder + code exchange +
  refresh, driven by `OAUTH_PROVIDERS` config on the web side.
- Security rules enforced here:
  - every request carries a 10s `AbortSignal` timeout;
  - error paths never surface response bodies (they can contain tokens or
    provider detail) — only static messages + HTTP status;
  - `invalid_grant` maps to a dedicated error kind so callers mark the
    account `needs_reauth` instead of retrying.

## Important Notes

- Enablement comes from `serverConfig.connectedAccounts` —
  `CONNECTED_{X,GOOGLE,MICROSOFT}_CLIENT_ID/SECRET`; X may run as a
  public client without secret.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
