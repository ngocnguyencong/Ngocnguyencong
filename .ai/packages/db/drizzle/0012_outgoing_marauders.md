# packages/db/drizzle/0012_outgoing_marauders.sql

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Adds `content_entry.required_entitlement` — the tier-gate column for the
workspace CMS.

## Important Notes

- Single `ALTER TABLE … ADD COLUMN "required_entitlement" varchar(100)` —
  nullable, no default, no index (lookups are per-row, not filtered).
- NULL = free for every reader; a value names the minimum subscription tier
  (e.g. "pro") the viewer's workspace must hold to read `body`. Enforcement
  is application-side in `listPublishedContentEntries` — the column itself
  carries no FK to `entitlement.key` (keys are product-defined).
- Key alphabet is validated on write (`normalizeEntitlementKey` in
  `apps/web/src/content.ts`): 1–100 lowercase letters/digits/dash/underscore.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Created for tier-gated CMS entries | Devin |
