# src/marketing/viewer-snapshot-types.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Shared `ViewerSnapshot` type for the server→client header seed — kept in a
non-`server-only` module so `site-header-client.tsx` can import it while
`viewer-snapshot.ts` stays server-only.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ViewerSnapshot` | `{ signedIn: boolean }` | Server-resolved sign-in state |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Created for the server-seeded header (anti-flicker) | Devin |
