# apps/web/src/authjs-runtime.test.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Regression tests for Auth.js social identity resolution, invite-only admission,
live session identity, and verified credentials.

## Test Seams

- `next-auth` is mocked to return its config argument. Because production uses
  NextAuth's lazy request-config form, `authConfig` invokes that callback with
  a request stub whose cookie getter supplies sanitized invite/referral test
  values.
- `fakeDatabase` runs transactions against read-your-writes row stores.
  Configured uniqueness conflicts skip inserts so tests can model a concurrent
  winner becoming visible on a later `findFirst`.
- Social identity, mail, provider fetch, and persistence are local fixtures;
  no live database, OAuth provider, or mail sender is contacted.

## Coverage

- Social linking rejects unverified/missing email claims and legacy unverified
  or banned owners. Verified local owners can be linked, while an existing
  active provider link remains tied to its provider account even if the email
  claim changes.
- A deterministic mailbox-recovery interleaving deletes a stale provider link
  after its first read and verifies the legacy user. The callback now denies
  that stale link when it re-reads the exact issuer/account pair.
- New verified identities create a verified local user and provider link;
  `ADMIN_EMAILS` users receive the admin role. Account-link and email uniqueness
  races adopt the committed winner, while a missing winner on re-read throws.
- Callback tests cover credentials sign-in without social lookup, provider
  verification requirements, GitHub `/user/emails` fallback with redirects
  disabled, and denial of a Microsoft profile flag as mailbox proof.
- Invite-only admission denies missing cookies, a missing validator, invalid
  invite results, and email mismatches before inserting rows. A matching invite
  is checked against the normalized provider-verified email. Verified existing
  users bypass only the new-user gate, `ADMIN_EMAILS` is exempt, and open mode
  accepts new social users without an invite. The shared early-access suite
  covers competing emails and same-email retry; the GrowthStore suite pins the
  conditional SQL predicate. These local tests do not claim live Postgres
  concurrency coverage.
- For a newly inserted user that wins the provider-account link, the shared
  `onCreated` hook receives the sanitized invite/referral values after the
  database transaction resolves. Open mode also invokes the hook with null
  values when no cookies are supplied.
- JWT/session callbacks propagate the resolved user ID, reject unversioned or
  malformed identities, refresh live role/ban/verification state, and clear
  revoked identities. Credential cases cover verified, unverified, and banned
  owners plus the normalized-recipient attempt limit.

## Open Threads / Resume Context

- The Auth.js social path writes user rows directly and does not run Better
  Auth's personal-workspace provisioning hook; track separately if it should
  provide the same workspace behavior.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-04 | Cover atomic shared invite binding, lazy request config, admission and post-commit hooks, plus stale provider-link recovery | Codex |
| 2026-09-27 | Pin account/email conflict winners, safe GitHub email lookup, and legacy-token stripping | Devin |
| 2026-09-27 | Add verified-or-denied social identity regression suite | Devin |
