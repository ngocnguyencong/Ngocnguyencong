# src/content-access.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Pure per-reader projection for CMS entries — decides which published rows
are locked for the current viewer and strips locked bodies before they can
reach the wire. No DB, no React, no session logic; the caller supplies the
viewer's entitlement rows.

## Public API

- `isContentLocked(requiredEntitlement, viewerEntitlements, now?)` — `false`
  when `requiredEntitlement === null` (free entry); otherwise delegates to
  `hasActiveEntitlement` (key match + `active|trialing` + `expiresAt`
  null-or-future).
- `applyContentAccess(rows, viewerEntitlements, now?)` — maps each row to
  `{...row, body: locked ? "" : row.body, locked}`. Works on any
  `{ body, requiredEntitlement }` row shape (generic `Row`), so both the
  public list boundary and future surfaces can reuse it.

## Important Notes

- The security contract: locked rows keep teaser metadata (title, excerpt,
  `requiredEntitlement`, `locked: true`) but `body` is `""` — the server
  never ships gated bodies. Render `locked`/`excerpt` for the paywall state
  instead of attempting to read `body`.
- `now` is injectable for deterministic tests; production callers use the
  default `new Date()`.

## Dependencies

- `./entitlement-check` — `hasActiveEntitlement`, `EntitlementRecord`.
- Consumers: `content-queries.ts` (`listPublishedContentEntries`),
  `content-access.test.ts`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | Consumer moved to `content-queries.ts` (public read left the `"use server"` module) | Devin |
| 2026-09-27 | Created for tier-gated CMS entries | Devin |
