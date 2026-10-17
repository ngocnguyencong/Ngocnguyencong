# packages/auth/src/server.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Composes Better Auth policy, the database adapter, account/session hooks, invite-only admission, and idempotent personal-workspace provisioning.

## What It Does

- `createWebAuthWithFactories` composes the same Better Auth options with an
  injected adapter and auth factory for deterministic handler tests.
  `createWebAuth` uses the Drizzle/Postgres adapter in production.
- `databaseHooks.user.create` bootstraps an allowlisted admin only when its
  email is already verified. After creation it provisions the personal
  workspace, then calls `earlyAccess.onCreated` with sanitized invite and
  referral values from the request context.
- `user.validateUserInfo` always protects an existing OAuth-linked identity:
  for `method === "oauth"` and `action === "link-account"`, it calls
  `getAuthoritativeSessionFromCtx` and requires the live session's user ID to
  equal `data.user.id`. It then reloads the local owner for every OAuth action
  except `create-user` and rejects missing, unverified, or banned users. These
  checks remain active when invite-only mode is disabled. Separately, invite-only mode
  installs the `create-user` gate; configured admin emails and admin-method
  creation bypass that new-user gate. Ordinary create-user requests must have
  `emailVerified === true` before the gate reads or binds an invite.
- Successful `/sign-in/email-otp` sessions receive a one-use first-password
  proof. Its verification record is bound to the exact session and user and
  expires after 15 minutes. `/set-password` consumes it before creating the
  first credential; magic-link/OAuth sessions, replays, expiry, and a different
  session cannot authorize that write.
- Before an unverified legacy mailbox becomes verified through email-code or
  magic-link recovery, hooks remove its old credentials, provider links, and
  sessions. The email-OTP password-reset path is distinct: Better Auth first
  consumes a matching mailbox code, the existing credential is retained only
  for replacement, other provider links and old sessions are removed.
- The adapter boundary then re-reads the promotion target from the actual
  update predicate. For an unverified owner it deletes passkey/two-factor rows,
  invokes the injected API-key revoker when configured, and writes
  `twoFactorEnabled: false` with `emailVerified: true`. This covers the
  magic-link verifier's id-only update, whose hook projection omits the user
  ID. Verified owners bypass cleanup, while lookup or cleanup errors stop the
  promotion.
- Before a passkey authentication can create a session, a session hook
  re-reads the owner as verified and nonbanned and confirms the exact persisted
  `credentialID` and `userId`. Removed or foreign credentials cannot create a
  session from a cached passkey.
- Native two-factor hooks re-read the persisted verified, nonbanned owner and
  exact unexpired session before setting the TOTP-enabled flag or minting a
  replacement session; session creation also requires the current persisted
  two-factor row. The `/link-social` account-create hook applies the same live
  owner/session check before linking an account, while ordinary provider
  callback account creation without a linking session remains unaffected.
- Verified pending `ADMIN_EMAILS` users are promoted after mailbox
  verification. Credential create/update hooks independently require verified
  mailbox proof, with matching email-OTP reset and ordinary verified password
  change/reset as the supported paths.

## Important Notes / NEVER Change

- `account.updateAccountOnSignIn: true` in the option factory lets a later
  sign-in recreate a provider link removed during mailbox recovery.
- Keep email proof bound to the precise Better Auth session and user; consume
  it once and check its expiry. The `/set-password` action has a second account
  persistence guard.
- Provider callbacks cannot activate an unverified local row by matching an
  email claim. Keep the OAuth owner check separate from the invite-only
  `create-user` gate.
- Invite validation atomically binds a null-email code to the normalized,
  already-proven mailbox using unredeemed and unexpired predicates. The same
  mailbox may retry after a failed user insert; a different mailbox fails.
  Keep code redemption in the post-create hook.
- Treat hook context as untrusted dynamic input and narrow each field before
  adapter lookup. Missing adapter methods or an unresolved owner fail closed.
- Keep the mailbox-promotion adapter wrapper around both adapter factories and
  transaction callbacks so Drizzle and Firestore adapter updates receive the
  same cleanup. The optional `revokeUserApiKeys` callback is wired by the Supa
  web composition; its errors propagate before the user update.
- The early-access package owns gate policy but not cookie literals. The web
  composition injects cookie names, sanitization, database validation, and
  post-create bookkeeping.

## Open Threads / Resume Context

- Real memory-adapter handler tests cover a stale `/link-social` idToken link
  racing with mailbox recovery (417, no provider link) and a stale normal OAuth
  callback (`SESSION_REVOKED`, no link); active verified linking succeeds in
  both paths. The callback code exchange and provider identity are local mocks
  with a matching email under `allowDifferentEmails: false`; these tests pin
  lifecycle behavior, not a live-provider or general takeover claim.
- Real PostgreSQL and transactional-mail-provider smoke checks remain
  environment-dependent. The local memory-adapter regression exercises the
  cached OAuth recovery interleaving, verified-provider control, promotion
  cleanup, and stale passkey-session rejection. Hardware WebAuthn ceremonies
  are not exercised.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-04 | Require mailbox proof before atomically binding an invite to the signup email | Codex |
| 2026-10-04 | Require active persisted OAuth owners, bind first-password setup to an emailed OTP session, and harden mailbox recovery | Codex |
| 2026-10-04 | Clear stale authenticators and API keys before mailbox activation; reject stale passkey session creation | Codex |
| 2026-10-04 | Recheck persisted owner/session/factor before TOTP state, replacement-session, and social-link writes | Codex |
| 2026-09-22 | Add the `earlyAccess` injection seam and invite-only gate | Devin |
