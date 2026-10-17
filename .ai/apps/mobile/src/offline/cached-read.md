# src/offline/cached-read.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Read-through helper the screens route data loads through: try the
network, persist the fresh value, and fall back to the cached copy only
when the failure means there is no connectivity.

## What It Does

- `cachedRead(cache, scope, key, fetcher, parse)` — on fetcher success
  writes `cache.set(scope, key, value)` and returns
  `{source: "network", value}`; on a network error returns
  `{source: "cache", value, savedAt}` when a cached entry exists.
- `isNetworkError` — only a fetch `TypeError` or `MobileApiError` with
  `status === 0` (no response produced) counts. HTTP failures —
  including 401/403/404 — rethrow: a denied or missing resource must not
  silently serve stale data, and a 401 must not extend a dead session.
  With no cached entry the network error rethrows.
- `readCachedOrFetch(cache, scope | null, …)` — screen convenience: a
  null scope (signed out / workspace list still loading) skips the cache
  entirely.

## Dependencies

- `MobileApiError` from `../api/client` for the status-0 check;
  `OfflineCache` type from `./cache`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for mobile offline reads (WP6) | Devin |
