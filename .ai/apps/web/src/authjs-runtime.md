# apps/web/src/authjs-runtime.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Optional Auth.js runtime and social-provider identity mapping into local users and sessions.

## What It Does

- `createAuthJs({ database, earlyAccess, serverConfig })` builds the NextAuth v5 config
  (`AUTH_PROVIDER=authjs`): JWT sessions, `Credentials` backed by the same
  `account.password` hash as Better Auth, and the enabled social providers.
- `linkAuthJsSocialUser` resolves a local `user` inside a transaction. An
  existing provider-scoped `account` link (`issuer = "authjs:<provider>"`,
  `account_id = providerAccountId`) is considered only while its user is
  verified and active. The callback then re-reads that exact link and requires
  it still point to the same user, closing the recovery race where mailbox
  verification removes a stale link after the first read. Without a prior
  link, only a provider-verified, normalized email can select or create a user;
  unverified local rows and banned users are denied. Conflict-safe inserts
  re-read the unique-index winner.
- Google and Apple signed profile claims can prove their verified email;
  GitHub checks the claimed address through `/user/emails` with the OAuth
  token, a five-second timeout, and redirects disabled. Microsoft and Twitter
  profile flags alone do not prove mailbox control.
- The `signIn` callback denies unresolved social identities. The `jwt` and
  `session` callbacks reload the current user, verified state, ban state, and
  role instead of trusting stale identity claims. Only the
  `provider-account-v2` token identity version is accepted; unversioned and
  older-version identities are cleared. The app BFF session decoder enforces
  the same version and reloads the live database identity.
- Credentials require a verified, nonbanned user and use a normalized mailbox
  HMAC gate of three attempts per ten seconds, with at most 4,096 buckets.
- For a new social user, the lazy NextAuth request config reads and sanitizes
  the shared invite/referral cookies. In invite-only mode, a normalized,
  provider-verified email must have a valid matching invite, unless it is on
  `ADMIN_EMAILS`; the shared validator atomically binds an unbound,
  unredeemed, unexpired invite to that email before either user or account
  insertion. A different email loses the conditional update and is denied
  after the row is re-read; the same email can retry if insertion previously
  failed. Existing verified provider-linked or local users bypass only this
  new-user gate. Open mode accepts new users, and a valid invite may still be
  redeemed/attributed afterward.
- The user insert is identified with `RETURNING`; the shared `onCreated`
  bookkeeping runs only after the transaction commits and only when this
  inserted user won the provider link. This keeps invite/referral side effects
  from rolling back identity creation.

## Important Notes / NEVER Change

- Never key a user row from an unverified provider email. That could take over
  an existing account, reserve a future signup, or capture email-matched
  workspace invitations.
- Existing provider links do not bypass the persisted user's verified and
  active checks. Keep the second exact-link read after that check: mailbox
  recovery can delete an old provider link between the two reads.
- `account.updateAccountOnSignIn: true` in the Better Auth engine is required
  for recovery to replace deleted legacy provider links on a later sign-in.
- Credentials reject unverified or banned users before password verification.
  Better Auth's app BFF also re-reads identity state for each request.
- Better Auth's user provisioning and platform-admin guard are separate from
  this Auth.js runtime. The Auth.js social path creates its own user/account
  rows and does not yet provision a personal workspace.

## Open Threads / Resume Context

- The Auth.js social path creates `user` rows directly, so it does not run
  Better Auth's `databaseHooks.user.create` personal-workspace provisioning.
  Track a separate follow-up if Auth.js users need the same personal workspace
  as Better Auth users.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-04 | Bind an invite to the first provider-verified email before Auth.js inserts a new user | Codex |
| 2026-10-04 | Gate new Auth.js social users through shared early-access hooks; re-read active provider links to reject stale callbacks after mailbox recovery | Devin |
| 2026-09-27 | Conflict-safe social linking, safe GitHub email lookup redirects, and versioned identity claims | Devin |
| 2026-09-27 | Verified-or-denied social identity linking | Devin |
