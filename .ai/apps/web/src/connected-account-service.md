# apps/web/src/connected-account-service.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Connected-account domain logic: OAuth connect/callback orchestration plus
the token-refresh service. Pure and dependency-injected —
`connected-accounts-runtime.ts` binds it to the real database, vault,
audit, notification, and observability singletons; tests supply fakes.

## What It Does

- `prepareOAuthConnect` — membership check → PKCE verifier + CSRF state +
  authorize URL for the connect route.
- `handleOAuthCallback` — validates the echoed state, exchanges the code,
  stores the AES-256-GCM token envelope via the repository + vault.
- `createConnectedAccountService` — refresh/disconnect flows:
  provider-specific token refresh (X/Google/Microsoft via
  `@supastack/auth` adapters), `invalid_grant` → `needs_reauth`,
  `smtpExternalAccountId` helper.

## Important Notes

- Token material only ever lives inside the injected vault/repository
  boundary — the service returns sanitized results, never raw secrets.
- Refresh failures are kinded (`mapRefreshFailureKind`) so the panel can
  show a generic message without leaking provider detail.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
