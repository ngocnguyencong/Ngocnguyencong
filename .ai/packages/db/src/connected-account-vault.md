# packages/db/src/connected-account-vault.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

AES-256-GCM token envelope for connected external accounts
(`createConnectedAccountVault`): encrypts/decrypts OAuth token sets into
the `connected_account` rows' envelope columns.

## Important Notes

- Mirrors the crypto in `packages/ai/src/key-vault.ts` (~60 lines)
  because `@supastack/db` has no dependency on `@supastack/ai`. **Keep the
  two in sync**: same `aes-256-gcm` algorithm, 12-byte IVs, base64
  envelope fields, JSON AAD.
- `ENVELOPE_VERSION = 1`; master key is the same 32-byte base64
  `CREDENTIAL_ENCRYPTION_KEY` used by the AI key vault.
- `ConnectedAccountTokenEnvelope` / `ConnectedAccountTokenSet` types live
  here — consumers only ever see the envelope or nothing.
- Optional IMAP receive credentials are also encrypted: `imapHost`,
  `imapUser`, and `imapPassword`. IMAP uses implicit TLS on fixed port 993.
  The host is explicit and never inferred from SMTP. When an explicit IMAP
  host exists, omitted IMAP auth overrides may intentionally fall back to
  SMTP username/password at runtime.
- IMAP host/user are bounded nonblank strings (255 chars max); a supplied
  password is non-empty and at most 255 chars. Older envelopes remain
  compatible and malformed present fields are rejected.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
