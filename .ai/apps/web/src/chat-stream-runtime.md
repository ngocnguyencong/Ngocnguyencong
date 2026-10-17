# apps/web/src/chat-stream-runtime.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Server-only chat SSE runtime: streams one assistant reply as SSE `data:`
events (`ChatStreamInput = { alias, prompt, requirements?, signal?, threadId? }`).

## What It Does

- Checks the shared user and workspace AI submission buckets before saving a
  chat message or requesting a model completion. Denial emits an SSE error.
- `completeChat` from `getChatStreamRuntime()` reserves budget before each
  provider attempt and records actual usage. `NoEligibleModelError` and
  `WorkspaceBudgetExceededError` are mapped to safe SSE messages.
- `STREAM_CHUNK_CHARS = 24` chunking over a shared `TextEncoder`.
- Request and consumer cancellation feed an internal `AbortController` passed
  through budgeted completion to AI SDK generation. Cancellation is checked
  before appending the assistant reply; no post-cancel chunks or SSE error frame
  are emitted. Cancellation cannot undo a database append already in progress.
- The provider completes through `generateText` before the runtime slices text
  into SSE chunks; it does not stream partial provider tokens.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Sync usage-ledger recording merged via feat/prod-ready-kit — initial mirror | Devin |
| 2026-10-01 | Forward request/consumer cancellation to completion and suppress stale frames | Codex |

## Security Fix (2026-09-27)

SSE chat now shares the AI submission limits and a budgeted provider path with
durable AI tasks. The stream event format and chat message ordering remain.
