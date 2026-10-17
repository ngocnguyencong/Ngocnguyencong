# src/entitlement-check.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Pure, dependency-free entitlement predicate — answers "does this
workspace hold key X right now" over plain `EntitlementRecord` rows. No
React or DB imports, so server components and domain logic share the
same check.

## What It Does

- `hasActiveEntitlement(entitlements, key, now = new Date())` returns
  `true` when some row matches `key` by exact equality, carries status
  `"active"` or `"trialing"`, and is unexpired (`expiresAt === null` or
  later than `now`). `now` is injectable so tests stay deterministic.

## Public API

- `EntitlementRecord` — `{ key: string; status: string; expiresAt: Date | null }`
  (readonly); the selection shape `listWorkspaceEntitlements` returns.
- `hasActiveEntitlement` — the shared boolean check.

## Dependencies

- None (pure TS). Consumers: `entitlement-gate.tsx` (paywall gate),
  `content-access.ts` (`isContentLocked` for gated CMS rows);
  `./entitlements` re-imports `EntitlementRecord`.
- Tests: `entitlement-gate.test.ts` covers this predicate (not the
  component).

## Important Notes

- Status vocabulary is the ledger's — only `active`/`trialing` grant;
  `past_due`, `inactive`, or unknown statuses never do.
- Key matching is exact string equality; normalization happens where
  keys enter the system (`normalizeEntitlementKey` in `./content` for
  CMS `required_entitlement` input, the billing ledger for grants), not
  inside this check.
- Keep it pure — DB/session access lives in `./entitlements`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | Mirror created — file predates the `.ai` convention (referenced by entitlement-gate/entitlements mirrors) | Devin |
