# apps/web/src/marketing/lead-store.test.ts

> Last updated: 2026-09-21 | Protection: STANDARD

## Purpose

Unit tests for `lead-store.ts`. Mocks `server-only` and both
`firebase-admin/app` + `firebase-admin/firestore` entry points, so no real
Google credentials are needed.

## Coverage

- `getLeadStore` env selection: unset → `undefined`, unknown → throws.
- `local` store: JSON file round-trip, newsletter dedupe by email,
  contact leads always append (repeat messages are kept).
- `firestore` store: newsletter writes `marketing_leads/newsletter:{email}`
  via `create()` and maps gRPC 6 / HTTP 409 → `"duplicate"`; contact uses
  auto-id `add()`; missing `FIREBASE_*` env → descriptive throw.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-21 | Initial test file | Devin |
