# src/offline/storage.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

`OfflineStorage` contract for the offline cache: `list()`,
`read(name) → string | null`, `write(name, text)`, `remove(name)`.
Names are opaque sanitized file names the cache derives — the backend
never sees scopes or keys.

## Important Notes

- Production implementation: `./fs-storage` (expo-file-system JSON files
  under `supastack-offline/` in the document directory). Tests inject an
  in-memory `Map` fake.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for mobile offline reads (WP6) | Devin |
