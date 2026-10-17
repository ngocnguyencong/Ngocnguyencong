# src/chat/client.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`/api/chat` surface: thread CRUD + message listing, plus the incremental
SSE frame parser shared by the streaming helper.

## What It Does

- `createMobileChatActions(api)` → `listThreads` / `createThread` /
  `renameThread` / `deleteThread` / `listMessages`.
- Thread-list helpers: `threadListTitle` ("Untitled thread" fallback for
  blank titles), `normalizedThreadTitle` (mirrors the server's
  trim + whitespace-collapse + 120-char cap, `null` when empty), and
  the immutable list reducers `renameThreadInList` / `removeThreadFromList`
  used to apply rename/delete results without a refetch.
- `createSseParser(onEvent)` — buffer-and-split `data:` frames on `\n\n`,
  JSON-parse each payload, emit `chunk`/`done`/`error` events; malformed
  frames are skipped, comments/`event:` lines ignored.
- Types `ChatThreadSummary`, `ChatMessage`, `ChatAlias`,
  `ChatStreamEvent`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | += thread-list title/reducer helpers for rename/delete UI | Devin |
| 2026-09-28 | Created | Devin |
