# packages/auth/src/oauth-providers.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Coverage for `oauth-providers.ts` — the X/Google/Microsoft connected-account adapters.

## Coverage

- `generatePkce` — base64url state/verifier + S256 challenge; matches the
  RFC 7636 appendix-B vector; fresh values per call.
- `getOAuthAdapter` — exposes x/google/microsoft; null for unknown ids.
- `buildAuthorizeRequest` — scope, redirect, state/challenge wiring per
  provider; error paths keep static messages + status only.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
