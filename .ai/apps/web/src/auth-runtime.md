# apps/web/src/auth-runtime.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Server-only composition root for the shared database, Better Auth, optional Auth.js, and the BFF session resolver.

## What It Does

- Builds Better Auth with the shared `database`, `earlyAccess` policy,
  transactional email adapters, mail admission callback, dynamic trusted
  origins, and parsed server configuration.
- The early-access hooks expose the invite/referral cookie names and sanitize
  cookie values. During invite-only admission, the shared validator normalizes
  the already-proven mailbox and atomically binds an unbound, unredeemed,
  unexpired code before user creation. A losing concurrent claim re-reads the
  row and fails closed; the same mailbox can retry a failed create while
  another mailbox cannot use that code. `handleEarlyAccessUserCreated` still
  redeems and attributes after account creation. A redeemed invite is audited
  through a lazy import to avoid a static `auth-runtime`/`audit-runtime` cycle.
  Post-create bookkeeping errors are logged with only the user ID and error
  message and do not undo account creation.
- Loads Auth.js only when `AUTH_PROVIDER=authjs`; the default Better Auth
  runtime does not import NextAuth. Both engines share the `user` table.
- Passes the same `EarlyAccessHooks` instance to Better Auth and Auth.js. The
  Auth.js lazy request config sanitizes invite/referral cookie values before
  it closes over them for the social callback. When invite-only is enabled, a
  new social user needs a valid invite for the normalized provider-verified
  email or an `ADMIN_EMAILS` address. Existing verified local/linked users
  bypass only this new-user gate; open mode accepts new users and may still
  run invite/referral bookkeeping after creation.
- Auth.js calls `onCreated` only after its user/account transaction commits
  and only when the inserted user won the provider link. The shared hook
  handles invite/referral effects and audit logging without rolling back the
  committed identity.
- Auth.js app sessions are decoded only for the current
  `provider-account-v2` identity version. The current database row is checked
  for email verification and ban state on each BFF request.
- Creates `createAuthRecoveryApiKeyRevoker(database)` and forwards it through
  `createWebAuthServer` to the Better Auth mailbox-promotion adapter wrapper.
  Active keys for the recovering user are revoked before an unverified owner
  is promoted; any revoker error propagates and prevents that update.

## Important Notes / NEVER Change

- Keep provider credentials and session identity server-side. The early-access
  error log must not contain invite codes, referral values, or cookies.
- Better Auth checks `emailVerified === true` before calling the invite
  validator; Auth.js requires a provider-verified email before new-user
  admission. Preserve this ordering so an unproven mailbox cannot claim an
  invite.
- The bind uses the existing nullable `early_access_code.email` column and a
  conditional update; it adds no lease or schema migration. Redemption remains
  a separate post-create operation.
- `EarlyAccessHooks` remain the shared source of cookie names, sanitization,
  code validation, and post-create handling for both authentication engines.
  Preserve lazy Auth.js request-cookie access and post-commit callback timing.
- Keep the recovery API-key callback Supa-only. It runs after persisted-owner
  lookup and factor deletion but before `emailVerified` is written. The native
  passkey/two-factor hooks require a verified, nonbanned session; API-key
  creation has a separate persisted-session guard in the app session layer.
- The shared auth package now rechecks the owner/session before TOTP session
  creation and `/link-social` account creation. Its deterministic hook tests
  cover both boundaries, and the real handler suite pins the TOTP recovery
  interleaving plus stale `/link-social` and normal OAuth callback races. For
  the callback path, `user.validateUserInfo` requires the authoritative session
  user ID to match the account-link target; verified active linking remains
  allowed. Provider exchange and identity are local test fixtures.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-04 | Bind invite-only codes to the verified mailbox before user creation for both auth engines | Codex |
| 2026-10-04 | Share the injected early-access policy with Auth.js social signup and run post-create effects after commit | Devin |
| 2026-10-04 | Revoke active API keys before unverified mailbox promotion | Codex |
| 2026-09-22 | Add `earlyAccess` injection from the growth module | Devin |
