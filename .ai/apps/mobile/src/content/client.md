# apps/mobile/src/content/client.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Typed mobile client for `/api/mobile/content` — the workspace CMS entry
list plus create/update/status/delete mutations shown on the Content
screen.

## What It Does

- `createMobileContentActions(api)` over the shared `MobileApiClient`:
  - `list()` → `{entries, writable}` — validates each row (`id`, `title`,
    `type`, `slug`, `status` ∈ `CONTENT_ENTRY_STATUSES`, ISO
    `createdAt`/`updatedAt`, nullable `publishedAt`/`excerpt`/`locale`/
    `requiredEntitlement`); malformed rows are dropped rather than
    guessed, structural failures throw. The list payload omits `body`
    — entry bodies stay server-side since the screen never renders them.
  - `get(entryId)` → `ContentEntryDetail` (GET) — the list row plus
    `body`; the edit form's prefill source since `update` is a
    full-form replace (a PATCH without `body` would wipe it).
  - `create(fields)` → `{entryId}` (POST).
  - `update(entryId, fields)` (PATCH fields — full-form replace:
    `type` + `title` required server-side).
  - `setStatus(entryId, status)` (PATCH `{status}`), `remove(entryId)`
    (DELETE).
- Exports `CONTENT_ENTRY_STATUSES` (`draft|published|archived`),
  `ContentEntryStatus`, `ContentEntry`, `ContentEntryDetail`,
  `ContentEntryFields` — mirrors `apps/web/src/content.ts`, keep in
  sync. The `body` key is validated while the value is still a generic
  record — `isContentEntry` narrows it away.

## Dependencies

- `src/api/client.ts` — `MobileApiClient` (cookie auth + JSON envelope).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | += `get(entryId)` + `ContentEntryDetail` (body-bearing single-entry read for the edit form) | Devin |
| 2026-10-12 | Created | Devin |
