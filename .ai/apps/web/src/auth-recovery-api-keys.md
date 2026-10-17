# apps/web/src/auth-recovery-api-keys.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Revoke workspace API keys created by an unverified identity before mailbox recovery activates it. The callback is injected into shared auth composition.

## Important Notes / NEVER Change

- Select only key IDs and workspace IDs for the recovering user; never read plaintext credentials.
- Each update must match the trusted user, key ID and workspace ID and preserve an existing revocation timestamp.
- A database failure must reject recovery before activation. Already verified owners do not invoke this callback.

## Validation

Three deterministic tests pass: inspect actual SQL predicates across multiple workspaces, avoid mutations when no active keys belong to the user, and propagate update failures. Each mutation checks key ID, trusted user and workspace plus an unset revocation timestamp. The full suite also passes; no live database integration was run.
