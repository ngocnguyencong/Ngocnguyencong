# app/api/mobile/content/[entryId]/route.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Per-entry read + mutations for the mobile CMS surface — reuses
`listContentEntries`, `updateContentEntryAction`,
`setContentEntryStatusAction`, `deleteContentEntryAction` from
`src/content-actions.ts`.

## What It Does

- `GET` — one entry WITH `body` (the collection list omits it): the
  prefill source for the mobile editor, required because PATCH is a
  full-form replace that would otherwise wipe the stored body.
  `listContentEntries`' internal writer gate maps to 401/403; unknown
  id → 404 `{error}`.
- `PATCH` — composable JSON contract:
  - field keys `body|excerpt|locale|requiredEntitlement|slug|title|type`
    (strings) → `updateContentEntryAction` (full-form replace: `type` +
    `title` required server-side, blank `slug` re-derives);
  - `status` ∈ `draft|published|archived` → `setContentEntryStatusAction`
    via a route-built `FormData{entryId,status}` (lifecycle is free both
    directions; unchanged status is a silent no-op in the action).
  - Both may combine (fields first, then status). Update `{ok:false}` →
    422 and skips the status leg; unknown status → 400; neither → 400.
- `DELETE` → `deleteContentEntryAction` via FormData (idempotent — a
  missing row is a no-op delete + audit row), 200 `{ok:true}`.
- `requireWorkspaceWriter` runs first (401/403) so unauthenticated
  requests never consume the body; JSON bounded at 1 MiB.

## Dependencies

- `src/content-actions.ts`, `src/content.ts` (`isContentEntryStatus`),
  `src/request-body.ts`, `src/workspace-access.ts`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | `GET` now uses dedicated `getContentEntry(entryId)` — single-row workspace-scoped query, no full-list body scan | Devin |
| 2026-10-13 | += `GET` single entry with `body` (mobile editor prefill) | Devin |
| 2026-10-12 | Created | Devin |
