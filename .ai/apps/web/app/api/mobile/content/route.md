# app/api/mobile/content/route.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Mobile BFF for the workspace CMS (`/content` twin) — reuses
`listContentEntries` / `createContentEntryAction` from
`src/content-actions.ts` (internal `requireWorkspaceWriter`, member+;
guests get an error result).

## What It Does

- `GET` → `{entries, writable}`; `createdAt`/`updatedAt`/`publishedAt`
  serialize to ISO strings (publishedAt may be null). `body` stays
  server-side — the mobile list never renders it. Error result maps
  to 401 (`Sign in required.`) or 403.
- `POST {type?, title?, slug?, body?, excerpt?, locale?,
  requiredEntitlement?}` → 201 `{entryId}` / 422 `{error}`.
  `requireWorkspaceWriter` runs before the body is read; JSON is
  bounded at 1 MiB (entry bodies carry long Markdown) — oversized 413,
  malformed 400, non-object 400. Slug derives from title when blank.

## Dependencies

- `src/content-actions.ts` — workspace-scoped queries/mutations + audit.
- `src/request-body.ts` — `readBoundedJson`.
- `src/workspace-access.ts` — `requireWorkspaceWriter`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
