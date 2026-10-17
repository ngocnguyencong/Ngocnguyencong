# app/api/mobile/commerce/products/route.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Mobile BFF for the workspace product catalog (`/commerce` twin) —
reuses `listCommerceProducts` / `createCommerceProductAction` from
`src/commerce-actions.ts` (internal `requireWorkspaceManager`,
owner/admin only).

## What It Does

- `GET` → `{products, manageable}`; `createdAt` serializes to ISO.
  Error result maps to 401 (`Sign in required.`) or 403.
- `POST {name?, slug?, price?, currency?, description?, imageUrl?,
  inventory?}` → 201 `{id}` / 422 `{error}`. `price` is a human decimal
  ("12.99") parsed to integer cents by the shared normalizer; blank
  `currency` defaults to `usd`; `inventory` blank = untracked.
  `requireWorkspaceManager` runs before the body is read; bounded JSON
  (default 64 KiB) — oversized 413, malformed 400.

## Dependencies

- `src/commerce-actions.ts` — workspace-scoped queries/mutations + audit.
- `src/request-body.ts`, `src/workspace-access.ts`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
