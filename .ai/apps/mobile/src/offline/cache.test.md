# src/offline/cache.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit tests for `createOfflineCache` with an in-memory `OfflineStorage`
fake — no file system needed.

## What It Does

- Covers scope isolation (same key under two scopes never collides),
  TTL expiry (entries past `MAX_ENTRY_AGE_MS` read as null + removed),
  the 256 KB write cap (oversized values are skipped), corrupted-file
  handling (bad JSON / bad envelope / throwing `parse` → null + file
  removed), hashed/sanitized file names (no raw ids in `list()` output),
  and `clearScope`/`clearAll` semantics.
- Injects `now` to age entries deterministically.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for mobile offline reads (WP6) | Devin |
