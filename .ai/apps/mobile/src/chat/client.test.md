# src/chat/client.test.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Vitest coverage for `createSseParser`: complete frames, frames split
across pushes, error events, malformed JSON, and non-`data:` lines. Also
covers `createMobileChatActions` rename/delete route wiring (PATCH body,
DELETE, id encoding) and the thread-list helpers (`threadListTitle`,
`normalizedThreadTitle`, `renameThreadInList`, `removeThreadFromList`).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | += chat actions wiring + thread-list helper coverage | Devin |
| 2026-09-28 | Created | Devin |
