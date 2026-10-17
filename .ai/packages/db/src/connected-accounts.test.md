# packages/db/src/connected-accounts.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Schema + vault contract tests for `connected-accounts.ts` /
`connected-account-vault.ts`.

## Coverage

- `connected_account` schema — workspace-scoped table; token material only
  as a nullable encrypted envelope; `(workspace,provider,external)`
  uniqueness.
- Token vault — round-trips access+refresh envelopes; access-token-only
  envelopes (refresh/smtp optional); SMTP transport config alongside the
  password.
- IMAP vault regression coverage pins encrypted host/auth round trips,
  compatibility for older SMTP-only payloads, and rejection of malformed
  IMAP values or IMAP auth without an explicit host.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
