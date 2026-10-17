# apps/web/src/oauth-state.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit coverage for `oauth-state.ts` — the signed OAuth state cookie.

## Coverage

- `signOAuthState`/`verifyOAuthState` — round-trip; rejects tampered
  payload + wrong secret; rejects expired and future-issued states;
  rejects malformed values/provider mismatches.
- `sanitizeOAuthReturnTo` — same-site paths only, open-redirect inputs
  fall back to the default.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
