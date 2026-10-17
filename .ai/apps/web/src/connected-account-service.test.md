# apps/web/src/connected-account-service.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit coverage for `connected-account-service.ts` — connect/callback
orchestration + refresh service with injected fakes (~900 lines).

## Coverage

- `prepareOAuthConnect` — unavailable for unknown/unconfigured providers;
  authorize URL state + challenge match the signed cookie; hostile
  `returnTo` sanitized inside the signed state.
- `handleOAuthCallback` — state mismatch/missing cookie → generic error;
  cookie signed for a different actor rejected; `access_denied` →
  `denied`, other provider errors stay generic.
- Refresh service — per-provider refresh, `invalid_grant` →
  `needs_reauth`, revoke/disconnect paths, SMTP transport config.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
