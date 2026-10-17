# src/offline/cache.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Workspace-scoped offline read cache behind an injectable `OfflineStorage`
backend. Entries are JSON envelopes (`{savedAt, value}`) stored under a
hashed file name so raw user/workspace ids never appear on disk.

## What It Does

- `createOfflineCache({storage, now?})` → `get(scope, key, parse)` /
  `set` / `clearScope` / `clearAll`. `scope` is
  `${userId}:${workspaceId}` — reads and writes can never cross users or
  workspaces.
- File names are FNV-1a hashes (`hash(scope)` + `hash(scope:key)`), so
  identifiers stay out of paths; `clearScope` matches the scope-hash
  prefix.
- `set` skips serialized entries over `MAX_ENTRY_BYTES` (256 KB).
- `get` returns `{value, savedAt}` or null — and deletes the file — when
  the JSON is corrupt, the envelope is malformed, the entry is older than
  `MAX_ENTRY_AGE_MS` (7 days), or `parse` throws. Every storage call is
  best-effort: a broken cache must never break a screen.

## Dependencies

- `OfflineStorage` contract from `./storage` (production impl in
  `./fs-storage`; tests inject an in-memory fake).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for mobile offline reads (WP6) | Devin |
