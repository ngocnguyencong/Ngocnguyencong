# app/(app)/content.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Content (CMS) screen — lists the active workspace's entries (title,
`/{type}/{slug}` path, updated date, status badge) and, for writers, a
create form (type/title/slug — slug blank derives from title) plus
per-row Edit, Publish/Unpublish, Archive, and Delete. Guests hit the
server-side writer guard (list errors render in `ErrorText`).

## What It Does

- `createMobileContentActions(api)` — `list`, `create`, `get`,
  `setStatus`, `update`, `remove`; the shared `run` helper sets
  busy/message/error then reloads (same pattern as
  `settings/developers.tsx`). The list spinner only shows while
  `entries` is null AND no error is set — a failed load (e.g. guest
  403) renders the `ErrorText` instead of a perpetual `Loading`.
- Per-row "Edit" expands an editor under the row (type, title, slug,
  locale, required entitlement, excerpt, multiline Markdown body —
  the seven PATCH fields). Expanding calls `content.get(entryId)`
  first because PATCH is a full-form replace and the list omits
  `body`; a `useRef` stale-guard drops a late response after the panel
  closes or another row opens (same pattern as the deliveries panel in
  `settings/developers.tsx`).
- Reached via the home Quick actions card (`/content`); declared in
  `(app)/_layout.tsx` with `href: null` so it stays out of the tab bar.

## Dependencies

- `src/content/client.ts`, `src/session/provider.ts`,
  `src/ui/screen.tsx` primitives.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Content list reads through `readCachedOrFetch`; `<OfflineNotice>` on cache source | Devin |
| 2026-10-13 | += per-row expandable editor (`get` prefill + full-form `update`, incl. body) | Devin |
| 2026-10-12 | Created | Devin |
