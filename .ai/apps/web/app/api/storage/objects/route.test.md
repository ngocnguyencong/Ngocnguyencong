# apps/web/app/api/storage/objects/route.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit test for `GET /api/storage/objects` — mocks `auth-runtime`
(`database`, `getAuthSession`) and `storage-runtime`
(`createServerObjectStorage`) via `vi.mock`, then invokes the exported
handler with `Request`s.

## What It Does

Covers the full status ladder: `401` no session, `400` missing
`workspaceId`/`key`, `400` key outside the workspace prefix (incl. `..`
traversal — and again for a non-member, pinning that key validation runs
before the membership lookup), `403` authenticated non-member (asserts
storage is untouched), `404` missing object, `200` body + `content-type` +
`cache-control` + `x-content-type-options: nosniff` for members. Member
paths also assert `membershipLimit` was called with `1`.

## Important Notes

- Colocated beside the route under `app/`; `vitest.config.ts` includes
  `app/**/*.test.{ts,tsx}` for route-level tests.
- The `database` mock exposes a `select→from→where→limit` chain ending at
  the hoisted `membershipLimit` mock so each test controls the membership
  row set.
- The mocked `where` discards its predicate, so the `eq(...)` filters are
  pinned by a `readFileSync` + `toContain` source test (same idiom as
  `src/data-export.test.ts`) — a dropped `session.user.id` filter would
  otherwise stay green.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Pinned the membership predicate via a source test, asserted `.limit(1)` on member paths, added invalid-key-before-membership ordering + `nosniff` header checks | Devin |
| 2026-09-27 | Created alongside the membership-check fix (403 case fails without it) | Devin |
