# apps/web/src/account-actions.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Server actions for the signed-in user's account: listing and revoking sessions,
and deleting the account together with its personal workspaces.

## Important Notes

- Session revocation accepts an opaque session ID from the client. Resolve it
  against Better Auth's session list for the current request, and keep the
  matching bearer token on the server for the revoke call only. The custom
  settings session rows and forms carry no bearer token.
- Account deletion uses one database transaction. It locks the user `FOR NO
  KEY UPDATE`, inventories memberships, acquires shared
  `workspace-seats:<id>` advisory locks in sorted order, then upgrades the user
  lock to `FOR UPDATE` and rereads memberships and organization owner counts.
  If a workspace appears outside the first inventory, the transaction rolls
  back and retries from scratch up to three attempts; exhaustion fails closed
  with a retry status. It never acquires a newly discovered workspace lock
  while holding the stronger user lock.
- Personal workspace deletion and user deletion happen inside the same
  transaction so owner locks remain held through cascades. The best-effort
  audit event is written after commit with a null actor ID because the actor
  user has already been deleted.
- A sole organization owner cannot delete their account. Personal workspaces
  are removed with the account; related rows cascade by foreign key.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-04 | Submit opaque session IDs, resolve revoke tokens server-side, and serialize self-deletion with workspace locks and snapshot retries | Codex |
