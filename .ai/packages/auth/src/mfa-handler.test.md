# mfa-handler.test.ts

> Last updated: 2026-10-04 | Protection: STANDARD

## Purpose

Exercise real TOTP and passkey handlers with memory persistence.

## Decisions

- Verify the mailbox through an email code, then create a password with the server-only authenticated API before enabling TOTP. No provider or physical-device calls.
- Supply an explicit allow stub for required pre-persistence mail admission;
  preserve the email-code-first and no-provider test boundary.
- The real handler preserves verified enrollment: TOTP can be enabled and
  verified, and passkey registration options are issued to the verified
  session. Anonymous option requests return 401; after the persisted owner is
  made unverified, TOTP enablement and passkey-option requests are rejected
  before new authenticator writes. A malformed registration response does not
  persist a passkey.
- A deterministic handler race pauses pending TOTP verification after it has
  read its factor, completes real email-OTP recovery, then resumes. The
  resumed request returns 403 and creates neither a new factor/session nor an
  enabled MFA flag; the separate verified-owner flow still succeeds.
- This fixture does not perform a hardware WebAuthn ceremony or claim native
  passkey cryptography coverage.
