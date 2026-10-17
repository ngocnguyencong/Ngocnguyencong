# src/offline/fs-storage.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

File-backed `OfflineStorage` built on the expo-file-system SDK 57 API
(`Directory` / `File` / `Paths`). Entries are JSON files in
`<document>/supastack-offline/` — the document directory survives app
restarts and OS cache purges.

## Important Notes

- `createFileSystemOfflineStorage(directory?)` — the directory arg is
  injectable so tests can point at a temp `Directory` if needed;
  `write` creates the dir (`idempotent` + `intermediates`), `list`/`read`
  return empty/null when it does not exist.
- `read` returns null on any file error; `remove` is a no-op for missing
  files — storage stays best-effort so a broken file can never break a
  screen.

## Dependencies

- `expo-file-system@~57.0.7` (SDK-57-compatible; published 2026-09-11 —
  chosen via `npx expo install`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for mobile offline reads (WP6) | Devin |
