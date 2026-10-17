# apps/web/app/api/accounts/[provider]/connect/route.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Starts the OAuth connect flow for a connected account: verifies
membership, issues the signed PKCE state cookie (`oauth-state.ts`), and
302s to the provider authorize URL.

## Important Notes

- `runtime = "nodejs"`; `serverConfig = parseServerConfig()` at module
  scope — provider availability is env-driven.
- Unavailable/disabled providers redirect back with a generic `?status=`
  value — never an error page carrying provider detail.
- `sanitizeOAuthReturnTo` pins the post-callback destination to same-site
  paths.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
