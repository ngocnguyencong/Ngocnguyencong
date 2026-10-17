# src/offline/cached-read.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit tests for `cachedRead` / `readCachedOrFetch` / `isNetworkError`
with a fake cache — no network.

## What It Does

- Successful fetch writes the cache and reports `source: "network"`.
- `MobileApiError` status 0 and `TypeError` fall back to a cache hit
  (`source: "cache"` + `savedAt`); with no cached entry the error
  rethrows.
- HTTP statuses (401, 403, 404, 500) rethrow without consulting the
  cache — including when a stale entry exists.
- `readCachedOrFetch` with a null scope bypasses cache reads and writes.
- Sign-out coverage lives in the session provider tests (`clearAll`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for mobile offline reads (WP6) | Devin |
