# src/marketing/viewer-snapshot.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit coverage for `getViewerSnapshot` — confirmed guest, signed-in viewer,
and probe-failure → `undefined`.

## What It Tests

Mocks `server-only`, `next/headers` (`headers()` → empty `Headers`), and
`../auth-runtime` (`getAuthSession` → hoisted state / throw). React `cache`
is a passthrough in the non-server build, so calls invoke the function
directly.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Created with the snapshot module | Devin |
