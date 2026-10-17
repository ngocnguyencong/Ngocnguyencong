# apps/web/app/api/accounts/[provider]/callback/route.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Completes the OAuth connect flow: verifies the signed state cookie
against the echoed `state` param, exchanges the code, stores the
encrypted token envelope, and redirects back to the page that started
the flow.

## Important Notes

- `runtime = "nodejs"`; state cookie is always cleared — success or
  failure.
- Failures surface only as `?status=` values; token material is stored
  through the repository + AES-256-GCM vault, never returned to the
  client.
- `DEFAULT_OAUTH_RETURN_TO = "/settings/connections"`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
