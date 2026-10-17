# apps/web/src/oauth-state.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Signed OAuth state cookie for the connected-account connect/callback flow.
Carries everything the callback needs — PKCE verifier, CSRF `state`,
workspaceId, return path — so the flow works without a server-side session
store.

## What It Does

- `OAUTH_STATE_COOKIE = "supastack_oauth_state"`,
  `OAUTH_STATE_MAX_AGE_SECONDS = 600`, `DEFAULT_OAUTH_RETURN_TO =
  "/settings/connections"`.
- HMAC-SHA256 over the JSON payload, keyed with the auth secret; expiry is
  enforced inside the signature so a replayed or maxAge-stripped cookie
  fails closed.
- `oauthStateCookieName`/`oauthStateCookieOptions`,
  `sanitizeOAuthReturnTo`, `readCookieValue` helpers for the two routes.

## Important Notes

- `sanitizeOAuthReturnTo` pins redirects to same-site paths — no open
  redirect via `returnTo`.
- Cookie is always cleared by the callback, success or failure.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
