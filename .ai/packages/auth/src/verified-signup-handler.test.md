# verified-signup-handler.test.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Exercise real Better Auth endpoints with the memory adapter and captured mail to
prove mailbox ownership precedes account privileges and password creation.

## Coverage

- A cached OAuth callback racing with mailbox recovery cannot retain a session
  through its old linked account. The memory-adapter test pauses session
  creation deterministically; a fresh, verified provider identity can still
  sign in after recovery.
- Real handler races cover both social-link paths: a paused `/link-social`
  idToken request resumes after verified mailbox recovery, returns 417, and
  leaves no Google account link; a normal OAuth callback with its revoked
  initiating session redirects with `SESSION_REVOKED` and also leaves no link.
  A verified active session can complete each linking flow.
- Direct password signup creates no user, credential, session, or workspace.
  Password attempts are limited per normalized mailbox across client IPs.
- A sixth OTP or magic-link send is rejected before replacing the last usable
  code. The two email-OTP reset request routes also reject a resend before
  replacing the code, and the first delivered reset code remains usable. With
  Turnstile configured, both core reset aliases return 400 before mail when
  CAPTCHA is missing; a successful local CAPTCHA mock allows each alias to
  issue one reset message.
- Only successful email-OTP sign-in issues first-password proof. It is tied to
  the exact user and session, expires after 15 minutes, and is consumed once.
  A second magic-link session cannot borrow the OTP session's still-live proof;
  replay and expired proof also fail. The handler separately rejects wrong or
  expired mailbox codes.
- Allowlisted admin identity is granted only after mailbox verification;
  tests cover new and pending admin accounts and reject an unverified legacy
  session at the admin API.
- OTP sign-in, email verification, and magic-link recovery revoke legacy
  unverified credentials and sessions. A password reset preserves the existing
  credential until the matching email-bound code is consumed, then replaces
  it and revokes old sessions.
- The magic-link recovery case seeds legacy TOTP/passkey state and verifies
  both are removed and `twoFactorEnabled` is cleared before the id-only user
  promotion; its old credential and sessions are also invalidated. Adapter
  tests separately prove cleanup ordering, error propagation, verified-owner
  preservation, and the Supa API-key callback. OTP reset still requires the
  matching email code and replaces only the existing credential.
- Request-level enrollment rejection is exercised in `mfa-handler.test.ts`;
  this suite does not perform a hardware WebAuthn ceremony.
- OAuth and email delivery are local fixtures; no live database, mail service,
  or OAuth provider is contacted.
- The Google code exchange and idToken identity are mocked, with the provider
  email matching the verified local owner under `allowDifferentEmails: false`.
  These regressions exercise callback/session lifecycle, not a live provider or
  a general provider-takeover claim.
