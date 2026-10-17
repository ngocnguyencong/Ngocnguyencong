# apps/web/src/connected-accounts.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit coverage for `connected-accounts.ts` — the shared pure helpers.

## Coverage

- `maskExternalAccountId` — masks email-shaped local parts, masks the
  email inside `smtp host:user` identities, leaves non-email ids
  untouched, keeps astral first chars intact (lone surrogate must not
  leak).
- `OAUTH_PROVIDERS` — covers every OAuth connected provider id.
- `isValidSmtpHost`, `normalizeSmtpAccountInput`,
  `sanitizeConnectedAccount`, `isOAuthConnectedProvider`,
  `mapRefreshFailureKind`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
