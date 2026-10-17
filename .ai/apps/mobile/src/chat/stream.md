# src/chat/stream.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

POSTs `/api/chat/stream` with the session cookie and pipes the SSE body
through `createSseParser` so `chunk` events surface live. It sends a selected
model alias, optional structured-output requirement, and optional AbortSignal.

## Important Notes

- Uses `expo/fetch` (Hermes streaming fetch). When `response.body` has no
  reader it falls back to `response.text()` and parses the whole buffer —
  replies still complete, just without incremental rendering.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
| 2026-10-01 | Forward alias, structured output, and request cancellation | Codex |
