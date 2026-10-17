# src/content-queries.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Server-only public read boundary for the workspace CMS — product surfaces
(blog/report pages) render published entries through
`listPublishedContentEntries`. `import "server-only"` keeps it off client
bundles AND off the RPC surface.

## Behavior

- `listPublishedContentEntries({workspaceId, type?, locale?, viewerEntitlements?})`
  — explicit workspaceId, no session; published entries are deliberately
  public **metadata**, ordered by `publishedAt` desc (limit 500). Explicit
  `.select({...})` column projection; the `status="published"` WHERE pin is
  re-narrowed onto `ContentEntryStatus` in the map.
- Returns `readonly PublishedContentEntry[]` (`ContentEntryRow & {locked}`)
  via `applyContentAccess`: rows gated on an entitlement the viewer lacks
  come back `locked: true` with `body: ""` — locked bodies never reach the
  wire. Omitting `viewerEntitlements` treats every gated entry as locked.
- `viewerEntitlements` is TRUSTED input: callers resolve it themselves
  (typically `listViewerEntitlements` from `./entitlements`).

## Important Notes / NEVER Change

- This function was moved OUT of `content-actions.ts` because `"use server"`
  modules turn every export into a public POST endpoint — a caller-supplied
  `viewerEntitlements` there lets any client POST forged grants and receive
  unlocked bodies. **Never accept trust-bearing params (entitlements, roles,
  session claims) on a `"use server"` export** — resolve them server-side or
  keep the function in a `server-only` module. Do not re-export
  `listPublishedContentEntries` from `content-actions.ts` (that re-exposes
  it as an RPC). `content.test.ts`'s "content access boundary contract"
  pins both sides.

## Dependencies

- `./auth-runtime` — `database`.
- `./content-access` — `applyContentAccess` (body-stripping projection).
- `./entitlement-check` — `EntitlementRecord` type for the viewer param.
- `./content-actions` — type-only `ContentEntryRow` (erased at compile time;
  no runtime pull of the action module).
- `@supastack/db` — `contentEntry`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | Created — `listPublishedContentEntries` + `PublishedContentEntry` moved out of the `"use server"` actions module to close the forgeable-`viewerEntitlements` RPC hole | Devin |
